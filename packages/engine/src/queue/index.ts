import { Queue } from 'bullmq';
import type { ToolName } from '../types/job.js';

const QUEUE_NAME = 'clipchat-jobs';

let _queue: Queue | null = null;

export function getQueue(): Queue {
  if (_queue) return _queue;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };
  _queue = new Queue(QUEUE_NAME, { connection });
  return _queue;
}

export async function submitJob(tool: ToolName, input: Record<string, unknown>): Promise<string> {
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await getQueue().add(jobId, { tool, input }, { jobId });
  return jobId;
}
