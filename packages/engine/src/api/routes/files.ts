import { Router } from 'express';
import multer from 'multer';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { createStorage } from '../../storage/index.js';
import { AppError } from '../../types/job.js';
import type { FileRecord } from '../../types/storage.js';
import { db } from '../../db/index.js';
import { files } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 * 1024 } });
const fileCache = new Map<string, FileRecord>();

router.post('/files/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const storage = createStorage();
    const record = await storage.save(Readable.from(req.file.buffer), req.file.originalname, req.file.mimetype, req.file.size);
    fileCache.set(record.id, record);
    await db.insert(files).values({
      id: record.id,
      original_name: record.original_name,
      mime_type: record.mime_type,
      size_bytes: record.size_bytes,
      path: record.path,
      url: record.url,
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const record = fileCache.get(req.params.id);
    if (!record) throw new AppError(404, 'File not found');
    res.json(record);
  } catch (err) { next(err); }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const storage = createStorage();
    await storage.delete(req.params.id);
    fileCache.delete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/files/:id/content', async (req, res, next) => {
  try {
    let record = fileCache.get(req.params.id) as import('../../types/storage.js').FileRecord | undefined;
    if (!record) {
      const [dbRecord] = await db.select().from(files).where(eq(files.id, req.params.id));
      if (!dbRecord) throw new AppError(404, 'File not found');
      record = dbRecord as import('../../types/storage.js').FileRecord;
    }
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Accept-Ranges', 'bytes');
    createReadStream(record.path).pipe(res);
  } catch (err) { next(err); }
});

export default router;
