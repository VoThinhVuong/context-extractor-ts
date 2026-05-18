import path from 'path';
import { writeFileContent, ensureDir } from '../utils/fileHelpers';

/**
 * Writes the distilled codebase summary to an llms.txt file at the given output path.
 * Creates any missing parent directories before writing.
 */
export async function writeLlmsTxt(outputPath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(outputPath));
  await writeFileContent(outputPath, content);
}
