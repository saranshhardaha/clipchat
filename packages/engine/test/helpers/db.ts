import { db } from '../../src/db/index.js';
import { jobs, files, apiKeys, chatMessages, sessions } from '../../src/db/schema.js';

export async function truncateAll() {
  await db.delete(jobs);
  await db.delete(chatMessages);
  await db.delete(sessions);
  await db.delete(files);
  await db.delete(apiKeys);
}
