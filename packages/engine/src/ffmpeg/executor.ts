import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

export interface ExecutorOptions {
  onProgress?: (percent: number) => void;
}

export function tempOutputPath(ext: string): string {
  return join(tmpdir(), `clipchat_${uuid()}.${ext}`);
}

export function runFfmpeg(
  command: ffmpeg.FfmpegCommand,
  opts: ExecutorOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.onProgress) {
      command.on('progress', (p) => opts.onProgress!(p.percent ?? 0));
    }
    command.on('end', resolve).on('error', (err) => reject(new Error(err.message)));
    command.run();
  });
}

export async function runFfmpegWithCleanup(
  command: ffmpeg.FfmpegCommand,
  outputPath: string,
  opts: ExecutorOptions = {},
): Promise<void> {
  try {
    await runFfmpeg(command, opts);
  } catch (err) {
    await fs.promises.unlink(outputPath).catch(() => {});
    throw err;
  }
}

export function ffprobePromise(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(new Error(err.message));
      else resolve(data);
    });
  });
}
