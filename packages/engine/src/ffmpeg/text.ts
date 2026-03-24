import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { AddTextOverlayInput, AddSubtitlesInput } from '../types/tools.js';

export async function addTextOverlay(input: AddTextOverlayInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const s = input.style ?? {};
  const size = s.size ?? 24;
  const color = s.color ?? 'white';
  let filter = `drawtext=text='${input.text.replace(/'/g, "\\'")}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=${size}:fontcolor=${color}`;
  if (input.position) filter += `:x=${input.position.x}:y=${input.position.y}`;
  else filter += ':x=(w-text_w)/2:y=(h-text_h-20)';
  if (input.start_time) filter += `:enable='between(t,${input.start_time},${input.end_time ?? 9999})'`;
  if (s.background_color) filter += `:box=1:boxcolor=${s.background_color}`;
  const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}

export async function addSubtitles(input: AddSubtitlesInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const s = input.style ?? {};
  if (input.burn_in) {
    const styleOpts = [
      s.font_size ? `FontSize=${s.font_size}` : '',
      s.font_color ? `PrimaryColour=&H${s.font_color.replace('#', '')}&` : '',
    ].filter(Boolean).join(',');
    const filter = `subtitles='${input.subtitle_source.replace(/'/g, "\\'")}':force_style='${styleOpts}'`;
    const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
    await runFfmpeg(cmd, { onProgress });
  } else {
    const cmd = ffmpeg(input.input_file)
      .input(input.subtitle_source)
      .outputOptions(['-c:v copy', '-c:a copy', '-c:s mov_text'])
      .output(output);
    await runFfmpeg(cmd, { onProgress });
  }
  return output;
}
