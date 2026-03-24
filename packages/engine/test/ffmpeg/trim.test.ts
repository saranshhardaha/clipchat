import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { trimVideo } from '../../src/ffmpeg/trim.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('trimVideo', () => {
  it('trims to specified range', async () => {
    const output = await trimVideo({ input_file: TEST_VIDEO, start_time: '2', end_time: '5' });
    expect(existsSync(output)).toBe(true);
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeCloseTo(3, 0);
  });
});
