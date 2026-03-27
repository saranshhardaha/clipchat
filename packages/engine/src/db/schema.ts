import { pgTable, text, integer, jsonb, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

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
}, (t) => ({
  idx_jobs_file_id: index('idx_jobs_file_id').on(t.file_id),
}));

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  key_hash: text('key_hash').notNull().unique(),
  label: text('label').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  api_key_id: text('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  title: text('title'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  idx_sessions_api_key_id: index('idx_sessions_api_key_id').on(t.api_key_id),
  idx_sessions_updated_at: index('idx_sessions_updated_at').on(t.updated_at),
}));

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'tool'
  content: text('content').notNull(),
  tool_calls: jsonb('tool_calls'), // ChatCompletionMessageToolCall[] for assistant messages
  tool_call_id: text('tool_call_id'),  // links tool-result row to its tool call
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idx_chat_messages_session_id: index('idx_chat_messages_session_id').on(t.session_id),
  idx_chat_messages_created_at: index('idx_chat_messages_created_at').on(t.created_at),
}));
