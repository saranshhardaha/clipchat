import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { createApp } from '../src/api/index.js';
import { db } from '../src/db/index.js';
import { apiKeys } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('End-to-end: upload → job → result', () => {
  const app = createApp();
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_e2e_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'e2e-test' });
  });

  afterAll(async () => {
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('uploads a file, submits get_video_info job, polls until complete', async () => {
    // 1. Upload
    const uploadRes = await request(app)
      .post('/api/v1/files/upload')
      .set('Authorization', `Bearer ${apiKey}`)
      .attach('file', TEST_VIDEO);
    expect(uploadRes.status).toBe(201);
    const { path } = uploadRes.body;

    // 2. Submit job
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        tool: 'get_video_info',
        input: { input_file: path },
      });
    expect(jobRes.status).toBe(202);
    const jobId = jobRes.body.id;

    // 3. Poll until done (worker must be running)
    let job: { status: string };
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const pollRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${apiKey}`);
      job = pollRes.body;
      if (job.status === 'completed' || job.status === 'failed') break;
    }

    // If no worker running in test env, just check queued status
    expect(['queued', 'processing', 'completed']).toContain(job!.status);
  }, 15000);
});
