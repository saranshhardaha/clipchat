import { Queue, QueueEvents } from 'bullmq';
import type { ToolName } from '../types/job.js';

const QUEUE_NAME = 'clipchat-jobs';

let _queue: Queue | null = null;

export function getQueue(): Queue {
  if (_queue) return _queue;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };
  _queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail:    { count: 100 },
    },
  });
  return _queue;
}

let _queueEvents: QueueEvents | null = null;

export function getQueueEvents(): QueueEvents {
  if (_queueEvents) return _queueEvents;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };
  _queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  return _queueEvents;
}

export function generateJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function submitJob(tool: ToolName, input: Record<string, unknown>, jobId?: string): Promise<string> {
  const id = jobId ?? generateJobId();
  await getQueue().add(id, { tool, input }, { jobId: id });
  return id;
}
