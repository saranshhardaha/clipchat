import type { ChatCompletionMessageToolCall, ChatCompletionTool } from 'openai/resources/chat/completions.js';

export interface ChatRequest {
  session_id?: string;
  message: string;
  file_id?: string;
}

export interface Session {
  id: string;
  api_key_id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: ChatCompletionMessageToolCall[] | null;
  tool_call_id: string | null;
  created_at: Date;
}

export interface TextEvent {
  delta: string;
}

export interface ToolCallEvent {
  tool: string;
  job_id: string;
  input: Record<string, unknown>;
}

export interface DoneEvent {
  session_id: string;
  message_id: string;
}

export interface ErrorEvent {
  message: string;
}

// Re-export for convenience
export type { ChatCompletionMessageToolCall, ChatCompletionTool };
