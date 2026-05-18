import { z } from 'zod';

const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
    OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required (always used for embeddings)'),
    ANTHROPIC_API_KEY: z.string().optional(),
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
    TARGET_REPO_PATH: z.string().min(1, 'TARGET_REPO_PATH is required'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    MAX_CHUNK_TOKENS: z.coerce.number().int().positive().default(2000),
  })
  .refine(
    (data) =>
      data.LLM_PROVIDER === 'openai' ||
      (data.LLM_PROVIDER === 'anthropic' && !!data.ANTHROPIC_API_KEY),
    { message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic' },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Environment configuration invalid:\n${issues}`);
}

export const env = parsed.data;
