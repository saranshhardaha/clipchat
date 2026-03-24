import type { StorageAdapter } from '../types/storage.js';
import { LocalStorageAdapter } from './local.js';
import { S3StorageAdapter } from './s3.js';

let _storage: StorageAdapter | null = null;

export function createStorage(): StorageAdapter {
  if (_storage) return _storage;
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    _storage = new S3StorageAdapter(bucket, process.env.AWS_REGION, process.env.S3_ENDPOINT);
  } else {
    _storage = new LocalStorageAdapter(process.env.UPLOAD_DIR ?? './uploads');
  }
  return _storage;
}

export function resetStorage() { _storage = null; }
