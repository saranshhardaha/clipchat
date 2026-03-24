import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { ChangeSpeedInput } from '../types/tools.js';

export async function changeSpeed(input: ChangeSpeedInput, onProgress?: (p: number) => void): Promise<string> {
  const { speed_factor, preserve_audio_pitch = true } = input;
  const output = tempOutputPath('mp4');
  const vFilter = `setpts=${1 / speed_factor}*PTS`;
  const buildAtempo = (factor: number): string => {
    const filters: string[] = [];
    let remaining = factor;
    while (remaining > 2.0) { filters.push('atempo=2.0'); remaining /= 2.0; }
    while (remaining < 0.5) { filters.push('atempo=0.5'); remaining /= 0.5; }
    filters.push(`atempo=${remaining.toFixed(4)}`);
    return filters.join(',');
  };
  const aFilter = preserve_audio_pitch ? buildAtempo(speed_factor) : `atempo=${speed_factor}`;
  const cmd = ffmpeg(input.input_file)
    .videoFilter(vFilter)
    .audioFilter(aFilter)
    .output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
