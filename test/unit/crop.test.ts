import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { applyCrop } from '../../src/main/crop';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');
const NOISY_PNG = path.join(FIXTURES_DIR, 'noisy-frame.png');
const TEST_OUTPUT = path.resolve(__dirname, '../../.tmp/test-crop');

function copyFrame(dest: string): void {
  fs.copyFileSync(NOISY_PNG, dest);
}

describe('crop', () => {
  let framesDir: string;

  beforeEach(() => {
    framesDir = path.join(TEST_OUTPUT, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  it('crops all frames to the specified rect', async () => {
    for (let i = 1; i <= 3; i++) {
      copyFrame(path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`));
    }
    const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const paths = files.map(f => path.join(framesDir, f));

    await applyCrop(paths, { x: 10, y: 20, width: 160, height: 120 });

    for (const p of paths) {
      const meta = await sharp(p).metadata();
      expect(meta.width).toBe(160);
      expect(meta.height).toBe(120);
    }
  });

  it('preserves pixel content within the crop region', async () => {
    const framePath = path.join(framesDir, 'frame_00001.png');
    copyFrame(framePath);

    // Read a pixel at (20, 30) before crop with offset (10, 20)
    // After crop, this pixel should be at (10, 10) in the cropped image
    const beforePixel = await sharp(framePath)
      .extract({ left: 20, top: 30, width: 1, height: 1 })
      .raw()
      .toBuffer();

    await applyCrop([framePath], { x: 10, y: 20, width: 160, height: 120 });

    const afterPixel = await sharp(framePath)
      .extract({ left: 10, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect(Buffer.compare(beforePixel, afterPixel)).toBe(0);
  });

  it('clips rect to image bounds', async () => {
    const framePath = path.join(framesDir, 'frame_00001.png');
    copyFrame(framePath);

    // Image is 320x240, crop extends beyond
    await applyCrop([framePath], { x: 280, y: 200, width: 100, height: 100 });

    const meta = await sharp(framePath).metadata();
    expect(meta.width).toBe(40);  // 320 - 280
    expect(meta.height).toBe(40); // 240 - 200
  });

  it('throws for zero-size rect', async () => {
    const framePath = path.join(framesDir, 'frame_00001.png');
    copyFrame(framePath);

    await expect(
      applyCrop([framePath], { x: 10, y: 10, width: 0, height: 50 }),
    ).rejects.toThrow();
  });
});
