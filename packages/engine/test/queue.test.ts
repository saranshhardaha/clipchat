import { describe, it, expect, afterAll } from 'vitest';
import { submitJob, getQueue } from '../src/queue/index.js';

describe('Job queue', () => {
  it('adds a job to the queue', async () => {
    const jobId = await submitJob('get_video_info', { input_file: '/tmp/test.mp4' });
    expect(jobId).toMatch(/^job_/);
    const queue = getQueue();
    const job = await queue.getJob(jobId);
    expect(job?.data.tool).toBe('get_video_info');
  });

  afterAll(async () => {
    await getQueue().obliterate({ force: true });
    await getQueue().close();
  });
});
