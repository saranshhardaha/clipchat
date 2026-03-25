import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { createApp } from '../../src/api/index.js';
import { db } from '../../src/db/index.js';
import { apiKeys } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Jobs API', () => {
  const app = createApp();
  let jobId: string;
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_jobs_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'jobs-test' });
  });

  afterAll(async () => {
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('POST /jobs returns 400 for an unknown tool name', async () => {
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ tool: 'not_a_real_tool', input: {} });
    expect(res.status).toBe(400);
  });

  it('POST /jobs submits a job and returns a job ID', async () => {
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        tool: 'get_video_info',
        input: { input_file: '/tmp/test.mp4' },
      });
    expect(res.status).toBe(202);
    expect(res.body.id).toMatch(/^job_/);
    expect(res.body.status).toBe('queued');
    jobId = res.body.id;
  });

  it('GET /jobs/:id returns job status', async () => {
    const res = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(['queued', 'processing', 'completed']).toContain(res.body.status);
  });

  it('DELETE /jobs/:id cancels a job', async () => {
    const res = await request(app)
      .delete(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect([204, 409]).toContain(res.status);
  });
});
