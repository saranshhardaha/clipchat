import { describe, it, expect } from 'vitest';
import { resizeVideo } from '../../src/ffmpeg/resize.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('resizeVideo', () => {
  it('resizes with explicit dimensions', async () => {
    const output = await resizeVideo({ input_file: TEST_VIDEO, width: 640, height: 360 });
    const info = await getVideoInfo({ input_file: output });
    expect(info.width).toBe(640);
    expect(info.height).toBe(360);
  });

  it('resizes with 720p preset', async () => {
    const output = await resizeVideo({ input_file: TEST_VIDEO, preset: '720p' });
    const info = await getVideoInfo({ input_file: output });
    expect(info.height).toBe(720);
  });
});
