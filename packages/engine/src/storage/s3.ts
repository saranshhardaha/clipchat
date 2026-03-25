import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import type { Readable } from 'stream';
import type { StorageAdapter, FileRecord } from '../types/storage.js';

export class S3StorageAdapter implements StorageAdapter {
  private s3: S3Client;
  private records = new Map<string, { key: string }>();

  constructor(
    private readonly bucket: string,
    region: string = 'us-east-1',
    endpoint?: string,
  ) {
    this.s3 = new S3Client({ region, endpoint });
  }

  async save(stream: Readable, originalName: string, mimeType: string, sizeBytes: number): Promise<FileRecord> {
    const id = uuid();
    const ext = originalName.split('.').pop() ?? 'bin';
    const key = `uploads/${id}.${ext}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    }));
    const record: FileRecord = {
      id,
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      path: `s3://${this.bucket}/${key}`,
      url: await this.getSignedDownloadUrl(key),
      created_at: new Date(),
    };
    this.records.set(id, { key });
    return record;
  }

  async delete(fileId: string, filePath?: string): Promise<void> {
    const entry = this.records.get(fileId);
    let key: string | undefined;
    if (entry) {
      key = entry.key;
    } else if (filePath?.startsWith(`s3://${this.bucket}/`)) {
      // Derive key from stored path: s3://bucket/uploads/id.ext → uploads/id.ext
      key = filePath.slice(`s3://${this.bucket}/`.length);
    }
    if (!key) return;
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.records.delete(fileId);
  }

  private async getSignedDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }
}
