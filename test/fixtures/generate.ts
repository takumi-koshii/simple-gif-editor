import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');
const SAMPLE_GIF = path.join(FIXTURES_DIR, 'sample.gif');
const SAMPLE_PNG = path.join(FIXTURES_DIR, 'sample-frame.png');
const NOISY_PNG = path.join(FIXTURES_DIR, 'noisy-frame.png');

function getFFmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegPath = require('ffmpeg-static') as string;
  return ffmpegPath;
}

export async function setup(): Promise<void> {
  if (fs.existsSync(SAMPLE_GIF) && fs.existsSync(SAMPLE_PNG) && fs.existsSync(NOISY_PNG)) {
    return;
  }

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const ffmpeg = getFFmpegPath();

  // Generate a 3-second test GIF (320x240, 10fps)
  if (!fs.existsSync(SAMPLE_GIF)) {
    execFileSync(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'testsrc=duration=3:size=320x240:rate=10',
      '-y',
      SAMPLE_GIF,
    ]);
  }

  // Generate a test PNG frame (320x240, single frame with color pattern)
  if (!fs.existsSync(SAMPLE_PNG)) {
    execFileSync(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'testsrc=duration=0.1:size=320x240:rate=1',
      '-frames:v', '1',
      '-y',
      SAMPLE_PNG,
    ]);
  }

  // Generate a 320x240 PNG with gradient noise (every pixel unique)
  if (!fs.existsSync(NOISY_PNG)) {
    const width = 320;
    const height = 240;
    const channels = 3;
    const buf = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        buf[idx] = (x * 7 + y * 13) % 256;
        buf[idx + 1] = (x * 11 + y * 3) % 256;
        buf[idx + 2] = (x * 5 + y * 17) % 256;
      }
    }
    await sharp(buf, { raw: { width, height, channels } })
      .png()
      .toFile(NOISY_PNG);
  }
}

export async function teardown(): Promise<void> {
  // Fixtures are kept between runs for speed; cleaned by .tmp/ exclusion
}
