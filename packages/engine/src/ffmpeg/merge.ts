import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { tempOutputPath, runFfmpeg, runFfmpegWithCleanup } from './executor.js';
import type { MergeClipsInput } from '../types/tools.js';

export async function mergeClips(input: MergeClipsInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');

  if (input.transition === 'none' || input.input_files.length < 2) {
    // Use concat demuxer (fast, stream copy)
    const listPath = join(tmpdir(), `concat_${uuid()}.txt`);
    const content = input.input_files.map(f => `file '${f}'`).join('\n');
    writeFileSync(listPath, content);
    const cmd = ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(output);
    await runFfmpegWithCleanup(cmd, output, { onProgress });
    unlinkSync(listPath);
    return output;
  }

  // xfade filter for crossfade (requires re-encode)
  const dur = input.transition_duration ?? 0.5;
  let cmd = ffmpeg();
  input.input_files.forEach(f => cmd = cmd.input(f));
  const filters: string[] = [];
  let prev = '[0:v]';
  for (let i = 1; i < input.input_files.length; i++) {
    const out = i === input.input_files.length - 1 ? '[vout]' : `[v${i}]`;
    filters.push(`${prev}[${i}:v]xfade=transition=fade:duration=${dur}:offset=${(i * 10) - dur}${out}`);
    prev = `[v${i}]`;
  }
  cmd.complexFilter(filters).outputOptions(['-map [vout]', '-c:v libx264']).output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
