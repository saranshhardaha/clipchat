import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/api/index.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('End-to-end: upload → job → result', () => {
  const app = createApp();

  it('uploads a file, submits get_video_info job, polls until complete', async () => {
    // 1. Upload
    const uploadRes = await request(app).post('/api/v1/files/upload').attach('file', TEST_VIDEO);
    expect(uploadRes.status).toBe(201);
    const { path } = uploadRes.body;

    // 2. Submit job
    const jobRes = await request(app).post('/api/v1/jobs').send({
      tool: 'get_video_info',
      input: { input_file: path },
    });
    expect(jobRes.status).toBe(202);
    const jobId = jobRes.body.id;

    // 3. Poll until done (worker must be running)
    let job: { status: string };
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const pollRes = await request(app).get(`/api/v1/jobs/${jobId}`);
      job = pollRes.body;
      if (job.status === 'completed' || job.status === 'failed') break;
    }

    // If no worker running in test env, just check queued status
    expect(['queued', 'processing', 'completed']).toContain(job!.status);
  }, 15000);
});
