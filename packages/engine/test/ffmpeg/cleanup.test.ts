import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runFfmpegWithCleanup } from '../../src/ffmpeg/executor.js';
import type ffmpeg from 'fluent-ffmpeg';

/**
 * Build a minimal fake FfmpegCommand that either resolves or rejects when run.
 */
function makeFakeCommand(shouldFail: boolean): ffmpeg.FfmpegCommand {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const cmd = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return cmd;
    },
    run() {
      // Emit async so the Promise has time to attach listeners
      setImmediate(() => {
        if (shouldFail) {
          const err = new Error('FFmpeg failed');
          (handlers['error'] ?? []).forEach(h => h(err));
        } else {
          (handlers['end'] ?? []).forEach(h => h());
        }
      });
    },
  } as unknown as ffmpeg.FfmpegCommand;

  return cmd;
}

describe('runFfmpegWithCleanup', () => {
  let outputPath: string;

  beforeEach(() => {
    outputPath = path.join(os.tmpdir(), `cleanup_test_${Date.now()}_${Math.random()}.mp4`);
    // Create a dummy output file to simulate partial FFmpeg output
    fs.writeFileSync(outputPath, 'partial output');
  });

  afterEach(() => {
    // Clean up if somehow the file survived
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  });

  it('deletes the output file when FFmpeg fails', async () => {
    // Verify file exists before the call
    expect(fs.existsSync(outputPath)).toBe(true);

    await expect(
      runFfmpegWithCleanup(makeFakeCommand(true), outputPath)
    ).rejects.toThrow('FFmpeg failed');

    // File should be deleted after failure
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('re-throws the original error after cleanup', async () => {
    const thrown = await runFfmpegWithCleanup(makeFakeCommand(true), outputPath).catch(e => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe('FFmpeg failed');
  });

  it('does not throw if the output file does not exist during cleanup', async () => {
    const nonExistentPath = path.join(os.tmpdir(), `nonexistent_${Date.now()}.mp4`);
    // Should not throw even though the file does not exist
    await expect(
      runFfmpegWithCleanup(makeFakeCommand(true), nonExistentPath)
    ).rejects.toThrow('FFmpeg failed');
    // Importantly it should NOT throw a file-not-found error
  });

  it('does not delete the output file on success', async () => {
    await runFfmpegWithCleanup(makeFakeCommand(false), outputPath);

    // File should still exist after success
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
