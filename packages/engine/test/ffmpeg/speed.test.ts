import { describe, it, expect } from 'vitest';
import { changeSpeed } from '../../src/ffmpeg/speed.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('changeSpeed', () => {
  it('doubles playback speed (halves duration)', async () => {
    const output = await changeSpeed({ input_file: TEST_VIDEO, speed_factor: 2.0 });
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeCloseTo(5, 0);
  });
});
