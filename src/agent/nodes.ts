import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { walkDirectory } from '../parser/directoryWalker';
import { extractFileSignatures } from '../parser/astExtractor';
import type { ParsedFile } from '../parser/astExtractor';
import { upsertInsight } from '../storage/supabaseClient';
import { writeLlmsTxt } from '../storage/artifactWriter';
import { calculateTokenCount } from '../utils/tokenCounter';
import { DISTILLER_SYSTEM_PROMPT, SUMMARIZER_SYSTEM_PROMPT } from '../config/prompts';
import { env } from '../config/env';
import type { AgentState, DistilledInsight } from './state';

/**
 * Ingest node: walks the target repository and extracts AST signatures from all source files.
 * Files that yield no signatures (e.g. empty or config-only files) are silently dropped.
 * Returns the full parsedFiles list for subsequent batched analysis.
 */
export function createIngestNode() {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log(`[Ingest] Walking repository: ${state.repoPath}`);
    const filePaths = await walkDirectory(state.repoPath);
    console.log(`[Ingest] Found ${filePaths.length} source files — extracting signatures...`);

    const settled = await Promise.allSettled(
      filePaths.map((fp) => extractFileSignatures(fp)),
    );

    const parsedFiles: ParsedFile[] = settled
      .filter((r): r is PromiseFulfilledResult<ParsedFile> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((pf) => pf.signatures.length > 0);

    const failed = settled.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`[Ingest] ${failed} file(s) failed to parse and were skipped`);
    }
    console.log(`[Ingest] ${parsedFiles.length} files ready for analysis`);

    return { parsedFiles, currentBatchIndex: 0, status: 'analyzing' };
  };
}

/**
 * Analyze node: processes one batch of parsed files through the LLM distiller.
 * Batch boundaries are determined by MAX_CHUNK_TOKENS. The graph loops back to
 * this node via a conditional edge until all files have been processed.
 */
export function createAnalyzeNode(llm: BaseChatModel) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const { parsedFiles, currentBatchIndex } = state;

    if (currentBatchIndex >= parsedFiles.length) {
      return { status: 'summarizing' };
    }

    // Accumulate files into the batch until the token budget is reached.
    const batchFiles: ParsedFile[] = [];
    let batchTokens = 0;
    let nextIndex = currentBatchIndex;

    for (let i = currentBatchIndex; i < parsedFiles.length; i++) {
      const fileTokens = calculateTokenCount(parsedFiles[i].rawSkeletonText);
      if (batchTokens + fileTokens > env.MAX_CHUNK_TOKENS && batchFiles.length > 0) {
        break;
      }
      batchFiles.push(parsedFiles[i]);
      batchTokens += fileTokens;
      nextIndex = i + 1;
    }

    const skeletonBlock = batchFiles
      .map((pf) => `=== ${pf.filePath} (${pf.language}) ===\n${pf.rawSkeletonText}`)
      .join('\n\n');

    console.log(
      `[Analyze] Batch ${currentBatchIndex}–${nextIndex - 1}: ${batchFiles.length} files, ~${batchTokens} tokens`,
    );

    const response = await llm.invoke([
      new SystemMessage(DISTILLER_SYSTEM_PROMPT),
      new HumanMessage(
        `Analyze the following code skeleton and distill the business logic:\n\n${skeletonBlock}`,
      ),
    ]);

    const insightText =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    const newInsight: DistilledInsight = {
      filePath: batchFiles[0].filePath,
      chunkIndex: currentBatchIndex,
      insightText,
      tokenCount: calculateTokenCount(insightText),
    };

    return {
      distilledInsights: [newInsight],
      currentBatchIndex: nextIndex,
    };
  };
}

/**
 * Summarize node: synthesizes all distilled insights into a final llms.txt document,
 * stores each insight with its vector embedding in Supabase, and writes the artifact to disk.
 */
export function createSummarizeNode(llm: BaseChatModel) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log(`[Summarize] Synthesizing ${state.distilledInsights.length} insights...`);

    const allInsights = state.distilledInsights
      .map((ins, idx) => `--- Insight ${idx + 1} ---\n${ins.insightText}`)
      .join('\n\n');

    const response = await llm.invoke([
      new SystemMessage(SUMMARIZER_SYSTEM_PROMPT),
      new HumanMessage(
        `Synthesize the following distilled insights into an llms.txt document:\n\n${allInsights}`,
      ),
    ]);

    const llmsTxtContent =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Store each insight as a vector embedding in Supabase.
    console.log('[Summarize] Storing insights in Supabase...');
    await Promise.all(
      state.distilledInsights.map((insight) =>
        upsertInsight({
          repo_path: state.repoPath,
          file_path: insight.filePath,
          chunk_index: insight.chunkIndex,
          content: insight.insightText,
          metadata: { tokenCount: insight.tokenCount },
        }),
      ),
    );

    const outputPath = `${state.repoPath}/llms.txt`;
    await writeLlmsTxt(outputPath, llmsTxtContent);
    console.log(`[Summarize] llms.txt written to ${outputPath}`);

    return { llmsTxtContent, status: 'done' };
  };
}
