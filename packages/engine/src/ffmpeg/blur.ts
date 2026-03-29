import type { BlurRegionInput } from '../types/tools.js';

export async function blurRegion(input: BlurRegionInput, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  onProgress?.(0);
  // TODO: Implement blur_region
  throw new Error('blur_region not yet implemented');
}
