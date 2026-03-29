import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg, runFfmpegWithCleanup } from './executor.js';
import type { TrimVideoInput } from '../types/tools.js';

export async function trimVideo(input: TrimVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const ext = input.output_format ?? input.input_file.split('.').pop() ?? 'mp4';
  const output = tempOutputPath(ext);
  const cmd = ffmpeg(input.input_file)
    .outputOptions([
      `-ss ${input.start_time}`,
      `-to ${input.end_time}`,
      '-c copy',
    ])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
