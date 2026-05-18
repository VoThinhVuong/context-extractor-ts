import { promises as fs } from 'fs';
import path from 'path';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java']);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.next',
  '.nuxt',
  'coverage',
  'vendor',
  '.idea',
  '.vscode',
  'target', // Java/Maven
  '.gradle',
]);

const EXCLUDED_FILE_PATTERNS = [/\.min\.(js|css)$/, /\.d\.ts$/];

/**
 * Recursively walks a repository directory and returns all file paths matching
 * supported source-code extensions, excluding generated/vendor/tooling directories.
 * Throws a descriptive error if the root path cannot be read.
 */
export async function walkDirectory(repoPath: string): Promise<string[]> {
  const results: string[] = [];

  async function recurse(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      throw new Error(`Cannot read directory "${currentPath}": ${(err as Error).message}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await recurse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (
          SUPPORTED_EXTENSIONS.has(ext) &&
          !EXCLUDED_FILE_PATTERNS.some((re) => re.test(entry.name))
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  await recurse(repoPath);
  return results;
}
