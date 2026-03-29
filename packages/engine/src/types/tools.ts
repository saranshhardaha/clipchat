import { z } from 'zod';

export const TrimVideoInputSchema = z.object({
  input_file: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  output_format: z.string().optional(),
});

export const MergeClipsInputSchema = z.object({
  input_files: z.array(z.string()).min(2),
  transition: z.enum([
    'none', 'fade', 'crossfade',
    'slideleft', 'slideright', 'slideup', 'slidedown',
    'wipeleft', 'wiperight', 'wipeup', 'wipedown',
    'dissolve', 'pixelize', 'zoomin',
    'fadeblack', 'fadewhite',
    'circleopen', 'circleclose',
  ]).default('none'),
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

export const CropVideoInputSchema = z.object({
  input_file: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  preset: z.enum(['square_center', 'portrait_center', 'landscape_center']).optional(),
});

export const RotateFlipInputSchema = z.object({
  input_file: z.string(),
  rotation: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional(),
  flip: z.enum(['horizontal', 'vertical', 'both']).optional(),
});

export const ColorAdjustInputSchema = z.object({
  input_file: z.string(),
  brightness: z.number().min(-1).max(1).optional(),
  contrast: z.number().min(0).max(2).optional(),
  saturation: z.number().min(0).max(3).optional(),
  gamma: z.number().min(0.1).max(10).optional(),
  hue: z.number().min(-180).max(180).optional(),
});

export const CompressVideoInputSchema = z.object({
  input_file: z.string(),
  preset: z.enum(['web', 'mobile', 'whatsapp', 'telegram', 'archive']),
  target_size_mb: z.number().positive().optional(),
});

export const GenerateThumbnailInputSchema = z.object({
  input_file: z.string(),
  timestamp: z.string(),
  format: z.enum(['jpg', 'png', 'webp']).default('jpg'),
  width: z.number().int().positive().optional(),
});

export const NormalizeAudioInputSchema = z.object({
  input_file: z.string(),
  target_lufs: z.number().min(-24).max(-5).default(-14),
  true_peak: z.number().min(-9).max(0).default(-1),
});

export const FadeAudioInputSchema = z.object({
  input_file: z.string(),
  fade_in_duration: z.number().min(0).default(0),
  fade_out_duration: z.number().min(0).default(0),
});

export const AddWatermarkInputSchema = z.object({
  input_file: z.string(),
  watermark_file: z.string(),
  position: z.enum(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center']).default('bottom_right'),
  opacity: z.number().min(0).max(1).default(1),
  scale: z.number().min(0.01).max(1).default(0.15),
  margin: z.number().int().min(0).default(10),
});

export const CreateGifInputSchema = z.object({
  input_file: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  fps: z.number().min(1).max(30).default(10),
  width: z.number().int().positive().default(480),
  optimize: z.boolean().default(true),
});

export const BlurRegionInputSchema = z.object({
  input_file: z.string(),
  preset: z.enum(['face_top_center', 'lower_third', 'full_frame']).optional(),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  blur_strength: z.number().min(1).max(20).default(10),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
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
export type CropVideoInput = z.infer<typeof CropVideoInputSchema>;
export type RotateFlipInput = z.infer<typeof RotateFlipInputSchema>;
export type ColorAdjustInput = z.infer<typeof ColorAdjustInputSchema>;
export type CompressVideoInput = z.infer<typeof CompressVideoInputSchema>;
export type GenerateThumbnailInput = z.infer<typeof GenerateThumbnailInputSchema>;
export type NormalizeAudioInput = z.infer<typeof NormalizeAudioInputSchema>;
export type FadeAudioInput = z.infer<typeof FadeAudioInputSchema>;
export type AddWatermarkInput = z.infer<typeof AddWatermarkInputSchema>;
export type CreateGifInput = z.infer<typeof CreateGifInputSchema>;
export type BlurRegionInput = z.infer<typeof BlurRegionInputSchema>;
