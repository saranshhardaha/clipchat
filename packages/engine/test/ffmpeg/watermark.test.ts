import { describe, it, expect } from 'vitest';
import { addWatermark } from '../../src/ffmpeg/watermark.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';
import path from 'path';

// Generate a small test PNG using FFmpeg
async function createTestImage(): Promise<string> {
  const imgPath = path.join(os.tmpdir(), `watermark_test_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('color=white:size=100x50:rate=1')
      .inputFormat('lavfi')
      .outputOptions(['-vframes 1'])
      .output(imgPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return imgPath;
}

describe('addWatermark', () => {
  it('overlays watermark at bottom_right (default)', async () => {
    const watermark = await createTestImage();
    const output = await addWatermark({ input_file: TEST_VIDEO, watermark_file: watermark });
    expect(output).toMatch(/\.mp4$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
    fs.unlinkSync(watermark);
  });

  it('overlays watermark at top_left with custom options', async () => {
    const watermark = await createTestImage();
    const output = await addWatermark({
      input_file: TEST_VIDEO,
      watermark_file: watermark,
      position: 'top_left',
      opacity: 0.5,
      scale: 0.1,
      margin: 5,
    });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
    fs.unlinkSync(watermark);
  });
});
