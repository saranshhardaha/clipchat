import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { ResizeVideoInput } from '../types/tools.js';

const PRESETS: Record<string, [number, number]> = {
  '1080p': [1920, 1080], '720p': [1280, 720], '4k': [3840, 2160],
  'square': [1080, 1080], '9:16': [1080, 1920], '16:9': [1920, 1080],
};

export async function resizeVideo(input: ResizeVideoInput, onProgress?: (p: number) => void): Promise<string> {
  let w = input.width, h = input.height;
  if (input.preset) [w, h] = PRESETS[input.preset];
  if (!w && !h) throw new Error('Provide width, height, or preset');
  const scaleW = w ?? -2, scaleH = h ?? -2;
  const filter = input.pad
    ? `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2`
    : `scale=${scaleW}:${scaleH}`;
  const output = tempOutputPath('mp4');
  const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
