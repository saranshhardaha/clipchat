import { Router } from 'express';
import { db } from '../../db/index.js';
import { sessions, chatMessages } from '../../db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';

const router = Router();

router.get('/sessions', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.api_key_id, req.apiKeyId!))
      .orderBy(desc(sessions.updated_at))
      .limit(limit)
      .offset(offset);
    res.json({ sessions: rows, limit, offset });
  } catch (err) { next(err); }
});

router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, req.params.id));
    if (!session || session.api_key_id !== req.apiKeyId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.session_id, req.params.id))
      .orderBy(asc(chatMessages.created_at));
    res.json({ messages });
  } catch (err) { next(err); }
});

export default router;
