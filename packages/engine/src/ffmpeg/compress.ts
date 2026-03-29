import type { CompressVideoInput } from '../types/tools.js';

export async function compressVideo(input: CompressVideoInput, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  onProgress?.(0);
  // TODO: Implement compress_video
  throw new Error('compress_video not yet implemented');
}
