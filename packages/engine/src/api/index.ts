import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import filesRouter from './routes/files.js';
import jobsRouter from './routes/jobs.js';
import toolsRouter from './routes/tools.js';
import chatRouter from './routes/chat.js';
import sessionsRouter from './routes/sessions.js';
import { requireApiKey } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);
  app.use('/api/v1', filesRouter);
  app.use('/api/v1', jobsRouter);
  app.use('/api/v1', toolsRouter);
  app.use('/api/v1', requireApiKey, chatRouter);
  app.use('/api/v1', requireApiKey, sessionsRouter);
  app.use(errorHandler);
  return app;
}
