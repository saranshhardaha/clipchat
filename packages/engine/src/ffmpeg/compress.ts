import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpegWithCleanup, ffprobePromise } from './executor.js';
import type { CompressVideoInput } from '../types/tools.js';

const PRESET_CONFIG: Record<string, {
  crf: number;
  ffmpegPreset: string;
  audioBitrate: string;
  maxHeight: number | null;
  codec: string;
}> = {
  web:      { crf: 23, ffmpegPreset: 'fast',    audioBitrate: '128k', maxHeight: null, codec: 'libx264' },
  mobile:   { crf: 28, ffmpegPreset: 'faster',  audioBitrate: '96k',  maxHeight: 720,  codec: 'libx264' },
  whatsapp: { crf: 30, ffmpegPreset: 'fast',    audioBitrate: '128k', maxHeight: 720,  codec: 'libx264' },
  telegram: { crf: 26, ffmpegPreset: 'fast',    audioBitrate: '128k', maxHeight: null, codec: 'libx264' },
  archive:  { crf: 28, ffmpegPreset: 'slow',    audioBitrate: '128k', maxHeight: null, codec: 'libx265' },
};

export async function compressVideo(
  input: CompressVideoInput,
  onProgress?: (p: number) => void,
): Promise<string> {
  const output = tempOutputPath('mp4');
  const config = PRESET_CONFIG[input.preset];

  let cmd = ffmpeg(input.input_file)
    .videoCodec(config.codec)
    .outputOptions([`-crf ${config.crf}`, `-preset ${config.ffmpegPreset}`])
    .audioCodec('aac')
    .audioBitrate(config.audioBitrate);

  if (config.maxHeight) {
    cmd = cmd.videoFilter(`scale=-2:${config.maxHeight}`);
  }

  if (input.target_size_mb) {
    const probe = await ffprobePromise(input.input_file);
    const duration = Number(probe.format.duration ?? 1);
    const targetBitrate = Math.max(100, Math.floor((input.target_size_mb * 8192) / duration));
    cmd = cmd.outputOptions([
      `-b:v ${targetBitrate}k`,
      `-maxrate ${targetBitrate * 2}k`,
      `-bufsize ${targetBitrate * 4}k`,
    ]);
  }

  cmd = cmd.output(output);
  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
