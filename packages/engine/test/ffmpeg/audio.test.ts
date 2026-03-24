import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { extractAudio, replaceAudio } from '../../src/ffmpeg/audio.js';
import { TEST_VIDEO, TEST_AUDIO } from '../helpers/fixtures.js';

describe('extractAudio', () => {
  it('extracts mp3 from video', async () => {
    const output = await extractAudio({ input_file: TEST_VIDEO, format: 'mp3' });
    expect(existsSync(output)).toBe(true);
    expect(output.endsWith('.mp3')).toBe(true);
  });
});

describe('replaceAudio', () => {
  it('replaces video audio track', async () => {
    const output = await replaceAudio({ input_file: TEST_VIDEO, audio_file: TEST_AUDIO, mix: false });
    expect(existsSync(output)).toBe(true);
  });
});
