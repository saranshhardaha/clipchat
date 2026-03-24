import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { LocalStorageAdapter } from '../src/storage/local.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let fileId: string;

  beforeAll(() => {
    adapter = new LocalStorageAdapter('./test-uploads');
  });

  it('saves a file and returns a FileRecord', async () => {
    const buffer = readFileSync(TEST_VIDEO);
    const record = await adapter.save(buffer, 'test.mp4', 'video/mp4');
    fileId = record.id;
    expect(record.id).toBeTruthy();
    expect(record.size_bytes).toBe(buffer.length);
    expect(record.path).toContain(record.id);
    expect(existsSync(record.path)).toBe(true);
  });

  it('getPath returns the file path', async () => {
    const path = await adapter.getPath(fileId);
    expect(existsSync(path)).toBe(true);
  });

  it('delete removes the file', async () => {
    const path = await adapter.getPath(fileId);
    await adapter.delete(fileId);
    expect(existsSync(path)).toBe(false);
  });
});
