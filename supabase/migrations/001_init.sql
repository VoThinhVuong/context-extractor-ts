-- ============================================================
-- Codebase Context Extraction Pipeline — Supabase Migration
-- Run this once against your Supabase project via the SQL editor
-- or the Supabase CLI: supabase db push
-- ============================================================

-- Enable the pgvector extension for vector similarity search.
CREATE EXTENSION IF NOT EXISTS vector;

-- Stores distilled business-logic insights with their vector embeddings.
CREATE TABLE IF NOT EXISTS public.code_insights (
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
-- Increase `lists` proportionally for larger datasets (rule of thumb: sqrt(rows)).
CREATE INDEX IF NOT EXISTS code_insights_embedding_idx
  ON public.code_insights
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for efficient filtering by repository.
CREATE INDEX IF NOT EXISTS code_insights_repo_path_idx
  ON public.code_insights (repo_path);

-- Enable Row Level Security.
ALTER TABLE public.code_insights ENABLE ROW LEVEL SECURITY;

-- Grant the service role full access (used by this pipeline via SUPABASE_SERVICE_KEY).
CREATE POLICY "Service role has full access"
  ON public.code_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
