import { describe, it, expect } from 'vitest';
import { createGif } from '../../src/ffmpeg/gif.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';
import fs from 'fs';

describe('createGif', () => {
  it('creates a gif from a video', async () => {
    const output = await createGif({ input_file: TEST_VIDEO });
    expect(output).toMatch(/\.gif$/);
    expect(fs.existsSync(output)).toBe(true);
    const stat = fs.statSync(output);
    expect(stat.size).toBeGreaterThan(0);
    fs.unlinkSync(output);
  });

  it('creates a gif with custom fps and width', async () => {
    const output = await createGif({ input_file: TEST_VIDEO, fps: 5, width: 240 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('creates a gif from a time range', async () => {
    const output = await createGif({ input_file: TEST_VIDEO, start_time: '0', end_time: '1' });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });
});
