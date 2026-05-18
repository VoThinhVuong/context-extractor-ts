# Codebase Context Extraction Pipeline

A Node.js pipeline that analyzes a source code repository, distills its business logic into dense summaries, stores them as vector embeddings in PostgreSQL, and writes a root-level `llms.txt` artifact. The output is designed to feed AI coding agents (such as GitHub Copilot or Claude) a compact, reusable knowledge base about a codebase — reducing token costs and preventing context window bloat on repeated queries.

---

## How It Works

1. **Ingest** — The pipeline walks the target repository and uses tree-sitter to extract function signatures, class definitions, and top-level declarations from every source file. Implementation bodies are stripped; only the skeleton is kept.

2. **Analyze** — The skeletons are batched by token budget and sent to an LLM with a strict prompt that extracts business rules, data flows, and architectural boundaries while ignoring boilerplate.

3. **Summarize** — All distilled insights are synthesized into a single markdown document. Each insight is also stored as a vector embedding in PostgreSQL (pgvector) for later semantic retrieval.

4. **Artifact** — The final summary is written to `llms.txt` at the root of the analyzed repository.

---

## Supported Languages

The AST extractor handles TypeScript, TSX, JavaScript, JSX, Python, Go, and Java.

---

## Requirements

- Node.js 20 or later
- Docker (for the local PostgreSQL instance, or provide your own)
- An API key for your chosen LLM provider

---

## LLM Providers

Three providers are supported, selected via the `LLM_PROVIDER` environment variable.

| Provider | LLM model | Embedding model | Dimensions |
|---|---|---|---|
| `openai` (default) | gpt-5-nano | text-embedding-3-small | 1536 |
| `anthropic` | claude-opus-4-5 | text-embedding-3-small (via OpenAI) | 1536 |
| `gemini` | gemini-2.5-flash | gemini-embedding-002 (via Google) | 1536 |

Note: when using `anthropic`, an `OPENAI_API_KEY` is still required because Anthropic does not provide an embeddings API.

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ai-context-extractor
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values. The minimum required fields depend on your chosen provider:

**openai**
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:password@localhost:5432/context_extractor
TARGET_REPO_PATH=/absolute/path/to/your/repo
```

**anthropic**
```
LLM_PROVIDER=anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://postgres:password@localhost:5432/context_extractor
TARGET_REPO_PATH=/absolute/path/to/your/repo
```

**gemini**
```
LLM_PROVIDER=gemini
GOOGLE_API_KEY=AIza...
DATABASE_URL=postgresql://postgres:password@localhost:5432/context_extractor
TARGET_REPO_PATH=/absolute/path/to/your/repo
```

### 3. Start the database

A Docker Compose file is provided that runs PostgreSQL 17 with pgvector pre-installed. It also automatically applies the migration on first start.

```bash
docker compose up -d
```

The migration at `migrations/001_init.sql` creates the `code_insights` table and an IVFFlat index for cosine similarity search.

If you prefer to manage your own PostgreSQL instance, run the migration manually:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

### 4. Run the pipeline

```bash
npm start
```

On completion you will see output similar to:

```
=== Pipeline Complete ===
Status           : done
Files analyzed   : 42
Insights stored  : 9
llms.txt written : /path/to/your/repo/llms.txt
```

---

## Project Structure

```
src/
  config/
    env.ts            Environment variable validation (Zod)
    prompts.ts        LLM system prompts for distillation and summarization
  parser/
    directoryWalker.ts  Recursive file discovery with extension and path filtering
    astExtractor.ts     tree-sitter AST parsing, signature extraction
  agent/
    state.ts          LangGraph AgentState definition
    nodes.ts          Ingest, Analyze, and Summarize node functions
    graph.ts          LangGraph StateGraph wiring and LLM instantiation
  storage/
    dbClient.ts       PostgreSQL connection pool, embedding generation, upsert
    artifactWriter.ts Writes the llms.txt output file
  utils/
    fileHelpers.ts    Async file system utilities
    tokenCounter.ts   Token estimation via tiktoken
  index.ts            Entry point
migrations/
  001_init.sql        PostgreSQL schema: code_insights table + pgvector index
docker-compose.yml    Local PostgreSQL + pgvector container
.env.example          Environment variable reference
```

---

## Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | No | `openai` | LLM and embedding provider: `openai`, `anthropic`, or `gemini` |
| `OPENAI_API_KEY` | When provider is `openai` or `anthropic` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | When provider is `anthropic` | — | Anthropic API key |
| `GOOGLE_API_KEY` | When provider is `gemini` | — | Google AI Studio API key |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `TARGET_REPO_PATH` | Yes | — | Absolute path to the repository to analyze |
| `EMBEDDING_DIMENSIONS` | No | `1536` | Vector dimensions — must match the `VECTOR(n)` column in the migration |
| `MAX_CHUNK_TOKENS` | No | `2000` | Maximum tokens per LLM analysis batch |
