import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('Jobs API', () => {
  const app = createApp();
  let jobId: string;

  it('POST /jobs submits a job and returns a job ID', async () => {
    const res = await request(app).post('/api/v1/jobs').send({
      tool: 'get_video_info',
      input: { input_file: '/tmp/test.mp4' },
    });
    expect(res.status).toBe(202);
    expect(res.body.id).toMatch(/^job_/);
    expect(res.body.status).toBe('queued');
    jobId = res.body.id;
  });

  it('GET /jobs/:id returns job status', async () => {
    const res = await request(app).get(`/api/v1/jobs/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(['queued', 'processing', 'completed']).toContain(res.body.status);
  });

  it('DELETE /jobs/:id cancels a job', async () => {
    const res = await request(app).delete(`/api/v1/jobs/${jobId}`);
    expect([204, 409]).toContain(res.status);
  });
});
