import { Router } from 'express';
import multer from 'multer';
import { createStorage } from '../../storage/index.js';
import { AppError } from '../../types/job.js';
import type { FileRecord } from '../../types/storage.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 * 1024 } });
const fileCache = new Map<string, FileRecord>();

router.post('/files/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const storage = createStorage();
    const record = await storage.save(req.file.buffer, req.file.originalname, req.file.mimetype);
    fileCache.set(record.id, record);
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

export default router;
