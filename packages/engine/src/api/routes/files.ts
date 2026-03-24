import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { createStorage } from '../../storage/index.js';
import { AppError } from '../../types/job.js';
import { db } from '../../db/index.js';
import { files } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

router.post('/files/upload', upload.single('file'), async (req, res, next) => {
  if (!req.file) return next(new AppError(400, 'No file uploaded'));
  const { path: tmpPath, originalname, mimetype, size } = req.file;
  try {
    const storage = createStorage();
    const stream = createReadStream(tmpPath);
    const record = await storage.save(stream, originalname, mimetype, size);
    await db.insert(files).values({
      id: record.id,
      original_name: record.original_name,
      mime_type: record.mime_type,
      size_bytes: record.size_bytes,
      path: record.path,
      url: record.url,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const [record] = await db.select().from(files).where(eq(files.id, req.params.id));
    if (!record) throw new AppError(404, 'File not found');
    res.json(record);
  } catch (err) { next(err); }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const storage = createStorage();
    await storage.delete(req.params.id);
    await db.delete(files).where(eq(files.id, req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/files/:id/content', async (req, res, next) => {
  try {
    const [record] = await db.select().from(files).where(eq(files.id, req.params.id));
    if (!record) throw new AppError(404, 'File not found');
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Accept-Ranges', 'bytes');
    createReadStream(record.path).pipe(res);
  } catch (err) { next(err); }
});

export default router;
