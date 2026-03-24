import { describe, it, expect } from 'vitest';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('getVideoInfo', () => {
  it('returns correct metadata for test video', async () => {
    const info = await getVideoInfo({ input_file: TEST_VIDEO });
    expect(info.duration).toBeCloseTo(10, 0);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.fps).toBeCloseTo(30, 0);
    expect(info.codec).toBe('h264');
    expect(info.audio_codec).toBe('aac');
    expect(info.size_bytes).toBeGreaterThan(0);
    expect(info.bitrate).toBeGreaterThan(0);
  });

  it('throws on non-existent file', async () => {
    await expect(getVideoInfo({ input_file: '/nonexistent.mp4' })).rejects.toThrow();
  });
});
