import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import type { StorageAdapter, FileRecord } from '../types/storage.js';
import { AppError } from '../types/job.js';

export class LocalStorageAdapter implements StorageAdapter {
  private records = new Map<string, FileRecord>();

  constructor(private readonly baseDir: string = './uploads') {}

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<FileRecord> {
    if (!existsSync(this.baseDir)) await mkdir(this.baseDir, { recursive: true });
    const id = uuid();
    const ext = filename.split('.').pop() ?? 'bin';
    const savedName = `${id}.${ext}`;
    const path = join(this.baseDir, savedName);
    await writeFile(path, buffer);
    const record: FileRecord = {
      id,
      original_name: filename,
      mime_type: mimeType,
      size_bytes: buffer.length,
      path,
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
