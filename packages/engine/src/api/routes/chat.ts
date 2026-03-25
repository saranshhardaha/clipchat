import { Router } from 'express';
import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions.js';
import { db } from '../../db/index.js';
import { jobs, files } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { submitJob } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';
import type { ChatRequest } from '../../types/chat.js';
import { buildOpenRouterTools, createOpenRouterClient } from '../../ai/tools.js';
import {
  createSession, getSession, getSessionMessages,
  saveUserMessage, saveAssistantMessage, saveToolMessage, buildMessageHistory,
} from '../../services/session.js';

const DEFAULT_SYSTEM = 'You are a video editing assistant. You can edit videos using the provided tools. When the user asks you to edit a video, call the appropriate tool. Briefly explain what you are doing.';

const router = Router();

router.post('/chat', async (req, res, next) => {
  let headersFlushed = false;

  const sendEvent = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { session_id, message, file_id } = req.body as ChatRequest;
    if (!message?.trim()) throw new AppError(400, 'message is required');

    const apiKeyId = req.apiKeyId!;

    // Resolve or create session
    let session;
    if (session_id) {
      session = await getSession(session_id, apiKeyId);
      if (!session) throw new AppError(404, `Session '${session_id}' not found`);
    } else {
      session = await createSession(apiKeyId, message);
    }

    // Build system prompt, optionally injecting file path
    let systemPrompt = DEFAULT_SYSTEM;
    if (file_id) {
      const [fileRecord] = await db.select().from(files).where(eq(files.id, file_id));
      if (!fileRecord) throw new AppError(404, `File '${file_id}' not found`);
      const filePath = fileRecord.path;
      systemPrompt = `${DEFAULT_SYSTEM}\n\nThe user's video file is at path: ${filePath}. Use this as the input_file parameter in tool calls unless the user specifies otherwise.`;
    }

    // Persist user message + build history for Claude
    await saveUserMessage(session.id, message);
    const allMessages = await getSessionMessages(session.id);
    const messageHistory = buildMessageHistory(allMessages);

    // Start SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    headersFlushed = true;

    const client = createOpenRouterClient();
    const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-opus-4';

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messageHistory],
      tools: buildOpenRouterTools(),
      tool_choice: 'auto',
    });

    // Accumulate streamed content
    let fullText = '';
    // tool_calls arrive in delta chunks and must be assembled by index
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        fullText += delta.content;
        sendEvent('text', { delta: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, { id: '', name: '', arguments: '' });
          }
          const entry = toolCallMap.get(idx)!;
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name; // name arrives once, not chunked
          if (tc.function?.arguments) entry.arguments += tc.function.arguments; // args are chunked
        }
      }
    }

    // Process all accumulated tool calls
    const completedToolCalls: ChatCompletionMessageToolCall[] = [];

    for (const [, tc] of [...toolCallMap.entries()].sort(([a], [b]) => a - b)) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.arguments);
      } catch {
        input = {};
      }

      const jobId = await submitJob(tc.name as ToolName, input);
      await db.insert(jobs).values({
        id: jobId, status: 'queued', tool: tc.name, input, output: null, progress: 0, error: null,
      });

      sendEvent('tool_call', { tool: tc.name, job_id: jobId, input });

      await saveToolMessage(session.id, tc.id, JSON.stringify({ job_id: jobId }));

      completedToolCalls.push({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      });
    }

    // Persist assistant message
    const assistantMsg = await saveAssistantMessage(
      session.id,
      fullText,
      completedToolCalls.length > 0 ? completedToolCalls : null,
    );

    sendEvent('done', { session_id: session.id, message_id: assistantMsg.id });
    res.end();

  } catch (err) {
    if (headersFlushed) {
      const msg = err instanceof Error ? err.message : 'Internal server error';
      sendEvent('error', { message: msg });
      res.end();
    } else {
      next(err);
    }
  }
});

export default router;
