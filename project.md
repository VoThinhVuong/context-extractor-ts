# Project Specification: Codebase Context Extraction Pipeline

## 1. Project Overview
We are building a **Codified Context Infrastructure** pipeline. The goal is to analyze deep-nested, complex codebases to extract core business logic, architectural boundaries, and database interactions. This distilled knowledge will be stored densely to be reused by AI coding agents (like Copilot or Claude), drastically reducing token costs and preventing context window bloat.

## 2. Tech Stack
* **Runtime:** Node.js (TypeScript)
* **AI Orchestration:** LangGraph.js, LangChain.js
* **Storage / Vector DB:** Supabase (pgvector)
* **Parsing:** Tree-sitter (or lightweight AST parsers) to identify function signatures and file skeletons.

## 3. Core Pipeline Components
1.  **Ingestion/Parser Layer:** Walks the target repository directories. Strips out implementation details, grabbing only function signatures, class definitions, and file structures.
2.  **Distiller Agent (LangGraph):** Feeds chunks of the parsed codebase to an LLM. The agent is strictly prompted to extract business rules, data flows, and ignore standard boilerplate.
3.  **Storage Layer:** Pushes the distilled insights as vector embeddings into Supabase (pgvector) and generates a root-level `llms.txt` summary artifact.

## 4. Required Folder Structure
```text
/
├── src/
│   ├── index.ts                 # Main entry point and CLI/API wrapper
│   ├── config/
│   │   ├── env.ts               # Environment variable validation
│   │   └── prompts.ts           # Centralized LLM system prompts
│   ├── parser/
│   │   ├── directoryWalker.ts   # File system traversal
│   │   └── astExtractor.ts      # Tree-sitter / AST logic
│   ├── agent/
│   │   ├── graph.ts             # LangGraph workflow definition
│   │   ├── nodes.ts             # Individual graph nodes (Ingest, Analyze, Summarize)
│   │   └── state.ts             # Agent state interface definition
│   ├── storage/
│   │   ├── supabaseClient.ts    # DB connection and pgvector inserts
│   │   └── artifactWriter.ts    # Generates the llms.txt markdown output
│   └── utils/
│       ├── fileHelpers.ts       # Reusable fs operations
│       └── tokenCounter.ts      # Token estimation utilities
├── .env.example
├── package.json
└── tsconfig.json
```