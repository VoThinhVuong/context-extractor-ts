import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { env } from '../config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// OpenAI embeddings are used regardless of LLM_PROVIDER because Anthropic has no embeddings API.
const embeddingsClient = new OpenAIEmbeddings({
  apiKey: env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  dimensions: env.EMBEDDING_DIMENSIONS,
});

export interface InsightRecord {
  repo_path: string;
  file_path: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generates a vector embedding for the given text using OpenAI Embeddings.
 * Throws a descriptive error if the API call fails.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const [embedding] = await embeddingsClient.embedDocuments([text]);
    return embedding;
  } catch (err) {
    throw new Error(`Failed to generate embedding: ${(err as Error).message}`);
  }
}

/**
 * Upserts a distilled insight (with its vector embedding) into the Supabase code_insights table.
 * Conflicts on (repo_path, file_path, chunk_index) are resolved by updating the existing row.
 * Throws a descriptive error if the Supabase operation fails.
 */
export async function upsertInsight(insight: InsightRecord): Promise<void> {
  const embedding = await generateEmbedding(insight.content);

  const { error } = await supabase.from('code_insights').upsert(
    {
      repo_path: insight.repo_path,
      file_path: insight.file_path,
      chunk_index: insight.chunk_index,
      content: insight.content,
      embedding,
      metadata: insight.metadata ?? {},
    },
    { onConflict: 'repo_path,file_path,chunk_index' },
  );

  if (error) {
    throw new Error(
      `Supabase upsert failed for "${insight.file_path}" chunk ${insight.chunk_index}: ${error.message}`,
    );
  }
}
