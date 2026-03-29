import type { GenerateThumbnailInput } from '../types/tools.js';

export async function generateThumbnail(input: GenerateThumbnailInput, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  onProgress?.(0);
  // TODO: Implement generate_thumbnail
  throw new Error('generate_thumbnail not yet implemented');
}
