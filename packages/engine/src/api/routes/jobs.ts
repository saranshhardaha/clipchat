import { Router } from 'express';
import fs, { createReadStream } from 'fs';
import path from 'path';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { submitJob, generateJobId, getQueue, getQueueEvents } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';
import type { JobProgress } from 'bullmq';
import {
  TrimVideoInputSchema, MergeClipsInputSchema, AddSubtitlesInputSchema,
  AddTextOverlayInputSchema, ResizeVideoInputSchema, ExtractAudioInputSchema,
  ReplaceAudioInputSchema, ChangeSpeedInputSchema, ExportVideoInputSchema,
  GetVideoInfoInputSchema, CropVideoInputSchema, RotateFlipInputSchema,
  ColorAdjustInputSchema, CompressVideoInputSchema,
} from '../../types/tools.js';

const TOOL_SCHEMAS: Record<string, { safeParse(v: unknown): { success: boolean; error?: { issues: { message: string }[] }; data?: unknown } }> = {
  trim_video:        TrimVideoInputSchema,
  merge_clips:       MergeClipsInputSchema,
  add_subtitles:     AddSubtitlesInputSchema,
  add_text_overlay:  AddTextOverlayInputSchema,
  resize_video:      ResizeVideoInputSchema,
  crop_video:        CropVideoInputSchema,
  rotate_flip:       RotateFlipInputSchema,
  color_adjust:      ColorAdjustInputSchema,
  extract_audio:     ExtractAudioInputSchema,
  replace_audio:     ReplaceAudioInputSchema,
  change_speed:      ChangeSpeedInputSchema,
  export_video:      ExportVideoInputSchema,
  get_video_info:    GetVideoInfoInputSchema,
  compress_video:    CompressVideoInputSchema,
};

const router = Router();

router.post('/jobs', async (req, res, next) => {
  try {
    const { tool, input } = req.body;
    if (!tool || typeof tool !== 'string' || !TOOL_SCHEMAS[tool]) {
      throw new AppError(400, `Unknown tool: ${tool}`);
    }
    if (input === undefined || input === null) {
      throw new AppError(400, 'input is required');
    }
    const parsed = TOOL_SCHEMAS[tool].safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, parsed.error!.issues.map(i => i.message).join('; '));
    }
    const jobId = generateJobId();
    await db.insert(jobs).values({
      id: jobId, status: 'queued', tool, input, output: null, progress: 0, error: null,
    });
    await submitJob(tool as ToolName, parsed.data as Record<string, unknown>, jobId);
    res.status(202).json({ id: jobId, status: 'queued', tool, input, output: null, progress: 0, error: null });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) throw new AppError(404, 'Job not found');
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/jobs/:id/stream', async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new AppError(404, 'Job not found');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    // If already finished, send final state and close immediately
    if (job.status === 'completed' || job.status === 'failed') {
      send(job);
      res.end();
      return;
    }

    const queueEvents = getQueueEvents();

    const onProgress = ({ jobId: id, data }: { jobId: string; data: JobProgress }) => {
      if (id !== jobId) return;
      send({ id: jobId, status: 'processing', progress: data });
    };

    const onCompleted = async ({ jobId: id }: { jobId: string }) => {
      if (id !== jobId) return;
      const [current] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (current) send(current);
      cleanup();
    };

    const onFailed = async ({ jobId: id }: { jobId: string }) => {
      if (id !== jobId) return;
      const [current] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (current) send(current);
      cleanup();
    };

    function cleanup() {
      req.off('close', cleanup);
      queueEvents.off('progress', onProgress);
      queueEvents.off('completed', onCompleted);
      queueEvents.off('failed', onFailed);
      if (!res.writableEnded) res.end();
    }

    queueEvents.on('progress', onProgress);
    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);

    req.on('close', cleanup);

    // Send initial state so client has current progress
    send(job);

  } catch (err) { next(err); }
});

// Serve the output file produced by a completed job (temp path stored in job.output)
router.get('/jobs/:id/output-content', async (req, res, next) => {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) throw new AppError(404, 'Job not found');
    if (job.status !== 'completed') throw new AppError(400, 'Job not completed');

    const outputPath = typeof job.output === 'string' ? job.output : null;
    if (!outputPath) throw new AppError(400, 'Job has no file output');

    const stat = await fs.promises.stat(outputPath);
    const fileSize = stat.size;
    const ext = path.extname(outputPath).slice(1).toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      gif: 'image/gif', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
    };
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = range.match(/^bytes=(\d+)-(\d*)$/);
      if (!match) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (start > end || start >= fileSize || end >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      createReadStream(outputPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      createReadStream(outputPath).pipe(res);
    }
  } catch (err) { next(err); }
});

router.delete('/jobs/:id', async (req, res, next) => {
  try {
    const queue = getQueue();
    const bullJob = await queue.getJob(req.params.id);
    if (!bullJob) throw new AppError(404, 'Job not found');
    const state = await bullJob.getState();
    if (state === 'completed' || state === 'failed') {
      res.status(409).json({ error: 'Job already finished' });
      return;
    }
    await bullJob.remove();
    await db.update(jobs).set({ status: 'failed', error: 'Cancelled by user' }).where(eq(jobs.id, req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
