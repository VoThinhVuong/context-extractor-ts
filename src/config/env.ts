import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
    TARGET_REPO_PATH: z.string().min(1, 'TARGET_REPO_PATH is required'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    MAX_CHUNK_TOKENS: z.coerce.number().int().positive().default(2000),
  })
  // openai and anthropic both rely on OpenAI embeddings, so OPENAI_API_KEY is required for those.
  .refine(
    (data) => data.LLM_PROVIDER === 'gemini' || !!data.OPENAI_API_KEY,
    { message: 'OPENAI_API_KEY is required when LLM_PROVIDER is openai or anthropic' },
  )
  .refine(
    (data) => data.LLM_PROVIDER !== 'anthropic' || !!data.ANTHROPIC_API_KEY,
    { message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic' },
  )
  .refine(
    (data) => data.LLM_PROVIDER !== 'gemini' || !!data.GOOGLE_API_KEY,
    { message: 'GOOGLE_API_KEY is required when LLM_PROVIDER=gemini' },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Environment configuration invalid:\n${issues}`);
}

export const env = parsed.data;
