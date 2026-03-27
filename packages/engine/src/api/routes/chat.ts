import { Router } from 'express';
import path from 'path';
import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions.js';
import { db } from '../../db/index.js';
import { jobs, files, chatMessages } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { submitJob, generateJobId } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';
import type { ChatRequest } from '../../types/chat.js';
import { buildOpenRouterTools, createOpenRouterClient } from '../../ai/tools.js';
import {
  createSession, getSession, getSessionMessages,
  saveUserMessage, saveAssistantMessage, saveToolMessage, buildMessageHistory,
} from '../../services/session.js';

const DEFAULT_SYSTEM = `You are ClipChat, a professional video editing assistant powered by FFmpeg. You edit videos through natural language by calling the appropriate tools.

## Tools

**Info**
- get_video_info — read duration, dimensions, fps, codec, file size. Call this first when you need to know the video's properties.

**Cutting & Combining**
- trim_video — extract a segment (start_time and end_time in seconds or HH:MM:SS)
- merge_clips — concatenate clips with optional transitions:
  - Fades: fade, crossfade, fadeblack, fadewhite
  - Slides: slideleft, slideright, slideup, slidedown
  - Wipes: wipeleft, wiperight, wipeup, wipedown
  - Special: dissolve, pixelize, zoomin, circleopen, circleclose

**Transform**
- resize_video — scale to dimensions or preset (1080p, 720p, 4k, square, 9:16, 16:9)
- crop_video — crop to region or preset (square_center, portrait_center, landscape_center)
- rotate_flip — rotate 90/180/270° and/or flip horizontal, vertical, or both

**Color**
- color_adjust — brightness (-1 to 1), contrast (0–2), saturation (0–3), gamma (0.1–10), hue (-180 to 180)

**Audio**
- extract_audio — save audio track as mp3/aac/wav
- replace_audio — swap or mix audio tracks with per-track volume control

**Text & Titles**
- add_text_overlay — burn text with custom position, font, size, color, and timing
- add_subtitles — add SRT/ASS file (burn-in or soft embed)

**Speed**
- change_speed — slow down or speed up (0.25× to 4×)

**Export**
- export_video — re-encode to mp4/webm/mov/gif with quality (low/medium/high/lossless) and codec control

## Key Rules

1. **Chain tools**: The output_file from one tool becomes the input_file for the next. Never re-use the original file after it has been processed — always chain from the last output.
2. **Get info first** when you need duration or dimensions for calculations (e.g., computing trim points, choosing crop dimensions).
3. **Common workflows**:
   - Social media clip: trim_video → crop_video (square_center) → resize_video (1080p) → export_video
   - Highlight reel: multiple trim_video → merge_clips (with transition) → add_text_overlay → export_video
   - Color grade: color_adjust → export_video (high quality)
   - Reframe for portrait: crop_video (portrait_center) → resize_video (9:16)
4. **Be concise**: 1–2 sentences explaining what you're doing. Don't over-explain.`;


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

    // Build system prompt, injecting the file path for tool calls
    let systemPrompt = DEFAULT_SYSTEM;
    if (file_id) {
      const [fileRecord] = await db.select().from(files).where(eq(files.id, file_id));
      if (!fileRecord) throw new AppError(404, `File '${file_id}' not found`);
      const filePath = fileRecord.path;
      const fileName = path.basename(filePath);
      systemPrompt = `${DEFAULT_SYSTEM}\n\nThe user's video file is at path: ${filePath} (filename: ${fileName}). Use this as the input_file parameter in tool calls unless the user specifies otherwise.`;
    }

    // Persist user message + build history for LLM
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
    const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-5';

    // --- First LLM call: stream text + collect tool calls ---
    const abort1 = new AbortController();
    const abort1Timer = setTimeout(() => abort1.abort(), 45_000);

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messageHistory],
      tools: buildOpenRouterTools(),
      tool_choice: 'auto',
    }, { signal: abort1.signal });

    // Accumulate streamed content
    let fullText = '';
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

    try {
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
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.arguments += tc.function.arguments;
          }
        }
      }
    } finally {
      clearTimeout(abort1Timer);
    }

    // --- Process accumulated tool calls: submit jobs ---
    const completedToolCalls: ChatCompletionMessageToolCall[] = [];
    const toolCallJobs: Array<{ toolCallId: string; jobId: string }> = [];
    // Collect for later persistence (after assistant message)
    const toolMessagesToSave: Array<{ toolCallId: string; content: string }> = [];

    for (const [, tc] of [...toolCallMap.entries()].sort(([a], [b]) => a - b)) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.arguments);
      } catch (parseErr) {
        console.warn(`[chat] Failed to parse tool call arguments for ${tc.name}:`, parseErr);
        input = {};
      }

      const jobId = generateJobId();
      await db.insert(jobs).values({
        id: jobId, status: 'queued', tool: tc.name, input, output: null, progress: 0, error: null,
      });
      await submitJob(tc.name as ToolName, input, jobId);

      sendEvent('tool_call', { tool: tc.name, job_id: jobId, input });

      toolMessagesToSave.push({ toolCallId: tc.id, content: JSON.stringify({ job_id: jobId }) });
      toolCallJobs.push({ toolCallId: tc.id, jobId });

      completedToolCalls.push({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      });
    }

    // Persist first assistant message (with tool calls)
    const firstAssistantMsg = await saveAssistantMessage(
      session.id,
      fullText,
      completedToolCalls.length > 0 ? completedToolCalls : null,
    );
    let doneMsgId = firstAssistantMsg.id;

    // Save tool messages (must follow assistant message in DB)
    for (const { toolCallId, content } of toolMessagesToSave) {
      await saveToolMessage(session.id, toolCallId, content);
    }

    // --- Poll jobs until all complete (max 60s) ---
    if (toolCallJobs.length > 0) {
      const SYNTHESIS_TIMEOUT = 60_000;
      const POLL_INTERVAL = 1_000;
      const pollStart = Date.now();
      const jobResults = new Map<string, { status: string; output: unknown; error: string | null }>();
      const toolCallIdByJobId = new Map(toolCallJobs.map(t => [t.jobId, t.toolCallId]));

      while (Date.now() - pollStart < SYNTHESIS_TIMEOUT) {
        const pendingIds = toolCallJobs
          .filter(t => !jobResults.has(t.jobId))
          .map(t => t.jobId);
        if (pendingIds.length === 0) break;

        await new Promise<void>(r => setTimeout(r, POLL_INTERVAL));

        // Batch query — one DB round-trip per poll cycle regardless of job count
        const rows = await db.select().from(jobs).where(inArray(jobs.id, pendingIds));
        for (const row of rows) {
          if (row.status === 'completed' || row.status === 'failed') {
            jobResults.set(row.id, { status: row.status, output: row.output, error: row.error });
            const toolCallId = toolCallIdByJobId.get(row.id);
            if (toolCallId) {
              await db.update(chatMessages)
                .set({ content: JSON.stringify({ job_id: row.id, status: row.status, output: row.output, error: row.error }) })
                .where(eq(chatMessages.tool_call_id, toolCallId));
            }
          }
        }
      }

      // --- Second LLM call: synthesis ---
      // Only synthesize if at least one job completed (skip if all timed out)
      if (jobResults.size > 0) {
        // Rebuild message history (now includes updated tool results)
        const updatedMessages = await getSessionMessages(session.id);
        const synthesisHistory = buildMessageHistory(updatedMessages);

        const abort2 = new AbortController();
        const abort2Timer = setTimeout(() => abort2.abort(), 45_000);

        let synthesisText = '';
        try {
          const synthesisStream = await client.chat.completions.create({
            model,
            stream: true,
            messages: [{ role: 'system', content: systemPrompt }, ...synthesisHistory],
            // No tools on synthesis call — just generate text response
          }, { signal: abort2.signal });

          for await (const chunk of synthesisStream) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) {
              synthesisText += delta;
              sendEvent('text', { delta });
            }
          }
        } finally {
          clearTimeout(abort2Timer);
        }

        // Persist synthesis message
        if (synthesisText) {
          const synthMsg = await saveAssistantMessage(session.id, synthesisText, null);
          doneMsgId = synthMsg.id;
        }
      }
    }

    sendEvent('done', { session_id: session.id, message_id: doneMsgId });
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
