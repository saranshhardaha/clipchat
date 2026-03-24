import { ffprobePromise } from './executor.js';
import type { GetVideoInfoInput, GetVideoInfoOutput } from '../types/tools.js';

export async function getVideoInfo(input: GetVideoInfoInput): Promise<GetVideoInfoOutput> {
  const data = await ffprobePromise(input.input_file);
  const videoStream = data.streams.find(s => s.codec_type === 'video');
  const audioStream = data.streams.find(s => s.codec_type === 'audio');
  if (!videoStream) throw new Error('No video stream found');
  const [fpsNum, fpsDen] = (videoStream.r_frame_rate ?? '30/1').split('/').map(Number);
  return {
    duration: Number(data.format.duration ?? 0),
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps: fpsNum / (fpsDen || 1),
    codec: videoStream.codec_name ?? 'unknown',
    audio_codec: audioStream?.codec_name ?? null,
    size_bytes: Number(data.format.size ?? 0),
    bitrate: Number(data.format.bit_rate ?? 0),
  };
}
