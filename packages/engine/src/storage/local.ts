import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync } from 'fs';
import { unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import type { Readable } from 'stream';
import type { StorageAdapter, FileRecord } from '../types/storage.js';
import { AppError } from '../types/job.js';

export class LocalStorageAdapter implements StorageAdapter {
  private records = new Map<string, FileRecord>();

  constructor(private readonly baseDir: string = './uploads') {}

  async save(stream: Readable, originalName: string, mimeType: string, sizeBytes: number): Promise<FileRecord> {
    if (!existsSync(this.baseDir)) await mkdir(this.baseDir, { recursive: true });
    const id = uuid();
    const ext = originalName.split('.').pop() ?? 'bin';
    const savedName = `${id}.${ext}`;
    const filePath = join(this.baseDir, savedName);
    await pipeline(stream, createWriteStream(filePath));
    const record: FileRecord = {
      id,
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      path: filePath,
      url: `/files/${id}`,
      created_at: new Date(),
    };
    this.records.set(id, record);
    return record;
  }

  async getPath(fileId: string): Promise<string> {
    const record = this.records.get(fileId);
    if (!record) throw new AppError(404, `File ${fileId} not found`);
    return record.path;
  }

  async getUrl(fileId: string): Promise<string> {
    const record = this.records.get(fileId);
    if (!record) throw new AppError(404, `File ${fileId} not found`);
    return record.url;
  }

  async delete(fileId: string): Promise<void> {
    const record = this.records.get(fileId);
    if (!record) return;
    await unlink(record.path).catch(() => {});
    this.records.delete(fileId);
  }
}
