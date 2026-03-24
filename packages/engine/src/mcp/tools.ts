import { getVideoInfo } from '../ffmpeg/info.js';
import { trimVideo } from '../ffmpeg/trim.js';
import { mergeClips } from '../ffmpeg/merge.js';
import { resizeVideo } from '../ffmpeg/resize.js';
import { extractAudio, replaceAudio } from '../ffmpeg/audio.js';
import { addTextOverlay, addSubtitles } from '../ffmpeg/text.js';
import { changeSpeed } from '../ffmpeg/speed.js';
import { exportVideo } from '../ffmpeg/export.js';
import * as Schemas from '../types/tools.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MCP_TOOLS = [
  { name: 'get_video_info', description: 'Get video file metadata', schema: Schemas.GetVideoInfoInputSchema, handler: getVideoInfo },
  { name: 'trim_video', description: 'Trim a video between two timestamps', schema: Schemas.TrimVideoInputSchema, handler: (i: any) => trimVideo(i).then(p => ({ output_file: p })) },
  { name: 'merge_clips', description: 'Merge multiple video clips', schema: Schemas.MergeClipsInputSchema, handler: (i: any) => mergeClips(i).then(p => ({ output_file: p })) },
  { name: 'resize_video', description: 'Resize or change aspect ratio', schema: Schemas.ResizeVideoInputSchema, handler: (i: any) => resizeVideo(i).then(p => ({ output_file: p })) },
  { name: 'extract_audio', description: 'Extract audio from video', schema: Schemas.ExtractAudioInputSchema, handler: (i: any) => extractAudio(i).then(p => ({ output_file: p })) },
  { name: 'replace_audio', description: 'Replace or mix audio track', schema: Schemas.ReplaceAudioInputSchema, handler: (i: any) => replaceAudio(i).then(p => ({ output_file: p })) },
  { name: 'add_text_overlay', description: 'Burn text into video', schema: Schemas.AddTextOverlayInputSchema, handler: (i: any) => addTextOverlay(i).then(p => ({ output_file: p })) },
  { name: 'add_subtitles', description: 'Add subtitle track', schema: Schemas.AddSubtitlesInputSchema, handler: (i: any) => addSubtitles(i).then(p => ({ output_file: p })) },
  { name: 'change_speed', description: 'Change video playback speed', schema: Schemas.ChangeSpeedInputSchema, handler: (i: any) => changeSpeed(i).then(p => ({ output_file: p })) },
  { name: 'export_video', description: 'Re-encode and export video', schema: Schemas.ExportVideoInputSchema, handler: (i: any) => exportVideo(i).then(p => ({ output_file: p })) },
];
