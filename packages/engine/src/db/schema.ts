import { pgTable, text, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', ['queued', 'processing', 'completed', 'failed']);

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  original_name: text('original_name').notNull(),
  mime_type: text('mime_type').notNull(),
  size_bytes: integer('size_bytes').notNull(),
  path: text('path').notNull(),
  url: text('url').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  status: jobStatusEnum('status').default('queued').notNull(),
  tool: text('tool').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  progress: integer('progress').default(0).notNull(),
  error: text('error'),
  file_id: text('file_id').references(() => files.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  key_hash: text('key_hash').notNull().unique(),
  label: text('label').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
