import { describe, it, expect } from 'vitest';
import { db } from '../../src/db/index.js';
import { sql } from 'drizzle-orm';

describe('DB indexes', () => {
  it('has all required performance indexes', async () => {
    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('sessions', 'chat_messages', 'jobs')
      AND indexname IN (
        'idx_sessions_api_key_id',
        'idx_sessions_updated_at',
        'idx_chat_messages_session_id',
        'idx_chat_messages_created_at',
        'idx_jobs_file_id'
      )
    `);
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    expect(rows.length).toBe(5);
  });
});
