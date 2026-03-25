import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import { createHash, randomBytes } from 'crypto';
import { createApp } from '../../src/api/index.js';
import { db } from '../../src/db/index.js';
import { apiKeys } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('Files API', () => {
  const app = createApp();
  let fileId: string;
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_files_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'files-test' });
  });

  afterAll(async () => {
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('POST /files/upload returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload')
      .attach('file', TEST_VIDEO);
    expect(res.status).toBe(401);
  });

  it('POST /files/upload returns 415 for a text/html file', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload')
      .set('Authorization', `Bearer ${apiKey}`)
      .attach('file', Buffer.from('<html></html>'), { filename: 'page.html', contentType: 'text/html' });
    expect(res.status).toBe(415);
  });

  it('POST /files/upload accepts a video file', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload')
      .set('Authorization', `Bearer ${apiKey}`)
      .attach('file', TEST_VIDEO);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.mime_type).toContain('video');
    fileId = res.body.id;
  });

  it('GET /files/:id returns file metadata', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fileId);
  });

  it('DELETE /files/:id removes the file', async () => {
    // First fetch the record to capture the on-disk path before deletion
    const metaRes = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(metaRes.status).toBe(200);
    const filePath: string = metaRes.body.path;

    const res = await request(app)
      .delete(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(204);

    // Verify the file was actually removed from disk
    await expect(fs.promises.access(filePath)).rejects.toThrow();
  });

  it('GET /files/:id returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /files/:id/content range requests', () => {
  const app = createApp();
  let rangeFileId: string;
  let rangeApiKey: string;
  let rangeApiKeyId: string;

  beforeAll(async () => {
    rangeApiKey = randomBytes(32).toString('hex');
    rangeApiKeyId = `key_test_range_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(rangeApiKey).digest('hex');
    await db.insert(apiKeys).values({ id: rangeApiKeyId, key_hash: keyHash, label: 'range-test' });

    // Upload a 1000-byte file for range testing
    const res = await request(app)
      .post('/api/v1/files/upload')
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .attach('file', Buffer.alloc(1000), { filename: 'range-test.mp4', contentType: 'video/mp4' });
    rangeFileId = res.body.id;
  });

  afterAll(async () => {
    await db.delete(apiKeys).where(eq(apiKeys.id, rangeApiKeyId));
  });

  it('returns 206 with Content-Range for a valid range', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .set('Range', 'bytes=0-99');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-99/1000');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('returns 206 for open-ended range (bytes=500-)', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .set('Range', 'bytes=500-');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 500-999/1000');
  });

  it('returns 416 for malformed Range header', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .set('Range', 'bytes=abc-def');
    expect(res.status).toBe(416);
    expect(res.headers['content-range']).toBe('bytes */1000');
  });

  it('returns 416 when start > end', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .set('Range', 'bytes=500-100');
    expect(res.status).toBe(416);
  });

  it('returns 416 when range is out of file bounds', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`)
      .set('Range', 'bytes=0-9999');
    expect(res.status).toBe(416);
  });

  it('returns 200 with Accept-Ranges when no Range header', async () => {
    const res = await request(app)
      .get(`/api/v1/files/${rangeFileId}/content`)
      .set('Authorization', `Bearer ${rangeApiKey}`);
    expect(res.status).toBe(200);
    expect(res.headers['accept-ranges']).toBe('bytes');
  });
});
