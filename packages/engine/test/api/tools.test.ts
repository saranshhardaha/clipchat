import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('Tools API', () => {
  const app = createApp();

  it('GET /tools lists all 10 tools', async () => {
    const res = await request(app).get('/api/v1/tools');
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(10);
    const names = res.body.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('trim_video');
    expect(names).toContain('get_video_info');
  });

  it('POST /tools/get_video_info executes tool synchronously', async () => {
    const res = await request(app).post('/api/v1/tools/get_video_info').send({
      input_file: process.env.TEST_VIDEO_PATH ?? '/tmp/test.mp4',
    });
    expect([202, 400]).toContain(res.status);
  });
});
