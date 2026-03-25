import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { createApp } from '../../src/api/index.js';
import { db } from '../../src/db/index.js';
import { apiKeys, sessions, chatMessages } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Sessions API', () => {
  const app = createApp();
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_sessions_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'sessions-test' });
  });

  afterAll(async () => {
    // Only delete the API key — cascade will remove sessions and chatMessages for this key
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('GET /sessions returns 401 without API key', async () => {
    const res = await request(app).get('/api/v1/sessions');
    expect(res.status).toBe(401);
  });

  it('GET /sessions returns empty array for a new API key', async () => {
    const res = await request(app)
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions).toHaveLength(0);
  });

  it('GET /sessions returns pagination fields limit and offset', async () => {
    const res = await request(app)
      .get('/api/v1/sessions?limit=2&offset=0')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('limit', 2);
    expect(res.body).toHaveProperty('offset', 0);
  });

  it('GET /sessions/:id/messages returns 404 for unknown session id', async () => {
    const res = await request(app)
      .get('/api/v1/sessions/ses_doesnotexist/messages')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(404);
  });
});
