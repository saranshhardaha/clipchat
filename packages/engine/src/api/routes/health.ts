import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version ?? '0.1.0' });
});

export default router;
