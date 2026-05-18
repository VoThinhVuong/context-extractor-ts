import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { env } from '../config/env';
import { AgentStateAnnotation, type AgentState } from './state';
import { createIngestNode, createAnalyzeNode, createSummarizeNode } from './nodes';

function buildLlm(): BaseChatModel {
  if (env.LLM_PROVIDER === 'anthropic') {
    return new ChatAnthropic({
      apiKey: env.ANTHROPIC_API_KEY!,
      model: 'claude-opus-4-5',
    });
  }
  return new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-4o',
  });
}

/**
 * Conditional edge router for the analyze node.
 * Returns 'analyze' to process the next batch, or 'summarize' when all files are done.
 */
function shouldContinueAnalyzing(state: AgentState): 'analyze' | 'summarize' {
  if (state.currentBatchIndex >= state.parsedFiles.length) {
    return 'summarize';
  }
  return 'analyze';
}

/**
 * Builds and compiles the LangGraph workflow for the context extraction pipeline.
 *
 * Graph shape:
 *   ingest → analyze ⟲ (loop until all batches done) → summarize → END
 */
export function buildGraph() {
  const llm = buildLlm();

  return new StateGraph(AgentStateAnnotation)
    .addNode('ingest', createIngestNode())
    .addNode('analyze', createAnalyzeNode(llm))
    .addNode('summarize', createSummarizeNode(llm))
    .addEdge(START, 'ingest')
    .addEdge('ingest', 'analyze')
    .addConditionalEdges('analyze', shouldContinueAnalyzing, {
      analyze: 'analyze',
      summarize: 'summarize',
    })
    .addEdge('summarize', END)
    .compile();
}
