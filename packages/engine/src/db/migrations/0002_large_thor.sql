CREATE INDEX IF NOT EXISTS "idx_chat_messages_session_id" ON "chat_messages" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_messages_created_at" ON "chat_messages" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_file_id" ON "jobs" ("file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_api_key_id" ON "sessions" ("api_key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_updated_at" ON "sessions" ("updated_at");