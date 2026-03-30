import { describe, it, expect } from 'vitest';
import { normalizeAudio, fadeAudio } from '../../src/ffmpeg/audio.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';
import fs from 'fs';

describe('normalizeAudio', () => {
  it('normalizes loudness to target LUFS', async () => {
    const output = await normalizeAudio({ input_file: TEST_VIDEO, target_lufs: -14, true_peak: -1 });
    expect(output).toMatch(/\.mp4$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('uses default LUFS when not specified', async () => {
    const output = await normalizeAudio({ input_file: TEST_VIDEO });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });
});

describe('fadeAudio', () => {
  it('applies fade in', async () => {
    const output = await fadeAudio({ input_file: TEST_VIDEO, fade_in_duration: 0.5, fade_out_duration: 0 });
    expect(output).toMatch(/\.mp4$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('applies fade out', async () => {
    const output = await fadeAudio({ input_file: TEST_VIDEO, fade_in_duration: 0, fade_out_duration: 0.5 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('applies both fade in and out', async () => {
    const output = await fadeAudio({ input_file: TEST_VIDEO, fade_in_duration: 0.3, fade_out_duration: 0.3 });
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });
});
