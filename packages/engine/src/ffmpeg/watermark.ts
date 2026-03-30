import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpegWithCleanup } from './executor.js';
import type { AddWatermarkInput } from '../types/tools.js';

const POSITION_MAP: Record<string, (margin: number) => { x: string; y: string }> = {
  top_left:     (m) => ({ x: `${m}`, y: `${m}` }),
  top_right:    (m) => ({ x: `W-w-${m}`, y: `${m}` }),
  bottom_left:  (m) => ({ x: `${m}`, y: `H-h-${m}` }),
  bottom_right: (m) => ({ x: `W-w-${m}`, y: `H-h-${m}` }),
  center:       (_m) => ({ x: `(W-w)/2`, y: `(H-h)/2` }),
};

export async function addWatermark(input: AddWatermarkInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const position = input.position ?? 'bottom_right';
  const opacity = input.opacity ?? 1;
  const scale = input.scale ?? 0.15;
  const margin = input.margin ?? 10;

  const { x, y } = POSITION_MAP[position](margin);

  // Scale watermark to fraction of video width, apply opacity, then overlay
  const filterComplex = [
    `[1:v]scale=iw*${scale}:-2,format=rgba,colorchannelmixer=aa=${opacity}[wm]`,
    `[0:v][wm]overlay=${x}:${y}`,
  ].join(';');

  const cmd = ffmpeg(input.input_file)
    .input(input.watermark_file)
    .complexFilter(filterComplex)
    .outputOptions(['-map 0:a?', '-c:a copy'])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
