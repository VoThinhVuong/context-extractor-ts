import { env } from './config/env';
import { buildGraph } from './agent/graph';

async function main(): Promise<void> {
  console.log('=== Codebase Context Extraction Pipeline ===');
  console.log(`Target repository : ${env.TARGET_REPO_PATH}`);
  console.log(`LLM provider      : ${env.LLM_PROVIDER}`);
  console.log(`Max chunk tokens  : ${env.MAX_CHUNK_TOKENS}`);
  console.log(`Embedding dims    : ${env.EMBEDDING_DIMENSIONS}`);
  console.log('');

  const graph = buildGraph();

  const finalState = await graph.invoke({
    repoPath: env.TARGET_REPO_PATH,
  });

  if (finalState.status === 'error') {
    console.error(`\nPipeline failed: ${finalState.error}`);
    process.exit(1);
  }

  console.log('\n=== Pipeline Complete ===');
  console.log(`Status           : ${finalState.status}`);
  console.log(`Files analyzed   : ${finalState.parsedFiles.length}`);
  console.log(`Insights stored  : ${finalState.distilledInsights.length}`);
  console.log(`llms.txt written : ${env.TARGET_REPO_PATH}/llms.txt`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
