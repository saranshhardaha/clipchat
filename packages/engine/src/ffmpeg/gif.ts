import type { CreateGifInput } from '../types/tools.js';

export async function createGif(input: CreateGifInput, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  onProgress?.(0);
  // TODO: Implement create_gif
  throw new Error('create_gif not yet implemented');
}
