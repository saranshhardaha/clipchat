import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { mergeClips } from '../../src/ffmpeg/merge.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('mergeClips', () => {
  it('concatenates two clips', async () => {
    const output = await mergeClips({ input_files: [TEST_VIDEO, TEST_VIDEO], transition: 'none' });
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeGreaterThan(18); // ~20s total
  });

  it('cleans up the concat temp file even when FFmpeg fails', async () => {
    const capturedPaths: string[] = [];

    // Spy on writeFileSync to capture the listPath used by mergeClips
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, data) => {
      if (typeof filePath === 'string' && filePath.includes('concat_')) {
        capturedPaths.push(filePath);
        // Actually write the file so unlinkSync has something to delete
        fs.writeFileSync.wrappedSpy!(filePath, data);
      }
    });

    // Restore and use a simpler approach: patch via module
    writeFileSyncSpy.mockRestore();

    // Use a non-existent input file to force FFmpeg failure
    const badInput = path.join(os.tmpdir(), `nonexistent_${Date.now()}.mp4`);

    // Capture all files created in tmpdir matching concat_ before the call
    const tmpFiles = () =>
      fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('concat_') && f.endsWith('.txt'));

    const before = new Set(tmpFiles());

    await expect(
      mergeClips({ input_files: [badInput, badInput], transition: 'none' })
    ).rejects.toThrow();

    // Any concat_ temp files created during the call should have been cleaned up
    const after = tmpFiles().filter(f => !before.has(f));
    expect(after).toHaveLength(0);
  });
});
