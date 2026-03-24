import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { addTextOverlay, addSubtitles } from '../../src/ffmpeg/text.js';
import { TEST_VIDEO, TEST_SRT } from '../helpers/fixtures.js';

describe('addTextOverlay', () => {
  it('burns text into video', async () => {
    const output = await addTextOverlay({
      input_file: TEST_VIDEO, text: 'Hello Test',
      style: { font: 'Arial', size: 36, color: 'white' },
    });
    expect(existsSync(output)).toBe(true);
  });
});

describe('addSubtitles', () => {
  it('burns SRT subtitles into video', async () => {
    const output = await addSubtitles({
      input_file: TEST_VIDEO, subtitle_source: TEST_SRT, burn_in: true,
    });
    expect(existsSync(output)).toBe(true);
  });
});
