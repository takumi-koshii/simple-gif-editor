import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');

describe('test environment', () => {
  it('test fixtures are generated', () => {
    expect(fs.existsSync(path.join(FIXTURES_DIR, 'sample.gif'))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURES_DIR, 'sample-frame.png'))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURES_DIR, 'noisy-frame.png'))).toBe(true);
  });

  it('ffmpeg-static binary is accessible', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegPath = require('ffmpeg-static') as string;
    expect(fs.existsSync(ffmpegPath)).toBe(true);
  });

  it('sharp can be imported and process an image', async () => {
    const sharp = (await import('sharp')).default;
    const samplePng = path.join(FIXTURES_DIR, 'sample-frame.png');
    const metadata = await sharp(samplePng).metadata();
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
  });
});
