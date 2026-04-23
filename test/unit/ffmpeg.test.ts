import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getFFmpegPath,
  getFFprobePath,
  probe,
  extractFrames,
  exportGifFromFrames,
  encodePreviewGif,
} from '../../src/main/ffmpeg';
import { reduceFrames } from '../../src/main/frame-reducer';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');
const SAMPLE_GIF = path.join(FIXTURES_DIR, 'sample.gif');
const TEST_OUTPUT = path.resolve(__dirname, '../../.tmp/test-ffmpeg');

describe('ffmpeg', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_OUTPUT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  describe('getFFmpegPath', () => {
    it('returns a path to an executable file', () => {
      const p = getFFmpegPath();
      expect(fs.existsSync(p)).toBe(true);
    });
  });

  describe('getFFprobePath', () => {
    it('returns a path to an executable file', () => {
      const p = getFFprobePath();
      expect(fs.existsSync(p)).toBe(true);
    });
  });

  describe('probe', () => {
    it('returns correct metadata for sample GIF', async () => {
      const meta = await probe(SAMPLE_GIF);
      expect(meta.duration).toBeCloseTo(3, 0);
      expect(meta.width).toBe(320);
      expect(meta.height).toBe(240);
      expect(meta.frameCount).toBeGreaterThan(0);
      expect(meta.fps).toBeGreaterThan(0);
      expect(meta.filePath).toBe(SAMPLE_GIF);
    });

    it('returns frameCount for GIF', async () => {
      const meta = await probe(SAMPLE_GIF);
      expect(meta.frameCount).toBeGreaterThanOrEqual(28);
      expect(meta.frameCount).toBeLessThanOrEqual(32);
    });

    it('throws for invalid file', async () => {
      const badFile = path.join(TEST_OUTPUT, 'bad.gif');
      fs.writeFileSync(badFile, 'not a gif');
      await expect(probe(badFile)).rejects.toThrow();
    });

    it('throws for non-existent file', async () => {
      await expect(probe('/nonexistent/file.gif')).rejects.toThrow();
    });
  });

  describe('extractFrames', () => {
    it('extracts PNG frames from GIF to output directory', async () => {
      const outDir = path.join(TEST_OUTPUT, 'frames');
      const result = await extractFrames(SAMPLE_GIF, outDir);
      expect(result.frameDir).toBe(outDir);
      expect(result.frameCount).toBeGreaterThan(0);

      const files = fs.readdirSync(outDir).filter(f => f.endsWith('.png'));
      expect(files.length).toBe(result.frameCount);
    });

    it('extracts all frames from GIF without dropping any', async () => {
      const meta = await probe(SAMPLE_GIF);
      const outDir = path.join(TEST_OUTPUT, 'frames-all');
      const result = await extractFrames(SAMPLE_GIF, outDir);
      expect(result.frameCount).toBeCloseTo(meta.frameCount, 0);
    });

    it('returns correct frame interval based on GIF timing', async () => {
      const outDir = path.join(TEST_OUTPUT, 'frames-interval');
      const result = await extractFrames(SAMPLE_GIF, outDir);
      expect(result.frameInterval).toBeGreaterThan(50);
      expect(result.frameInterval).toBeLessThan(200);
    });
  });

  describe('exportGifFromFrames', () => {
    it('generates a valid GIF from frame images', async () => {
      const framesDir = path.join(TEST_OUTPUT, 'gif-frames');
      const meta = await extractFrames(SAMPLE_GIF, framesDir);
      const gifPath = path.join(TEST_OUTPUT, 'output.gif');
      await exportGifFromFrames({
        frameDir: framesDir,
        frameInterval: meta.frameInterval,
        outputPath: gifPath,
      });
      expect(fs.existsSync(gifPath)).toBe(true);
      const header = Buffer.alloc(6);
      const fd = fs.openSync(gifPath, 'r');
      fs.readSync(fd, header, 0, 6, 0);
      fs.closeSync(fd);
      expect(header.toString('ascii').startsWith('GIF')).toBe(true);
    });

    it('preserves duration after frame reduction', async () => {
      const framesDir = path.join(TEST_OUTPUT, 'reduce-duration');
      const meta = await extractFrames(SAMPLE_GIF, framesDir);

      // Export original
      const originalGif = path.join(TEST_OUTPUT, 'original.gif');
      await exportGifFromFrames({
        frameDir: framesDir,
        frameInterval: meta.frameInterval,
        outputPath: originalGif,
      });
      const originalMeta = await probe(originalGif);

      // Reduce by 1/2
      const result = reduceFrames(framesDir, 2, meta);

      // Export after reduction
      const reducedGif = path.join(TEST_OUTPUT, 'reduced.gif');
      await exportGifFromFrames({
        frameDir: framesDir,
        frameInterval: result.newMetadata.frameInterval,
        outputPath: reducedGif,
      });
      const reducedMeta = await probe(reducedGif);

      // Duration should be approximately the same (within 0.5s tolerance)
      expect(reducedMeta.duration).toBeCloseTo(originalMeta.duration, 0);
    });

    it('preserves duration after 1/4 reduction', async () => {
      const framesDir = path.join(TEST_OUTPUT, 'reduce-duration-4');
      const meta = await extractFrames(SAMPLE_GIF, framesDir);
      const originalDuration = meta.frameCount * meta.frameInterval / 1000;

      const result = reduceFrames(framesDir, 4, meta);

      const reducedGif = path.join(TEST_OUTPUT, 'reduced4.gif');
      await exportGifFromFrames({
        frameDir: framesDir,
        frameInterval: result.newMetadata.frameInterval,
        outputPath: reducedGif,
      });
      const reducedMeta = await probe(reducedGif);

      expect(reducedMeta.duration).toBeCloseTo(originalDuration, 0);
    });
  });

  describe('encodePreviewGif', () => {
    it('generates a valid GIF from frame images', async () => {
      const framesDir = path.join(TEST_OUTPUT, 'preview-frames');
      const meta = await extractFrames(SAMPLE_GIF, framesDir);
      const previewPath = path.join(TEST_OUTPUT, 'preview.gif');
      await encodePreviewGif(framesDir, meta.fps, previewPath);
      expect(fs.existsSync(previewPath)).toBe(true);
      const header = Buffer.alloc(6);
      const fd = fs.openSync(previewPath, 'r');
      fs.readSync(fd, header, 0, 6, 0);
      fs.closeSync(fd);
      expect(header.toString('ascii').startsWith('GIF')).toBe(true);
    });

    it('preserves duration after frame reduction', async () => {
      const framesDir = path.join(TEST_OUTPUT, 'preview-reduce');
      const meta = await extractFrames(SAMPLE_GIF, framesDir);
      const originalDuration = meta.frameCount * meta.frameInterval / 1000;

      const result = reduceFrames(framesDir, 2, meta);
      const reducedFps = 1000 / result.newMetadata.frameInterval;

      const previewPath = path.join(TEST_OUTPUT, 'preview-reduced.gif');
      await encodePreviewGif(framesDir, reducedFps, previewPath);

      const previewMeta = await probe(previewPath);
      expect(previewMeta.duration).toBeCloseTo(originalDuration, 0);
    });
  });
});
