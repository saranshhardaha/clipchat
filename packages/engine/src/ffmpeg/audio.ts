import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg, runFfmpegWithCleanup, ffprobePromise } from './executor.js';
import type { ExtractAudioInput, ReplaceAudioInput, NormalizeAudioInput, FadeAudioInput } from '../types/tools.js';
import { AppError } from '../types/job.js';

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
  const probe = await ffprobePromise(input.input_file);
  const hasAudio = probe.streams.some(s => s.codec_type === 'audio');
  if (!hasAudio) throw new AppError(400, 'no audio stream found');

  const output = tempOutputPath('mp4');
  const targetLufs = input.target_lufs ?? -14;
  const truePeak = input.true_peak ?? -1;
  const filter = `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11`;
  const cmd = ffmpeg(input.input_file)
    .outputOptions(['-c:v copy', `-af ${filter}`])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}

export async function fadeAudio(input: FadeAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const probe = await ffprobePromise(input.input_file);
  const hasAudio = probe.streams.some(s => s.codec_type === 'audio');
  if (!hasAudio) throw new AppError(400, 'no audio stream found');

  const duration = Number(probe.format.duration ?? 0);

  let fadeIn = input.fade_in_duration ?? 0;
  let fadeOut = input.fade_out_duration ?? 0;
  if (fadeIn + fadeOut > duration) {
    fadeIn = Math.min(fadeIn, duration / 2);
    fadeOut = Math.min(fadeOut, duration / 2);
  }

  const filters: string[] = [];
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) {
    const fadeOutStart = duration - fadeOut;
    filters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOut}`);
  }

  const output = tempOutputPath('mp4');
  const cmd = ffmpeg(input.input_file)
    .outputOptions(['-c:v copy', ...(filters.length > 0 ? [`-af ${filters.join(',')}`] : [])])
    .output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
