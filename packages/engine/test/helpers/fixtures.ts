import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FIXTURES_DIR = join(__dirname, '../fixtures');
export const TEST_VIDEO = join(FIXTURES_DIR, 'test.mp4');
export const TEST_AUDIO = join(FIXTURES_DIR, 'test.mp3');
export const TEST_SRT = join(FIXTURES_DIR, 'test.srt');

if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

if (!existsSync(TEST_VIDEO)) {
  console.log('Generating test fixture video...');
  execSync(
    `ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 ` +
    `-f lavfi -i sine=frequency=440:duration=10 ` +
    `-c:v libx264 -c:a aac -shortest "${TEST_VIDEO}" -y`,
    { stdio: 'inherit' }
  );
}

if (!existsSync(TEST_AUDIO)) {
  execSync(
    `ffmpeg -f lavfi -i sine=frequency=440:duration=5 "${TEST_AUDIO}" -y`,
    { stdio: 'pipe' }
  );
}

if (!existsSync(TEST_SRT)) {
  const srt = `1\n00:00:00,000 --> 00:00:03,000\nHello World\n\n2\n00:00:03,000 --> 00:00:06,000\nTest subtitle\n`;
  writeFileSync(TEST_SRT, srt);
}
