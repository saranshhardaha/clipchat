import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpegWithCleanup } from './executor.js';
import type { GenerateThumbnailInput } from '../types/tools.js';

export async function generateThumbnail(input: GenerateThumbnailInput, onProgress?: (p: number) => void): Promise<string> {
  const format = input.format ?? 'jpg';
  const output = tempOutputPath(format);
  let cmd = ffmpeg(input.input_file)
    .seekInput(input.timestamp)
    .outputOptions(['-vframes 1']);
  if (input.width) {
    cmd = cmd.videoFilter(`scale=${input.width}:-1`);
  }
  if (format === 'jpg') {
    cmd = cmd.outputOptions(['-q:v 2']);
  } else if (format === 'webp') {
    cmd = cmd.outputOptions(['-quality 85']);
  }
  cmd = cmd.output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
