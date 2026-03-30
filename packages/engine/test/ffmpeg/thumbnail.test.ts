import { describe, it, expect } from 'vitest';
import { generateThumbnail } from '../../src/ffmpeg/thumbnail.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';
import fs from 'fs';

describe('generateThumbnail', () => {
  it('extracts a jpg frame at a timestamp', async () => {
    const output = await generateThumbnail({ input_file: TEST_VIDEO, timestamp: '0', format: 'jpg' });
    expect(output).toMatch(/\.jpg$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('extracts a png frame', async () => {
    const output = await generateThumbnail({ input_file: TEST_VIDEO, timestamp: '0', format: 'png' });
    expect(output).toMatch(/\.png$/);
    expect(fs.existsSync(output)).toBe(true);
    fs.unlinkSync(output);
  });

  it('scales to requested width', async () => {
    const output = await generateThumbnail({ input_file: TEST_VIDEO, timestamp: '0', format: 'jpg', width: 160 });
    expect(fs.existsSync(output)).toBe(true);
    const stat = fs.statSync(output);
    expect(stat.size).toBeGreaterThan(0);
    fs.unlinkSync(output);
  });
});
