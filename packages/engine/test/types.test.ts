import { describe, it, expect } from 'vitest';
import { TrimVideoInputSchema, GetVideoInfoOutputSchema } from '../src/types/tools.js';
import type { Job } from '../src/types/job.js';

describe('Tool schemas', () => {
  it('validates trim_video input', () => {
    const result = TrimVideoInputSchema.safeParse({
      input_file: '/tmp/test.mp4',
      start_time: '00:00:05',
      end_time: '00:01:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid trim_video input', () => {
    const result = TrimVideoInputSchema.safeParse({ input_file: 123 });
    expect(result.success).toBe(false);
  });
});

describe('Job types', () => {
  it('Job type is structurally correct', () => {
    const job: Job = {
      id: 'job_abc',
      status: 'queued',
      tool: 'trim_video',
      input: { input_file: 'f.mp4', start_time: '0', end_time: '5' },
      output: null,
      progress: 0,
      error: null,
      created_at: new Date(),
      completed_at: null,
    };
    expect(job.status).toBe('queued');
  });
});
