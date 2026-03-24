import { Worker, type Job } from 'bullmq';
import { db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getVideoInfo } from '../ffmpeg/info.js';
import { trimVideo } from '../ffmpeg/trim.js';
import { mergeClips } from '../ffmpeg/merge.js';
import { resizeVideo } from '../ffmpeg/resize.js';
import { extractAudio, replaceAudio } from '../ffmpeg/audio.js';
import { addTextOverlay, addSubtitles } from '../ffmpeg/text.js';
import { changeSpeed } from '../ffmpeg/speed.js';
import { exportVideo } from '../ffmpeg/export.js';
import type { ToolName } from '../types/job.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_MAP: Record<ToolName, (input: any, onProgress: (p: number) => void) => Promise<any>> = {
  get_video_info: (i) => getVideoInfo(i),
  trim_video: (i, p) => trimVideo(i, p),
  merge_clips: (i, p) => mergeClips(i, p),
  resize_video: (i, p) => resizeVideo(i, p),
  extract_audio: (i, p) => extractAudio(i, p),
  replace_audio: (i, p) => replaceAudio(i, p),
  add_text_overlay: (i, p) => addTextOverlay(i, p),
  add_subtitles: (i, p) => addSubtitles(i, p),
  change_speed: (i, p) => changeSpeed(i, p),
  export_video: (i, p) => exportVideo(i, p),
};

export function createWorker() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };

  return new Worker('clipchat-jobs', async (job: Job) => {
    const { tool, input } = job.data as { tool: ToolName; input: Record<string, unknown> };

    await db.update(jobs).set({ status: 'processing', progress: 0 }).where(eq(jobs.id, job.id!));

    const onProgress = async (percent: number) => {
      await job.updateProgress(percent);
      await db.update(jobs).set({ progress: Math.floor(percent) }).where(eq(jobs.id, job.id!));
    };

    const handler = TOOL_MAP[tool];
    if (!handler) throw new Error(`Unknown tool: ${tool}`);

    const output = await handler(input, onProgress);
    await db.update(jobs).set({ status: 'completed', output, progress: 100, completed_at: new Date() })
      .where(eq(jobs.id, job.id!));

    return output;
  }, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  });
}
