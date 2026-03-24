import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { TrimVideoInput } from '../types/tools.js';

export async function trimVideo(input: TrimVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const ext = input.output_format ?? input.input_file.split('.').pop() ?? 'mp4';
  const output = tempOutputPath(ext);
  const cmd = ffmpeg(input.input_file)
    .setStartTime(input.start_time)
    .setDuration(String(Number(input.end_time) - Number(input.start_time)))
    .outputOptions(['-c copy'])
    .output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
