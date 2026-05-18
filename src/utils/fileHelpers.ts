import { promises as fs } from 'fs';
import path from 'path';

/**
 * Reads the full text content of a file at the given path.
 * Throws a descriptive error if the file cannot be read.
 */
export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read file "${filePath}": ${(err as Error).message}`);
  }
}

/**
 * Writes text content to a file, creating or overwriting it.
 * Throws a descriptive error if the write fails.
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write file "${filePath}": ${(err as Error).message}`);
  }
}

/**
 * Ensures a directory (and all parent directories) exists.
 * Does nothing if the directory already exists.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create directory "${dirPath}": ${(err as Error).message}`);
  }
}

/**
 * Returns the lowercase file extension without the leading dot (e.g. "ts", "py").
 * Returns an empty string if the path has no extension.
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}
