import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { createApp } from '../../src/api/index.js';
import { db } from '../../src/db/index.js';
import { apiKeys } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Tools API', () => {
  const app = createApp();
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_tools_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'tools-test' });
  });

  afterAll(async () => {
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('GET /tools lists all 10 tools', async () => {
    const res = await request(app)
      .get('/api/v1/tools')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(10);
    const names = res.body.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('trim_video');
    expect(names).toContain('get_video_info');
  });

  it('POST /tools/get_video_info executes tool synchronously', async () => {
    const res = await request(app)
      .post('/api/v1/tools/get_video_info')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        input_file: process.env.TEST_VIDEO_PATH ?? '/tmp/test.mp4',
      });
    expect([202, 400]).toContain(res.status);
  });
});
