import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { applyMosaic } from '../../src/main/mosaic';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');
const NOISY_PNG = path.join(FIXTURES_DIR, 'noisy-frame.png');
const TEST_OUTPUT = path.resolve(__dirname, '../../.tmp/test-mosaic');

async function copyFrame(dest: string): Promise<void> {
  fs.copyFileSync(NOISY_PNG, dest);
}

describe('mosaic', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_OUTPUT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  it('modifies the image within the specified rect', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    const before = await sharp(framePath).raw().toBuffer();

    await applyMosaic([framePath], { x: 50, y: 50, width: 100, height: 80 }, 10);

    const after = await sharp(framePath).raw().toBuffer();
    expect(Buffer.compare(before, after)).not.toBe(0);
  });

  it('pixelates the specified rect (block pattern)', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    await applyMosaic([framePath], { x: 0, y: 0, width: 100, height: 100 }, 10);

    // Extract the mosaic region and check pixel uniformity within blocks
    const region = await sharp(framePath)
      .extract({ left: 0, top: 0, width: 100, height: 100 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // In a 10px block mosaic, pixels within each 10x10 block should be identical
    const { data, info } = region;
    const channels = info.channels;
    // Check first block (0,0)-(10,10): all pixels should have same color
    const firstPixel = [data[0], data[1], data[2]];
    let blockUniform = true;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const idx = (y * info.width + x) * channels;
        if (data[idx] !== firstPixel[0] || data[idx + 1] !== firstPixel[1] || data[idx + 2] !== firstPixel[2]) {
          blockUniform = false;
        }
      }
    }
    expect(blockUniform).toBe(true);
  });

  it('does not modify pixels outside the specified rect', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    // Read a pixel outside the mosaic region before applying
    const beforeOutside = await sharp(framePath)
      .extract({ left: 200, top: 200, width: 1, height: 1 })
      .raw()
      .toBuffer();

    await applyMosaic([framePath], { x: 0, y: 0, width: 50, height: 50 }, 10);

    const afterOutside = await sharp(framePath)
      .extract({ left: 200, top: 200, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect(Buffer.compare(beforeOutside, afterOutside)).toBe(0);
  });

  it('applies mosaic to multiple frames', async () => {
    const paths: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const p = path.join(TEST_OUTPUT, `frame_${String(i).padStart(5, '0')}.png`);
      await copyFrame(p);
      paths.push(p);
    }

    const befores = await Promise.all(paths.map(p => sharp(p).raw().toBuffer()));

    await applyMosaic(paths, { x: 10, y: 10, width: 80, height: 60 }, 10);

    for (let i = 0; i < paths.length; i++) {
      const after = await sharp(paths[i]).raw().toBuffer();
      expect(Buffer.compare(befores[i], after)).not.toBe(0);
    }
  });

  it('clips rect to image bounds when rect exceeds image size', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    // Image is 320x240; rect goes beyond
    await expect(
      applyMosaic([framePath], { x: 280, y: 200, width: 100, height: 100 }, 10),
    ).resolves.toBeUndefined();

    // Image should still be valid
    const meta = await sharp(framePath).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
  });

  it('throws for zero-width rect', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    await expect(
      applyMosaic([framePath], { x: 10, y: 10, width: 0, height: 50 }, 10),
    ).rejects.toThrow();
  });

  it('throws for zero-height rect', async () => {
    const framePath = path.join(TEST_OUTPUT, 'frame_00001.png');
    await copyFrame(framePath);

    await expect(
      applyMosaic([framePath], { x: 10, y: 10, width: 50, height: 0 }, 10),
    ).rejects.toThrow();
  });
});
