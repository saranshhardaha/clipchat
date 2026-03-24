import { Router } from 'express';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { submitJob, getQueue } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';

const router = Router();

router.post('/jobs', async (req, res, next) => {
  try {
    const { tool, input } = req.body as { tool: ToolName; input: Record<string, unknown> };
    if (!tool || !input) throw new AppError(400, 'tool and input are required');
    const jobId = await submitJob(tool, input);
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
