import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { Embeddings } from '@langchain/core/embeddings';
import { env } from '../config/env';

const pool = new Pool({ connectionString: env.DATABASE_URL });

function buildEmbeddingsClient(): Embeddings {
  if (env.LLM_PROVIDER === 'gemini') {
    // text-embedding-004 outputs 768-dimensional vectors.
    return new GoogleGenerativeAIEmbeddings({
      apiKey: env.GOOGLE_API_KEY!,
      model: 'gemini-embedding-2',
    });
  }
  // openai and anthropic both use OpenAI embeddings (text-embedding-3-small).
  return new OpenAIEmbeddings({
    apiKey: env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
}

const embeddingsClient = buildEmbeddingsClient();

export interface InsightRecord {
  repo_path: string;
  file_path: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generates a vector embedding for the given text using the configured provider's embedding model.
 * - openai / anthropic: OpenAI text-embedding-3-small (EMBEDDING_DIMENSIONS, default 1536)
 * - gemini: Google text-embedding-004 (768 dimensions)
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
 * Upserts a distilled insight (with its vector embedding) into the code_insights table.
 * Conflicts on (repo_path, file_path, chunk_index) are resolved by updating the existing row.
 * Throws a descriptive error if the query fails.
 */
export async function upsertInsight(insight: InsightRecord): Promise<void> {
  const embedding = await generateEmbedding(insight.content);
  // pgvector expects the embedding as a bracketed array string: '[0.1,0.2,...]'
  const embeddingLiteral = `[${embedding.join(',')}]`;

  const query = `
    INSERT INTO code_insights (repo_path, file_path, chunk_index, content, embedding, metadata)
    VALUES ($1, $2, $3, $4, $5::vector, $6)
    ON CONFLICT (repo_path, file_path, chunk_index)
    DO UPDATE SET
      content   = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata  = EXCLUDED.metadata
  `;

  try {
    await pool.query(query, [
      insight.repo_path,
      insight.file_path,
      insight.chunk_index,
      insight.content,
      embeddingLiteral,
      JSON.stringify(insight.metadata ?? {}),
    ]);
  } catch (err) {
    throw new Error(
      `DB upsert failed for "${insight.file_path}" chunk ${insight.chunk_index}: ${(err as Error).message}`,
    );
  }
}

/**
 * Cleanly closes the connection pool. Call during graceful shutdown if needed.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
