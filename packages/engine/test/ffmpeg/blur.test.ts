import { describe, it, expect } from 'vitest';
import { blurRegion } from '../../src/ffmpeg/blur.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';
import fs from 'fs';

describe('blurRegion', () => {
  it('blurs full frame (default, no args)', async () => {
    const output = await blurRegion({ input_file: TEST_VIDEO, blur_strength: 10 });
    expect(output).toMatch(/\.mp4$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('blurs with lower_third preset', async () => {
    const output = await blurRegion({ input_file: TEST_VIDEO, preset: 'lower_third', blur_strength: 10 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('blurs with manual coordinates', async () => {
    const output = await blurRegion({ input_file: TEST_VIDEO, x: 0, y: 0, width: 100, height: 100, blur_strength: 5 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('blurs only within a time range', async () => {
    const output = await blurRegion({ input_file: TEST_VIDEO, preset: 'full_frame', start_time: '0', end_time: '1', blur_strength: 10 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });
});
