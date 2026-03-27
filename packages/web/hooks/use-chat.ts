'use client';

import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import { getSessionMessages, type ChatMessage } from '@/lib/engine-client';
import { useInvalidateSessions } from './use-sessions-list';

export interface ToolCallCard {
  id: string;
  tool: string;
  job_id: string;
  input: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCallCard[];
  hasError?: boolean;
  errorMessage?: string;
}

interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  sessionId: string | null;
  sendMessage: (text: string, fileId?: string) => Promise<void>;
}

// Convert DB ChatMessage rows to display Messages
function dbMessagesToDisplay(dbMessages: ChatMessage[]): Message[] {
  const result: Message[] = [];

  for (const msg of dbMessages) {
    // Skip 'tool' role messages — they're internal to the AI conversation
    if (msg.role === 'tool') continue;

    if (msg.role === 'user') {
      result.push({
        id: msg.id,
        role: 'user',
        content: msg.content,
        toolCalls: [],
      });
    } else if (msg.role === 'assistant') {
      const toolCalls: ToolCallCard[] = [];
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolCalls.push({
            id: tc.id,
            tool: tc.function.name,
            job_id: '',
            input: (() => {
              try { return JSON.parse(tc.function.arguments); } catch { return {}; }
            })(),
          });
        }
      }
      result.push({
        id: msg.id,
        role: 'assistant',
        content: msg.content,
        toolCalls,
      });
    }
  }

  // Populate job_ids from tool messages
  const toolMsgMap = new Map<string, string>(); // tool_call_id -> job_id
  for (const msg of dbMessages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      try {
        const parsed = JSON.parse(msg.content) as { job_id?: string };
        if (parsed.job_id) {
          toolMsgMap.set(msg.tool_call_id, parsed.job_id);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  for (const msg of result) {
    if (msg.role === 'assistant') {
      for (const tc of msg.toolCalls) {
        const jobId = toolMsgMap.get(tc.id);
        if (jobId) tc.job_id = jobId;
      }
    }
  }

  return result;
}

export function useChat(initialSessionId?: string): UseChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef(false);
  const pendingDelta = useRef('');
  const rafId = useRef<number | null>(null);
  const setMessagesRef = useRef(setMessages) as MutableRefObject<typeof setMessages>;
  setMessagesRef.current = setMessages;
  // Ref always holds latest sessionId — avoids stale closure in async SSE handler
  const sessionIdRef = useRef<string | null>(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  const invalidateSessions = useInvalidateSessions();

  // Load existing session messages on mount
  useEffect(() => {
    if (!initialSessionId || loadedRef.current) return;
    loadedRef.current = true;

    getSessionMessages(initialSessionId)
      .then((dbMessages) => {
        setMessages(dbMessagesToDisplay(dbMessages));
      })
      .catch(console.error);
  }, [initialSessionId]);

  const sendMessage = useCallback(
    async (text: string, fileId?: string) => {
      if (isStreaming) return;

      const userMsg: Message = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        toolCalls: [],
      };
      const assistantMsg: Message = {
        id: `local-asst-${Date.now()}`,
        role: 'assistant',
        content: '',
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            session_id: sessionIdRef.current ?? undefined,
            file_id: fileId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          // Surface the actual engine error message
          let errMsg = `Chat request failed (${res.status})`;
          try {
            const txt = await res.text();
            const parsed = JSON.parse(txt) as { error?: string; message?: string };
            errMsg = parsed.error ?? parsed.message ?? txt.slice(0, 200) ?? errMsg;
          } catch { /* use default */ }
          throw new Error(errMsg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() ?? '';

            for (const block of blocks) {
              if (!block.trim()) continue;

              const lines = block.split('\n');
              let eventName = '';
              let dataStr = '';

              for (const line of lines) {
                if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
              }

              if (!dataStr) continue;

              let payload: Record<string, unknown>;
              try {
                payload = JSON.parse(dataStr) as Record<string, unknown>;
              } catch {
                continue;
              }

              if (eventName === 'text') {
                const delta = payload.delta as string;
                pendingDelta.current += delta;
                if (!rafId.current) {
                  rafId.current = requestAnimationFrame(() => {
                    const accumulated = pendingDelta.current;
                    pendingDelta.current = '';
                    rafId.current = null;
                    setMessagesRef.current((prev) =>
                      prev.map((m, i) =>
                        i === prev.length - 1
                          ? { ...m, content: m.content + accumulated }
                          : m
                      )
                    );
                  });
                }
              } else if (eventName === 'tool_call') {
                const card: ToolCallCard = {
                  id: `tc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  tool: payload.tool as string,
                  job_id: payload.job_id as string,
                  input: (payload.input as Record<string, unknown>) ?? {},
                };
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, toolCalls: [...m.toolCalls, card] }
                      : m
                  )
                );
              } else if (eventName === 'done') {
                const newSessionId = payload.session_id as string;
                const realMsgId = payload.message_id as string;
                const isNewSession = !sessionIdRef.current;
                setSessionId(newSessionId);
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, id: realMsgId } : m
                  )
                );
                // Update URL without remounting the component (avoids DB reload race)
                if (isNewSession) {
                  window.history.pushState({}, '', `/chat/${newSessionId}`);
                }
              } else if (eventName === 'error') {
                const errorMessage = payload.message as string | undefined;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, hasError: true, errorMessage } : m
                  )
                );
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          const errorMessage = err instanceof Error ? err.message : undefined;
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, hasError: true, errorMessage } : m
            )
          );
        }
      } finally {
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
          rafId.current = null;
          const remaining = pendingDelta.current;
          pendingDelta.current = '';
          if (remaining) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: m.content + remaining } : m
              )
            );
          }
        }
        setIsStreaming(false);
        invalidateSessions();
      }
    },
    [isStreaming, invalidateSessions]
  );

  return { messages, isStreaming, sessionId, sendMessage };
}
