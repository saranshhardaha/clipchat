import { describe, it, expect, afterAll } from 'vitest';
import { db } from '../src/db/index.js';
import { jobs, files, apiKeys } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

describe('Database schema', () => {
  const fileId = uuid();
  const jobId = `job_${uuid().slice(0, 8)}`;

  it('inserts and retrieves a file record', async () => {
    await db.insert(files).values({
      id: fileId,
      original_name: 'test.mp4',
      mime_type: 'video/mp4',
      size_bytes: 1024,
      path: '/uploads/test.mp4',
      url: 'http://localhost/files/test.mp4',
    });
    const [file] = await db.select().from(files).where(eq(files.id, fileId));
    expect(file.original_name).toBe('test.mp4');
  });

  it('inserts and retrieves a job record', async () => {
    await db.insert(jobs).values({
      id: jobId,
      status: 'queued',
      tool: 'trim_video',
      input: { input_file: '/tmp/test.mp4', start_time: '0', end_time: '5' },
      output: null,
      progress: 0,
      error: null,
      file_id: fileId,
    });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect(job.status).toBe('queued');
    expect(job.tool).toBe('trim_video');
  });

  afterAll(async () => {
    await db.delete(jobs).where(eq(jobs.id, jobId));
    await db.delete(files).where(eq(files.id, fileId));
  });
});
