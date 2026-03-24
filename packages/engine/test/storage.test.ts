import { describe, it, expect, beforeAll } from 'vitest';
import { createReadStream, existsSync, statSync } from 'fs';
import { LocalStorageAdapter } from '../src/storage/local.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let fileId: string;

  beforeAll(() => {
    adapter = new LocalStorageAdapter('./test-uploads');
  });

  it('saves a file and returns a FileRecord', async () => {
    const sizeBytes = statSync(TEST_VIDEO).size;
    const stream = createReadStream(TEST_VIDEO);
    const record = await adapter.save(stream, 'test.mp4', 'video/mp4', sizeBytes);
    fileId = record.id;
    expect(record.id).toBeTruthy();
    expect(record.size_bytes).toBe(sizeBytes);
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
