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
  save(buffer: Buffer, filename: string, mimeType: string): Promise<FileRecord>;
  getPath(fileId: string): Promise<string>;
  getUrl(fileId: string): Promise<string>;
  delete(fileId: string): Promise<void>;
}
