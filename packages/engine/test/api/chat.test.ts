import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';

// Mock the ai/tools module so we never hit real OpenRouter.
// Must be called before any imports that transitively load the module.
vi.mock('../../src/ai/tools.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ai/tools.js')>();

  // Default mock: returns a simple text reply, no tool calls
  const makeTextStream = (text: string) =>
    (async function* () {
      yield { choices: [{ delta: { content: text }, finish_reason: null }] };
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
    })();

  const mockCreate = vi.fn().mockImplementation(() =>
    makeTextStream('I can help you with video editing!')
  );

  return {
    ...actual,
    buildOpenRouterTools: actual.buildOpenRouterTools,
    createOpenRouterClient: vi.fn().mockReturnValue({
      chat: { completions: { create: mockCreate } },
    }),
    // expose mockCreate so individual tests can override it
    _mockCreate: mockCreate,
  };
});

import { createApp } from '../../src/api/index.js';
import { db } from '../../src/db/index.js';
import { apiKeys, sessions, chatMessages, jobs } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

// Helper: collect full SSE body from a supertest response
function parseSseBody(body: string) {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = body.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    const eventLine = lines.find(l => l.startsWith('event:'));
    const dataLine = lines.find(l => l.startsWith('data:'));
    if (eventLine && dataLine) {
      events.push({
        event: eventLine.slice('event:'.length).trim(),
        data: JSON.parse(dataLine.slice('data:'.length).trim()),
      });
    }
  }
  return events;
}

async function sseRequest(app: ReturnType<typeof createApp>, apiKey: string, body: object) {
  const res = await request(app)
    .post('/api/v1/chat')
    .set('Authorization', `Bearer ${apiKey}`)
    .set('Accept', 'text/event-stream')
    .send(body)
    .buffer(true)
    .parse((res, callback) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => callback(null, data));
    });
  return { status: res.status, events: parseSseBody(String(res.body)) };
}

describe('Chat API', () => {
  const app = createApp();
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    // Create a real API key in the test DB
    apiKey = randomBytes(32).toString('hex');
    apiKeyId = `key_test_chat_${Date.now().toString(36)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await db.insert(apiKeys).values({ id: apiKeyId, key_hash: keyHash, label: 'chat-test' });
  });

  afterAll(async () => {
    // Delete chat_messages and sessions (cascade from this test's api key).
    // Do NOT delete all jobs — the e2e test may still be polling its own jobs.
    await db.delete(chatMessages);
    await db.delete(sessions);
    await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
  });

  it('POST /chat returns 401 without API key', async () => {
    const res = await request(app).post('/api/v1/chat').send({ message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('POST /chat returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /chat creates a new session and streams text + done events', async () => {
    const { status, events } = await sseRequest(app, apiKey, { message: 'What tools are available?' });

    expect(status).toBe(200);
    const textEvents = events.filter(e => e.event === 'text');
    const doneEvents = events.filter(e => e.event === 'done');

    expect(textEvents.length).toBeGreaterThan(0);
    expect(doneEvents.length).toBe(1);

    const done = doneEvents[0].data as { session_id: string; message_id: string };
    expect(done.session_id).toMatch(/^ses_/);
    expect(done.message_id).toMatch(/^msg_/);
  });

  it('POST /chat reuses an existing session', async () => {
    // First message — creates session
    const { events: events1 } = await sseRequest(app, apiKey, { message: 'Hello' });
    const done1 = events1.find(e => e.event === 'done')?.data as { session_id: string };
    expect(done1.session_id).toMatch(/^ses_/);

    // Second message — reuses session
    const { events: events2 } = await sseRequest(app, apiKey, {
      message: 'Follow-up question',
      session_id: done1.session_id,
    });
    const done2 = events2.find(e => e.event === 'done')?.data as { session_id: string };
    expect(done2.session_id).toBe(done1.session_id);

    // Both user + assistant messages persisted
    const msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.session_id, done1.session_id));
    expect(msgs.length).toBeGreaterThanOrEqual(4); // user+assistant x2
  });

  it('POST /chat returns 404 for unknown session_id', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ message: 'hello', session_id: 'ses_doesnotexist' });
    expect(res.status).toBe(404);
  });

  it('POST /chat emits tool_call event when model returns a tool call', async () => {
    // Override mock for this test to simulate a tool_use response
    const { createOpenRouterClient } = await import('../../src/ai/tools.js');
    (createOpenRouterClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockReturnValue(
            (async function* () {
              yield { choices: [{ delta: { content: "I'll trim your video now." }, finish_reason: null }] };
              yield {
                choices: [{
                  delta: {
                    tool_calls: [{
                      index: 0,
                      id: 'call_abc123',
                      function: {
                        name: 'trim_video',
                        arguments: '{"input_file":"/tmp/test.mp4","start_time":"0","end_time":"5"}',
                      },
                    }],
                  },
                  finish_reason: null,
                }],
              };
              yield { choices: [{ delta: {}, finish_reason: 'tool_calls' }] };
            })()
          ),
        },
      },
    });

    const { status, events } = await sseRequest(app, apiKey, { message: 'Trim to 0-5 seconds' });

    expect(status).toBe(200);
    const toolEvents = events.filter(e => e.event === 'tool_call');
    expect(toolEvents.length).toBe(1);

    const tc = toolEvents[0].data as { tool: string; job_id: string; input: Record<string, unknown> };
    expect(tc.tool).toBe('trim_video');
    expect(tc.job_id).toMatch(/^job_/);

    // Verify job was inserted in DB
    const [job] = await db.select().from(jobs).where(eq(jobs.id, tc.job_id));
    expect(job).toBeDefined();
    expect(job.tool).toBe('trim_video');
    expect(job.status).toBe('queued');
  });
});
