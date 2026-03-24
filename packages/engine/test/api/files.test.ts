import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('Files API', () => {
  const app = createApp();
  let fileId: string;

  it('POST /files/upload accepts a video file', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload')
      .attach('file', TEST_VIDEO);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.mime_type).toContain('video');
    fileId = res.body.id;
  });

  it('GET /files/:id returns file metadata', async () => {
    const res = await request(app).get(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fileId);
  });

  it('DELETE /files/:id removes the file', async () => {
    const res = await request(app).delete(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(204);
  });

  it('GET /files/:id returns 404 after deletion', async () => {
    const res = await request(app).get(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(404);
  });
});
