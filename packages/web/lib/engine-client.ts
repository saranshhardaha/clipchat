// Types mirroring packages/engine (no build-time dependency)

export interface FileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  path: string;
  created_at: string;
}

export interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  progress: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Session {
  id: string;
  api_key_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> | null;
  tool_call_id: string | null;
  created_at: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

export async function uploadFile(formData: FormData): Promise<FileRecord> {
  // Do NOT set Content-Type — browser sets it with the multipart boundary automatically
  const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return res.json();
}

export async function getFileMetadata(id: string): Promise<FileRecord> {
  return apiFetch<FileRecord>(`/api/files/${id}`);
}

export function getFileContentUrl(id: string): string {
  return `/api/files/${id}/content`;
}

export async function getJob(id: string): Promise<Job> {
  return apiFetch<Job>(`/api/jobs/${id}`);
}

export async function getSessions(): Promise<Session[]> {
  const data = await apiFetch<{ sessions: Session[] }>('/api/sessions');
  return data.sessions;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const data = await apiFetch<{ messages: ChatMessage[] }>(`/api/sessions/${sessionId}/messages`);
  return data.messages;
}
