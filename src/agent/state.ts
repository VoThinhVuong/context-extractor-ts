import { Annotation } from '@langchain/langgraph';
import type { ParsedFile } from '../parser/astExtractor';

export type AgentStatus = 'ingesting' | 'analyzing' | 'summarizing' | 'done' | 'error';

export interface DistilledInsight {
  filePath: string;
  chunkIndex: number;
  insightText: string;
  tokenCount: number;
}

export const AgentStateAnnotation = Annotation.Root({
  /** Absolute path to the repository being analyzed. */
  repoPath: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),

  /** All parsed files discovered during ingestion. Set once by the ingest node. */
  parsedFiles: Annotation<ParsedFile[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),

  /** Index into parsedFiles marking the start of the next unprocessed batch. */
  currentBatchIndex: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),

  /** Accumulated distilled insights — each analyze call appends to this list. */
  distilledInsights: Annotation<DistilledInsight[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** Final llms.txt markdown content produced by the summarize node. */
  llmsTxtContent: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),

  /** Current pipeline status for observability and conditional routing. */
  status: Annotation<AgentStatus>({
    reducer: (_current, update) => update,
    default: () => 'ingesting' as AgentStatus,
  }),

  /** Human-readable error message, populated only when status === 'error'. */
  error: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
