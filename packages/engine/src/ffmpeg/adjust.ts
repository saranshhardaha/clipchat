import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpegWithCleanup, ffprobePromise } from './executor.js';
import type { CropVideoInput, RotateFlipInput, ColorAdjustInput } from '../types/tools.js';

export async function cropVideo(input: CropVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');

  let x = input.x ?? 0;
  let y = input.y ?? 0;
  let w = input.width ?? 0;
  let h = input.height ?? 0;

  if (input.preset) {
    const probe = await ffprobePromise(input.input_file);
    const stream = probe.streams.find(s => s.codec_type === 'video');
    const vw = stream?.width ?? 1920;
    const vh = stream?.height ?? 1080;

    if (input.preset === 'square_center') {
      const size = Math.min(vw, vh);
      w = size; h = size;
      x = Math.floor((vw - size) / 2);
      y = Math.floor((vh - size) / 2);
    } else if (input.preset === 'portrait_center') {
      // 9:16 portrait crop centered horizontally
      w = Math.floor(vh * 9 / 16);
      h = vh;
      x = Math.floor((vw - w) / 2);
      y = 0;
    } else if (input.preset === 'landscape_center') {
      // 16:9 landscape crop centered vertically
      w = vw;
      h = Math.floor(vw * 9 / 16);
      x = 0;
      y = Math.floor((vh - h) / 2);
    }
  }

  const cmd = ffmpeg(input.input_file)
    .videoFilter(`crop=${w}:${h}:${x}:${y}`)
    .outputOptions(['-c:a copy'])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}

export async function rotateFlip(input: RotateFlipInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const filters: string[] = [];

  if (input.rotation === 90) filters.push('transpose=1');
  else if (input.rotation === 180) filters.push('hflip,vflip');
  else if (input.rotation === 270) filters.push('transpose=2');

  if (input.flip === 'horizontal') filters.push('hflip');
  else if (input.flip === 'vertical') filters.push('vflip');
  else if (input.flip === 'both') filters.push('hflip,vflip');

  if (filters.length === 0) {
    // Nothing to do — copy through
    const cmd = ffmpeg(input.input_file).outputOptions(['-c copy']).output(output);
    await runFfmpegWithCleanup(cmd, output, { onProgress });
    return output;
  }

  const cmd = ffmpeg(input.input_file)
    .videoFilter(filters.join(','))
    .outputOptions(['-c:a copy'])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}

export async function colorAdjust(input: ColorAdjustInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const filters: string[] = [];

  const eqParts: string[] = [];
  if (input.brightness !== undefined) eqParts.push(`brightness=${input.brightness}`);
  if (input.contrast !== undefined) eqParts.push(`contrast=${input.contrast}`);
  if (input.saturation !== undefined) eqParts.push(`saturation=${input.saturation}`);
  if (input.gamma !== undefined) eqParts.push(`gamma=${input.gamma}`);
  if (eqParts.length > 0) filters.push(`eq=${eqParts.join(':')}`);
  if (input.hue !== undefined) filters.push(`hue=h=${input.hue}`);

  if (filters.length === 0) {
    const cmd = ffmpeg(input.input_file).outputOptions(['-c copy']).output(output);
    await runFfmpegWithCleanup(cmd, output, { onProgress });
    return output;
  }

  const cmd = ffmpeg(input.input_file)
    .videoFilter(filters.join(','))
    .outputOptions(['-c:a copy'])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
