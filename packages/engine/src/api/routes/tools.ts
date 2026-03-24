import { Router } from 'express';
import { submitJob } from '../../queue/index.js';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';
import * as Schemas from '../../types/tools.js';

const TOOLS = [
  { name: 'trim_video', description: 'Trim a video between two timestamps', schema: Schemas.TrimVideoInputSchema },
  { name: 'merge_clips', description: 'Merge multiple clips sequentially', schema: Schemas.MergeClipsInputSchema },
  { name: 'add_subtitles', description: 'Add subtitle track to video', schema: Schemas.AddSubtitlesInputSchema },
  { name: 'add_text_overlay', description: 'Burn text into video', schema: Schemas.AddTextOverlayInputSchema },
  { name: 'resize_video', description: 'Resize or change aspect ratio', schema: Schemas.ResizeVideoInputSchema },
  { name: 'extract_audio', description: 'Extract audio from video', schema: Schemas.ExtractAudioInputSchema },
  { name: 'replace_audio', description: 'Replace or mix audio track', schema: Schemas.ReplaceAudioInputSchema },
  { name: 'change_speed', description: 'Change playback speed', schema: Schemas.ChangeSpeedInputSchema },
  { name: 'export_video', description: 'Re-encode and export video', schema: Schemas.ExportVideoInputSchema },
  { name: 'get_video_info', description: 'Get video metadata', schema: Schemas.GetVideoInfoInputSchema },
];

const router = Router();

router.get('/tools', (_req, res) => {
  res.json({ tools: TOOLS.map(t => ({ name: t.name, description: t.description })) });
});

router.post('/tools/:name', async (req, res, next) => {
  try {
    const tool = TOOLS.find(t => t.name === req.params.name);
    if (!tool) throw new AppError(404, `Tool '${req.params.name}' not found`);
    const parsed = tool.schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.message);
    const jobId = await submitJob(req.params.name as ToolName, parsed.data as Record<string, unknown>);
    await db.insert(jobs).values({ id: jobId, status: 'queued', tool: req.params.name, input: parsed.data as Record<string, unknown>, output: null, progress: 0, error: null });
    res.status(202).json({ id: jobId, status: 'queued' });
  } catch (err) { next(err); }
});

export default router;
