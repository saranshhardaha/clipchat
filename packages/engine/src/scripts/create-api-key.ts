import { randomBytes, createHash } from 'crypto';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import { v4 as uuid } from 'uuid';

const label = process.argv[2] ?? 'default';
const key = `clp_${randomBytes(32).toString('hex')}`;
const hash = createHash('sha256').update(key).digest('hex');

await db.insert(apiKeys).values({ id: uuid(), key_hash: hash, label });
console.log(`API key created for "${label}":\n${key}\n\nStore this safely — it will not be shown again.`);
process.exit(0);
