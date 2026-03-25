import { Router } from 'express';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { submitJob, getQueue } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';
import {
  TrimVideoInputSchema, MergeClipsInputSchema, AddSubtitlesInputSchema,
  AddTextOverlayInputSchema, ResizeVideoInputSchema, ExtractAudioInputSchema,
  ReplaceAudioInputSchema, ChangeSpeedInputSchema, ExportVideoInputSchema,
  GetVideoInfoInputSchema,
} from '../../types/tools.js';

const TOOL_SCHEMAS: Record<string, { safeParse(v: unknown): { success: boolean; error?: { issues: { message: string }[] }; data?: unknown } }> = {
  trim_video:        TrimVideoInputSchema,
  merge_clips:       MergeClipsInputSchema,
  add_subtitles:     AddSubtitlesInputSchema,
  add_text_overlay:  AddTextOverlayInputSchema,
  resize_video:      ResizeVideoInputSchema,
  extract_audio:     ExtractAudioInputSchema,
  replace_audio:     ReplaceAudioInputSchema,
  change_speed:      ChangeSpeedInputSchema,
  export_video:      ExportVideoInputSchema,
  get_video_info:    GetVideoInfoInputSchema,
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
    const jobId = await submitJob(tool as ToolName, parsed.data as Record<string, unknown>);
    await db.insert(jobs).values({
      id: jobId, status: 'queued', tool, input, output: null, progress: 0, error: null,
    });
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
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) throw new AppError(404, 'Job not found');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const poll = setInterval(async () => {
      const [current] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
      if (!current) { clearInterval(poll); res.end(); return; }
      send(current);
      if (current.status === 'completed' || current.status === 'failed') {
        clearInterval(poll); res.end();
      }
    }, 500);
    req.on('close', () => clearInterval(poll));
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
