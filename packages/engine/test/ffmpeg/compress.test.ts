import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'fs';
import { compressVideo } from '../../src/ffmpeg/compress.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('compressVideo', () => {
  it('compresses with web preset', async () => {
    const output = await compressVideo({ input_file: TEST_VIDEO, preset: 'web' });
    expect(existsSync(output)).toBe(true);
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeGreaterThan(0);
    expect(info.codec).toBe('h264');
  });

  it('compresses with mobile preset (max 720p)', async () => {
    const output = await compressVideo({ input_file: TEST_VIDEO, preset: 'mobile' });
    expect(existsSync(output)).toBe(true);
    const info = await getVideoInfo({ input_file: output });
    expect(info.height).toBeLessThanOrEqual(720);
  });

  it('compresses with target_size_mb', async () => {
    const output = await compressVideo({ input_file: TEST_VIDEO, preset: 'web', target_size_mb: 0.3 });
    expect(existsSync(output)).toBe(true);
    const bytes = statSync(output).size;
    expect(bytes).toBeLessThan(0.3 * 1024 * 1024 * 2);
  });
});
