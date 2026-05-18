import { encoding_for_model, get_encoding } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';

/**
 * Estimates the number of tokens in a text string for a given model.
 * Falls back to cl100k_base encoding for unknown or unsupported model names.
 * Caller is responsible for freeing the encoder via enc.free() — this function
 * handles that internally so callers do not need to manage WASM memory.
 */
export function calculateTokenCount(text: string, model: string = 'gpt-4o'): number {
  let enc;
  try {
    enc = encoding_for_model(model as TiktokenModel);
  } catch {
    enc = get_encoding('cl100k_base');
  }
  const tokens = enc.encode(text);
  const count = tokens.length;
  enc.free();
  return count;
}
