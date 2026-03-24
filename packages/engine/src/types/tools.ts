import { z } from 'zod';

export const TrimVideoInputSchema = z.object({
  input_file: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  output_format: z.string().optional(),
});

export const MergeClipsInputSchema = z.object({
  input_files: z.array(z.string()).min(2),
  transition: z.enum(['none', 'fade', 'crossfade']).default('none'),
  transition_duration: z.number().positive().default(0.5),
});

export const AddSubtitlesInputSchema = z.object({
  input_file: z.string(),
  subtitle_source: z.string(),
  style: z.object({
    font_size: z.number().optional(),
    font_color: z.string().optional(),
    position: z.enum(['bottom', 'top', 'center']).default('bottom'),
  }).optional(),
  burn_in: z.boolean().default(true),
});

export const AddTextOverlayInputSchema = z.object({
  input_file: z.string(),
  text: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  position: z.object({ x: z.string(), y: z.string() }).optional(),
  style: z.object({
    font: z.string().default('Arial'),
    size: z.number().default(24),
    color: z.string().default('white'),
    background_color: z.string().optional(),
  }).optional(),
});

export const ResizeVideoInputSchema = z.object({
  input_file: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  preset: z.enum(['1080p', '720p', '4k', 'square', '9:16', '16:9']).optional(),
  pad: z.boolean().default(false),
});

export const ExtractAudioInputSchema = z.object({
  input_file: z.string(),
  format: z.enum(['mp3', 'aac', 'wav']).default('mp3'),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const ReplaceAudioInputSchema = z.object({
  input_file: z.string(),
  audio_file: z.string(),
  mix: z.boolean().default(false),
  audio_volume: z.number().min(0).max(2).default(1),
  original_volume: z.number().min(0).max(2).default(0),
});

export const ChangeSpeedInputSchema = z.object({
  input_file: z.string(),
  speed_factor: z.number().min(0.25).max(4),
  preserve_audio_pitch: z.boolean().default(true),
});

export const ExportVideoInputSchema = z.object({
  input_file: z.string(),
  format: z.enum(['mp4', 'webm', 'mov', 'gif']),
  codec: z.enum(['h264', 'h265', 'vp9', 'av1']).optional(),
  quality: z.enum(['low', 'medium', 'high', 'lossless']).default('medium'),
  target_size_mb: z.number().positive().optional(),
  resolution: z.string().optional(),
});

export const GetVideoInfoInputSchema = z.object({
  input_file: z.string(),
});

export const GetVideoInfoOutputSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  codec: z.string(),
  audio_codec: z.string().nullable(),
  size_bytes: z.number(),
  bitrate: z.number(),
});

export type TrimVideoInput = z.infer<typeof TrimVideoInputSchema>;
export type MergeClipsInput = z.infer<typeof MergeClipsInputSchema>;
export type AddSubtitlesInput = z.infer<typeof AddSubtitlesInputSchema>;
export type AddTextOverlayInput = z.infer<typeof AddTextOverlayInputSchema>;
export type ResizeVideoInput = z.infer<typeof ResizeVideoInputSchema>;
export type ExtractAudioInput = z.infer<typeof ExtractAudioInputSchema>;
export type ReplaceAudioInput = z.infer<typeof ReplaceAudioInputSchema>;
export type ChangeSpeedInput = z.infer<typeof ChangeSpeedInputSchema>;
export type ExportVideoInput = z.infer<typeof ExportVideoInputSchema>;
export type GetVideoInfoInput = z.infer<typeof GetVideoInfoInputSchema>;
export type GetVideoInfoOutput = z.infer<typeof GetVideoInfoOutputSchema>;
