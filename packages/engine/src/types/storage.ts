import type { Readable } from 'stream';

export interface FileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  path: string;
  created_at: Date;
}

export interface StorageAdapter {
  save(stream: Readable, originalName: string, mimeType: string, sizeBytes: number): Promise<FileRecord>;
  delete(fileId: string, filePath?: string): Promise<void>;
}
