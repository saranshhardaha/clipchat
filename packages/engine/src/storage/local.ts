import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync } from 'fs';
import { unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import type { Readable } from 'stream';
import type { StorageAdapter, FileRecord } from '../types/storage.js';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string = './uploads') {}

  async save(stream: Readable, originalName: string, mimeType: string, sizeBytes: number): Promise<FileRecord> {
    if (!existsSync(this.baseDir)) await mkdir(this.baseDir, { recursive: true });
    const id = uuid();
    const ext = originalName.split('.').pop() ?? 'bin';
    const savedName = `${id}.${ext}`;
    const filePath = join(this.baseDir, savedName);
    await pipeline(stream, createWriteStream(filePath));
    return {
      id,
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      path: filePath,
      url: `/files/${id}`,
      created_at: new Date(),
    };
  }

  async delete(_fileId: string, filePath?: string): Promise<void> {
    if (filePath) await unlink(filePath).catch(() => {});
  }
}
