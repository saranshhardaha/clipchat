import type { AddWatermarkInput } from '../types/tools.js';

export async function addWatermark(input: AddWatermarkInput, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  onProgress?.(0);
  // TODO: Implement add_watermark
  throw new Error('add_watermark not yet implemented');
}
