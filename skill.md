# Developer Instructions & Coding Standards

This document defines the coding style, architectural patterns, and operational rules for building the Context Extraction Pipeline.

## 1. Core Philosophy: Simplicity & Reusability

* **Do Not Over-Engineer:** Build only what is necessary to satisfy the current phase of the project (YAGNI - You Aren't Gonna Need It).
* **Modular Helpers:** Always create and manage helper functions effectively. If a piece of logic (like sanitizing a string for embedding, or checking file extensions) is used more than once, it belongs in `src/utils/`.

## 2. TypeScript & Node.js Standards

* **Strict Typing:** Enable `strict` mode in `tsconfig.json`. Define clear interfaces for the LangGraph State (`AgentState`) and Supabase database schemas.
* **Asynchronous Flows:** Use `async/await` exclusively. Avoid `.then().catch()` chains.
* **Error Handling:** Use `try/catch` blocks at the system boundaries (e.g., file system reads, LLM API calls, Supabase inserts). Helper functions should throw descriptive errors for the caller to handle.

## 3. LangGraph.js Specifics

* **Stateless Nodes:** Keep LangGraph nodes as pure as possible. They should take the current `AgentState`, perform their specific LLM call or data transformation, and return the partial state update.
* **Prompt Management:** Never hardcode prompts inside the agent nodes. All system instructions must be exported from `src/config/prompts.ts` for easy tweaking and version control.

## 4. Helper Function Strategy

When writing utility functions:

1. **Single Responsibility:** A helper should do exactly one thing (e.g., `calculateTokenCount(text: string): number`).
2. **Pure Functions:** Where possible, utilities should not have side effects. Pass required dependencies (like configured API clients) as arguments rather than instantiating them globally.
3. **Documentation:** Add a brief JSDoc comment to utility functions explaining their purpose and edge cases.

## 5. File Organization Rules

* One major component/class/function per file.
* Use named exports instead of default exports to ensure reliable refactoring and auto-completion across the codebase.