import { describe, it, expect } from 'vitest';
import { exportVideo } from '../../src/ffmpeg/export.js';
import { existsSync } from 'fs';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('exportVideo', () => {
  it('re-encodes to mp4 h264', async () => {
    const output = await exportVideo({ input_file: TEST_VIDEO, format: 'mp4', codec: 'h264', quality: 'medium' });
    expect(existsSync(output)).toBe(true);
    expect(output.endsWith('.mp4')).toBe(true);
  });

  it('exports to webm', async () => {
    const output = await exportVideo({ input_file: TEST_VIDEO, format: 'webm', codec: 'vp9', quality: 'low' });
    expect(output.endsWith('.webm')).toBe(true);
  });
});
