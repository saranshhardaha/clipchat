import { describe, it, expect, beforeAll } from 'vitest';
import { createReadStream, existsSync, statSync } from 'fs';
import { LocalStorageAdapter } from '../src/storage/local.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let savedPath: string;

  beforeAll(() => {
    adapter = new LocalStorageAdapter('./test-uploads');
  });

  it('saves a file and returns a FileRecord', async () => {
    const sizeBytes = statSync(TEST_VIDEO).size;
    const stream = createReadStream(TEST_VIDEO);
    const record = await adapter.save(stream, 'test.mp4', 'video/mp4', sizeBytes);
    savedPath = record.path;
    expect(record.id).toBeTruthy();
    expect(record.size_bytes).toBe(sizeBytes);
    expect(record.path).toContain(record.id);
    expect(existsSync(record.path)).toBe(true);
  });

  it('does not expose getPath or getUrl methods', () => {
    // These were removed — callers should use the DB files.path column instead
    expect((adapter as unknown as Record<string, unknown>).getPath).toBeUndefined();
    expect((adapter as unknown as Record<string, unknown>).getUrl).toBeUndefined();
  });

  it('delete with filePath removes the file from disk', async () => {
    await adapter.delete('any-id', savedPath);
    expect(existsSync(savedPath)).toBe(false);
  });

  it('delete without filePath does not throw', async () => {
    await expect(adapter.delete('nonexistent-id')).resolves.not.toThrow();
  });
});
