import { getVideoInfo } from '../ffmpeg/info.js';
import { trimVideo } from '../ffmpeg/trim.js';
import { compressVideo } from '../ffmpeg/compress.js';
import { mergeClips } from '../ffmpeg/merge.js';
import { resizeVideo } from '../ffmpeg/resize.js';
import { extractAudio, replaceAudio, normalizeAudio, fadeAudio } from '../ffmpeg/audio.js';
import { addTextOverlay, addSubtitles } from '../ffmpeg/text.js';
import { changeSpeed } from '../ffmpeg/speed.js';
import { exportVideo } from '../ffmpeg/export.js';
import { cropVideo, rotateFlip, colorAdjust } from '../ffmpeg/adjust.js';
import { generateThumbnail } from '../ffmpeg/thumbnail.js';
import * as Schemas from '../types/tools.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MCP_TOOLS = [
  { name: 'get_video_info', description: 'Get video file metadata', schema: Schemas.GetVideoInfoInputSchema, handler: getVideoInfo },
  { name: 'trim_video', description: 'Trim a video between two timestamps', schema: Schemas.TrimVideoInputSchema, handler: (i: any) => trimVideo(i).then(p => ({ output_file: p })) },
  { name: 'merge_clips', description: 'Merge multiple video clips with optional transitions (fade, slideleft, slideright, wipeleft, dissolve, zoomin, and more)', schema: Schemas.MergeClipsInputSchema, handler: (i: any) => mergeClips(i).then(p => ({ output_file: p })) },
  { name: 'resize_video', description: 'Resize or change aspect ratio', schema: Schemas.ResizeVideoInputSchema, handler: (i: any) => resizeVideo(i).then(p => ({ output_file: p })) },
  { name: 'crop_video', description: 'Crop video to a region or preset (square_center, portrait_center, landscape_center)', schema: Schemas.CropVideoInputSchema, handler: (i: any) => cropVideo(i).then(p => ({ output_file: p })) },
  { name: 'rotate_flip', description: 'Rotate video 90/180/270 degrees or flip horizontally/vertically', schema: Schemas.RotateFlipInputSchema, handler: (i: any) => rotateFlip(i).then(p => ({ output_file: p })) },
  { name: 'color_adjust', description: 'Adjust brightness, contrast, saturation, gamma, and hue', schema: Schemas.ColorAdjustInputSchema, handler: (i: any) => colorAdjust(i).then(p => ({ output_file: p })) },
  { name: 'extract_audio', description: 'Extract audio from video', schema: Schemas.ExtractAudioInputSchema, handler: (i: any) => extractAudio(i).then(p => ({ output_file: p })) },
  { name: 'replace_audio', description: 'Replace or mix audio track', schema: Schemas.ReplaceAudioInputSchema, handler: (i: any) => replaceAudio(i).then(p => ({ output_file: p })) },
  { name: 'add_text_overlay', description: 'Burn text into video', schema: Schemas.AddTextOverlayInputSchema, handler: (i: any) => addTextOverlay(i).then(p => ({ output_file: p })) },
  { name: 'add_subtitles', description: 'Add subtitle track', schema: Schemas.AddSubtitlesInputSchema, handler: (i: any) => addSubtitles(i).then(p => ({ output_file: p })) },
  { name: 'change_speed', description: 'Change video playback speed', schema: Schemas.ChangeSpeedInputSchema, handler: (i: any) => changeSpeed(i).then(p => ({ output_file: p })) },
  { name: 'export_video', description: 'Re-encode and export video', schema: Schemas.ExportVideoInputSchema, handler: (i: any) => exportVideo(i).then(p => ({ output_file: p })) },
  { name: 'compress_video', description: 'Compress video with preset (web/mobile/whatsapp/telegram/archive) or target_size_mb for exact file size', schema: Schemas.CompressVideoInputSchema, handler: (i: any) => compressVideo(i).then(p => ({ output_file: p })) },
  { name: 'generate_thumbnail', description: 'Extract a thumbnail image frame from a video at a given timestamp', schema: Schemas.GenerateThumbnailInputSchema, handler: (i: any) => generateThumbnail(i).then(p => ({ output_file: p })) },
  { name: 'normalize_audio', description: 'Normalize audio loudness to a target LUFS level', schema: Schemas.NormalizeAudioInputSchema, handler: (i: any) => normalizeAudio(i).then(p => ({ output_file: p })) },
  { name: 'fade_audio', description: 'Apply fade in and/or fade out to audio', schema: Schemas.FadeAudioInputSchema, handler: (i: any) => fadeAudio(i).then(p => ({ output_file: p })) },
];
