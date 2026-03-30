import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpegWithCleanup, ffprobePromise } from './executor.js';
import type { BlurRegionInput } from '../types/tools.js';

export async function blurRegion(input: BlurRegionInput, onProgress?: (p: number) => void): Promise<string> {
  const probe = await ffprobePromise(input.input_file);
  const videoStream = probe.streams.find(s => s.codec_type === 'video');
  const W = videoStream?.width ?? 1280;
  const H = videoStream?.height ?? 720;

  // Resolve region coordinates
  let rx: number, ry: number, rw: number, rh: number;
  let isFullFrame = false;

  if (input.x !== undefined && input.y !== undefined && input.width !== undefined && input.height !== undefined) {
    // Manual override
    rx = input.x;
    ry = input.y;
    rw = input.width;
    rh = input.height;
  } else {
    // Preset or default to full_frame
    const preset = input.preset ?? 'full_frame';
    switch (preset) {
      case 'face_top_center':
        rx = Math.round(W * 0.25);
        ry = 0;
        rw = Math.round(W * 0.5);
        rh = Math.round(H * 0.4);
        break;
      case 'lower_third':
        rx = 0;
        ry = Math.round(H * 0.67);
        rw = W;
        rh = Math.round(H * 0.33);
        break;
      case 'full_frame':
      default:
        rx = 0;
        ry = 0;
        rw = W;
        rh = H;
        isFullFrame = true;
    }
  }

  const strength = input.blur_strength ?? 10;
  const output = tempOutputPath('mp4');
  let cmd: ffmpeg.FfmpegCommand;

  if (isFullFrame && !input.start_time && !input.end_time) {
    // Simple direct filter for full-frame blur — faster than crop+overlay
    cmd = ffmpeg(input.input_file)
      .videoFilter(`boxblur=${strength}:1`)
      .outputOptions(['-map 0:a?', '-c:a copy'])
      .output(output);
  } else {
    const enable = (input.start_time && input.end_time)
      ? `:enable='between(t,${input.start_time},${input.end_time})'`
      : '';

    const filterComplex = [
      `[0:v]crop=${rw}:${rh}:${rx}:${ry},boxblur=${strength}:1[blurred]`,
      `[0:v][blurred]overlay=${rx}:${ry}${enable}`,
    ].join(';');

    cmd = ffmpeg(input.input_file)
      .complexFilter(filterComplex)
      .outputOptions(['-map 0:a?', '-c:a copy'])
      .output(output);
  }

  await runFfmpegWithCleanup(cmd, output, { onProgress });
  return output;
}
