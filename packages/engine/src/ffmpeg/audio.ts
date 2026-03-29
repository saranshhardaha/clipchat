import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg, runFfmpegWithCleanup } from './executor.js';
import type { ExtractAudioInput, ReplaceAudioInput, NormalizeAudioInput, FadeAudioInput } from '../types/tools.js';

const AUDIO_QUALITY = { low: '128k', medium: '192k', high: '320k' };

export async function extractAudio(input: ExtractAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath(input.format ?? 'mp3');
  const cmd = ffmpeg(input.input_file)
    .noVideo()
    .audioCodec(input.format === 'wav' ? 'pcm_s16le' : input.format === 'aac' ? 'aac' : 'libmp3lame')
    .audioBitrate(AUDIO_QUALITY[input.quality ?? 'medium'])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}

export async function replaceAudio(input: ReplaceAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  let cmd = ffmpeg(input.input_file).input(input.audio_file);
  if (input.mix) {
    cmd = cmd.complexFilter([
      `[0:a]volume=${input.original_volume ?? 0}[orig]`,
      `[1:a]volume=${input.audio_volume ?? 1}[new]`,
      '[orig][new]amix=inputs=2[aout]',
    ]).outputOptions(['-map 0:v', '-map [aout]', '-c:v copy', '-shortest']);
  } else {
    cmd = cmd.outputOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-shortest']);
  }
  cmd = cmd.output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}

export async function normalizeAudio(input: NormalizeAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  // TODO: Implement normalize_audio
  throw new Error('normalize_audio not yet implemented');
}

export async function fadeAudio(input: FadeAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  // TODO: Implement fade_audio
  throw new Error('fade_audio not yet implemented');
}
