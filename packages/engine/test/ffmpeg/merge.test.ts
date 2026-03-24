import { describe, it, expect } from 'vitest';
import { mergeClips } from '../../src/ffmpeg/merge.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('mergeClips', () => {
  it('concatenates two clips', async () => {
    const output = await mergeClips({ input_files: [TEST_VIDEO, TEST_VIDEO], transition: 'none' });
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeGreaterThan(18); // ~20s total
  });
});
