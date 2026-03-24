export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ToolName =
  | 'trim_video' | 'merge_clips' | 'add_subtitles' | 'add_text_overlay'
  | 'resize_video' | 'extract_audio' | 'replace_audio' | 'change_speed'
  | 'export_video' | 'get_video_info';

export interface Job {
  id: string;
  status: JobStatus;
  tool: ToolName;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  progress: number;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
