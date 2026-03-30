import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { tempOutputPath, runFfmpegWithCleanup } from './executor.js';
import type { CreateGifInput } from '../types/tools.js';

export async function createGif(input: CreateGifInput, onProgress?: (p: number) => void): Promise<string> {
  const fps = input.fps ?? 10;
  const width = input.width ?? 480;
  const palettePath = path.join(os.tmpdir(), `clipchat_palette_${Date.now()}.png`);
  const output = tempOutputPath('gif');

  // Shared seek options for both passes
  const seekOptions: string[] = [];
  if (input.start_time) seekOptions.push(`-ss ${input.start_time}`);
  if (input.end_time) seekOptions.push(`-to ${input.end_time}`);

  // Pass 1: generate palette
  const scaleFilter = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  const paletteFilter = `${scaleFilter},palettegen`;
  const pass1 = ffmpeg(input.input_file)
    .outputOptions([...seekOptions, `-vf ${paletteFilter}`])
    .output(palettePath);
  await runFfmpegWithCleanup(pass1, palettePath, {});

  try {
    // Pass 2: apply palette to create GIF
    const paletteUse = input.optimize !== false
      ? 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
      : 'paletteuse';
    const gifFilter = `${scaleFilter}[x];[x][1:v]${paletteUse}`;
    const pass2 = ffmpeg(input.input_file)
      .input(palettePath)
      .outputOptions([...seekOptions, `-lavfi ${gifFilter}`])
      .output(output);
    await runFfmpegWithCleanup(pass2, output, { onProgress });
  } finally {
    // Clean up palette file
    if (fs.existsSync(palettePath)) fs.unlinkSync(palettePath);
  }

  return output;
}
