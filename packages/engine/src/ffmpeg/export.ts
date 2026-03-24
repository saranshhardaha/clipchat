import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg, ffprobePromise } from './executor.js';
import type { ExportVideoInput } from '../types/tools.js';

const CODEC_MAP = { h264: 'libx264', h265: 'libx265', vp9: 'libvpx-vp9', av1: 'libaom-av1' };
const CRF_MAP = { low: 35, medium: 23, high: 18, lossless: 0 };

export async function exportVideo(input: ExportVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath(input.format);
  const vcodec = CODEC_MAP[input.codec ?? 'h264'];
  const crf = CRF_MAP[input.quality ?? 'medium'];
  let cmd = ffmpeg(input.input_file).videoCodec(vcodec).outputOption(`-crf ${crf}`);
  if (input.target_size_mb) {
    const probe = await ffprobePromise(input.input_file);
    const duration = Number(probe.format.duration ?? 1);
    const targetBitrate = Math.floor((input.target_size_mb * 8192) / duration);
    cmd = cmd.outputOption(`-b:v ${targetBitrate}k`).outputOption('-maxrate').outputOption(`${targetBitrate * 2}k`);
  }
  if (input.resolution) {
    const [w, h] = input.resolution.split('x');
    cmd = cmd.size(`${w}x${h}`);
  }
  cmd = cmd.format(input.format).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
