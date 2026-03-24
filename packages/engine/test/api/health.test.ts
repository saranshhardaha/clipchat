import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBeTruthy();
  });
});
