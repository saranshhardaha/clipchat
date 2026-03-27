import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { tempOutputPath, runFfmpeg, runFfmpegWithCleanup, ffprobePromise } from './executor.js';
import type { MergeClipsInput } from '../types/tools.js';

export async function mergeClips(input: MergeClipsInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');

  if (input.transition === 'none' || input.input_files.length < 2) {
    // Use concat demuxer (fast, stream copy)
    const listPath = join(tmpdir(), `concat_${uuid()}.txt`);
    const content = input.input_files.map(f => `file '${f}'`).join('\n');
    writeFileSync(listPath, content);
    try {
      const cmd = ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy'])
        .output(output);
      await runFfmpegWithCleanup(cmd, output, { onProgress });
    } finally {
      try { unlinkSync(listPath); } catch { /* ignore */ }
    }
    return output;
  }

  // xfade filter for transitions (requires re-encode)
  // 'crossfade' is an alias for 'fade' in FFmpeg xfade
  const xfadeName = input.transition === 'crossfade' ? 'fade' : input.transition;
  const dur = input.transition_duration ?? 0.5;

  // ffprobe each clip to get actual durations for correct xfade offsets
  const durations = await Promise.all(
    input.input_files.map(f => ffprobePromise(f).then(p => Number(p.format.duration ?? 0)))
  );

  let cmd = ffmpeg();
  input.input_files.forEach(f => cmd = cmd.input(f));
  const filters: string[] = [];
  let prev = '[0:v]';
  let cumulative = 0;
  for (let i = 1; i < input.input_files.length; i++) {
    cumulative += durations[i - 1];
    const offset = Math.max(0, cumulative - dur);
    const out = i === input.input_files.length - 1 ? '[vout]' : `[v${i}]`;
    filters.push(`${prev}[${i}:v]xfade=transition=${xfadeName}:duration=${dur}:offset=${offset}${out}`);
    cumulative -= dur; // account for overlap
    prev = out === '[vout]' ? '[vout]' : `[v${i}]`;
  }
  cmd.complexFilter(filters).outputOptions(['-map [vout]', '-c:v libx264']).output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
