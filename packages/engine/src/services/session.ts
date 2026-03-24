import { eq, and, asc } from 'drizzle-orm';
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions.js';
import { db } from '../db/index.js';
import { sessions, chatMessages } from '../db/schema.js';
import type { Session, ChatMessage } from '../types/chat.js';

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export async function createSession(apiKeyId: string, firstMessage: string): Promise<Session> {
  const id = generateId('ses');
  const title = firstMessage.slice(0, 60);
  const now = new Date();
  await db.insert(sessions).values({ id, api_key_id: apiKeyId, title, created_at: now, updated_at: now });
  return { id, api_key_id: apiKeyId, title, created_at: now, updated_at: now };
}

export async function getSession(sessionId: string, apiKeyId: string): Promise<Session | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.api_key_id, apiKeyId)));
  if (!row) return null;
  return row as Session;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at));
  return rows as ChatMessage[];
}

export async function saveUserMessage(sessionId: string, content: string): Promise<ChatMessage> {
  const id = generateId('msg');
  const created_at = new Date();
  await db.insert(chatMessages).values({ id, session_id: sessionId, role: 'user', content, tool_calls: null, tool_call_id: null, created_at });
  return { id, session_id: sessionId, role: 'user', content, tool_calls: null, tool_call_id: null, created_at };
}

export async function saveAssistantMessage(
  sessionId: string,
  content: string,
  toolCalls: ChatCompletionMessageToolCall[] | null,
): Promise<ChatMessage> {
  const id = generateId('msg');
  const created_at = new Date();
  await db.insert(chatMessages).values({
    id, session_id: sessionId, role: 'assistant', content,
    tool_calls: toolCalls as unknown as Record<string, unknown>[] | null,
    tool_call_id: null, created_at,
  });
  await db.update(sessions).set({ updated_at: new Date() }).where(eq(sessions.id, sessionId));
  return { id, session_id: sessionId, role: 'assistant', content, tool_calls: toolCalls, tool_call_id: null, created_at };
}

export async function saveToolMessage(sessionId: string, toolCallId: string, content: string): Promise<ChatMessage> {
  const id = generateId('msg');
  const created_at = new Date();
  await db.insert(chatMessages).values({ id, session_id: sessionId, role: 'tool', content, tool_calls: null, tool_call_id: toolCallId, created_at });
  return { id, session_id: sessionId, role: 'tool', content, tool_calls: null, tool_call_id: toolCallId, created_at };
}

// Converts DB message rows into the OpenAI ChatCompletionMessageParam[] format.
// Tool results must appear as role='tool' messages immediately after the assistant
// message that contained the matching tool_calls — this is the OpenAI API requirement.
export function buildMessageHistory(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        result.push({ role: 'assistant', content: msg.content, tool_calls: msg.tool_calls });
      } else {
        result.push({ role: 'assistant', content: msg.content });
      }
    } else if (msg.role === 'tool' && msg.tool_call_id) {
      result.push({ role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content });
    }
  }

  return result;
}
