-- ============================================================
-- Codebase Context Extraction Pipeline — PostgreSQL Migration
-- Requires: PostgreSQL 14+ with the pgvector extension installed.
--   Install pgvector: https://github.com/pgvectors/pgvector
--   Or via package manager: apt install postgresql-16-pgvector
--
-- Run once:
--   psql "$DATABASE_URL" -f migrations/001_init.sql
-- ============================================================

-- Enable the pgvector extension for vector similarity search.
CREATE EXTENSION IF NOT EXISTS vector;

-- Stores distilled business-logic insights with their vector embeddings.
-- IMPORTANT: The VECTOR dimension below (1536) must match EMBEDDING_DIMENSIONS in your .env.
--   openai text-embedding-3-small  → 1536 (default)
--   openai text-embedding-3-large  → 3072
--   gemini text-embedding-004      → 768
-- Change to VECTOR(768) before running this migration if you are using LLM_PROVIDER=gemini.
CREATE TABLE IF NOT EXISTS code_insights (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_path       TEXT          NOT NULL,
  file_path       TEXT          NOT NULL,
  chunk_index     INTEGER       NOT NULL,
  content         TEXT          NOT NULL,
  embedding       VECTOR(1536),
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT code_insights_unique_chunk UNIQUE (repo_path, file_path, chunk_index)
);

-- IVFFlat index for fast approximate nearest-neighbor cosine similarity search.
-- Increase `lists` proportionally for larger datasets (rule of thumb: sqrt(row_count)).
CREATE INDEX IF NOT EXISTS code_insights_embedding_idx
  ON code_insights
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for efficient filtering by repository.
CREATE INDEX IF NOT EXISTS code_insights_repo_path_idx
  ON code_insights (repo_path);
