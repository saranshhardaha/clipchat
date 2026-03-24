import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { apiKeys } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { AppError } from '../../types/job.js';

declare global {
  namespace Express {
    interface Request { apiKeyId?: string }
  }
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next(new AppError(401, 'Missing API key'));
  const key = auth.slice(7);
  const hash = createHash('sha256').update(key).digest('hex');
  const [record] = await db.select().from(apiKeys).where(eq(apiKeys.key_hash, hash));
  if (!record) return next(new AppError(401, 'Invalid API key'));
  req.apiKeyId = record.id;
  next();
}
