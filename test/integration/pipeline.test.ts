import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { extractFrames, exportGifFromFrames, encodePreviewGif } from '../../src/main/ffmpeg';
import { applyMosaic } from '../../src/main/mosaic';
import { applyCrop } from '../../src/main/crop';
import { reduceFrames } from '../../src/main/frame-reducer';
import {
  createWorkDir,
  cleanup,
  createMosaicBackup,
  createCropBackup,
  createReduceBackup,
  restoreBackup,
} from '../../src/main/file-manager';

const FIXTURES_DIR = path.resolve(__dirname, '../../.tmp/test-fixtures');
const SAMPLE_GIF = path.join(FIXTURES_DIR, 'sample.gif');
const TEST_BASE = path.resolve(__dirname, '../../.tmp/test-pipeline');

function makeExportParams(framesDir: string, frameInterval: number, outputPath: string) {
  return { frameDir: framesDir, frameInterval, outputPath };
}

describe('pipeline integration', () => {
  let workDir: string;

  beforeEach(() => {
    fs.mkdirSync(TEST_BASE, { recursive: true });
    workDir = createWorkDir(TEST_BASE);
  });

  afterEach(() => {
    cleanup(workDir);
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  });

  it('extract → mosaic → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();

    const targetFrames = frameFiles.slice(0, 10).map(f => path.join(framesDir, f));
    await applyMosaic(targetFrames, { x: 50, y: 50, width: 100, height: 80 }, 10);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, meta.frameInterval, gifPath));

    expect(fs.existsSync(gifPath)).toBe(true);
    expect(fs.statSync(gifPath).size).toBeGreaterThan(0);
  });

  it('extract → crop → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const paths = files.map(f => path.join(framesDir, f));

    createCropBackup(workDir, meta);
    const { width, height } = await applyCrop(paths, { x: 10, y: 10, width: 160, height: 120 });

    // Verify frames are cropped
    const croppedMeta = await sharp(path.join(framesDir, files[0])).metadata();
    expect(croppedMeta.width).toBe(160);
    expect(croppedMeta.height).toBe(120);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, meta.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('extract → crop → undo restores original size', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const paths = files.map(f => path.join(framesDir, f));

    createCropBackup(workDir, meta);
    await applyCrop(paths, { x: 10, y: 10, width: 160, height: 120 });

    restoreBackup(workDir);

    const restoredMeta = await sharp(path.join(framesDir, files[0])).metadata();
    expect(restoredMeta.width).toBe(320);
    expect(restoredMeta.height).toBe(240);
  });

  it('extract → reduce → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);

    const result = reduceFrames(framesDir, 2, meta);
    expect(result.newMetadata.frameCount).toBeLessThan(meta.frameCount);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, result.newMetadata.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('extract → mosaic → reduce → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();

    const targets = frameFiles.slice(0, 5).map(f => path.join(framesDir, f));
    await applyMosaic(targets, { x: 10, y: 10, width: 50, height: 50 }, 8);

    const result = reduceFrames(framesDir, 2, meta);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, result.newMetadata.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('extract → reduce → mosaic → GIF export (reverse order)', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);

    const reduceResult = reduceFrames(framesDir, 2, meta);

    const remainingFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const targets = remainingFiles.slice(0, 3).map(f => path.join(framesDir, f));
    await applyMosaic(targets, { x: 20, y: 20, width: 60, height: 40 }, 8);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, reduceResult.newMetadata.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('mosaic → undo → reduce → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const originalCount = frameFiles.length;

    const targets = frameFiles.slice(0, 5).map(f => path.join(framesDir, f));
    createMosaicBackup(workDir, targets, meta);
    await applyMosaic(targets, { x: 10, y: 10, width: 80, height: 60 }, 10);

    restoreBackup(workDir);
    expect(fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).length).toBe(originalCount);

    const result = reduceFrames(framesDir, 4, meta);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, result.newMetadata.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('reduce (with backup before) → undo → mosaic → GIF export', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const originalCount = frameFiles.length;

    const toDelete = frameFiles.filter((_, i) => i % 2 !== 0).map(f => path.join(framesDir, f));
    const keptOriginal = frameFiles.filter((_, i) => i % 2 === 0);
    const mapping: Record<string, string> = {};
    keptOriginal.forEach((name, i) => {
      mapping[`frame_${String(i + 1).padStart(5, '0')}.png`] = name;
    });
    createReduceBackup(workDir, toDelete, meta, mapping);
    reduceFrames(framesDir, 2, meta);

    restoreBackup(workDir);
    const restoredFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
    expect(restoredFiles.length).toBe(originalCount);

    const targets = restoredFiles.sort().slice(0, 5).map(f => path.join(framesDir, f));
    await applyMosaic(targets, { x: 30, y: 30, width: 60, height: 40 }, 10);

    const gifPath = path.join(workDir, 'output.gif');
    await exportGifFromFrames(makeExportParams(framesDir, meta.frameInterval, gifPath));
    expect(fs.existsSync(gifPath)).toBe(true);
  });

  it('mosaic x2 → undo x2 → preview encodes without error (prevMetadata preserved)', async () => {
    const framesDir = path.join(workDir, 'frames');
    const meta = await extractFrames(SAMPLE_GIF, framesDir);
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();

    // Mosaic 1
    const targets1 = frameFiles.slice(0, 5).map(f => path.join(framesDir, f));
    createMosaicBackup(workDir, targets1, meta);
    await applyMosaic(targets1, { x: 10, y: 10, width: 50, height: 50 }, 10);

    // Mosaic 2
    const targets2 = frameFiles.slice(5, 10).map(f => path.join(framesDir, f));
    createMosaicBackup(workDir, targets2, meta);
    await applyMosaic(targets2, { x: 20, y: 20, width: 40, height: 40 }, 10);

    // Undo x2
    const undoMeta1 = restoreBackup(workDir);
    expect(undoMeta1.prevMetadata.frameInterval).toBeGreaterThan(0);
    expect(undoMeta1.prevMetadata.fps).toBeGreaterThan(0);

    const undoMeta2 = restoreBackup(workDir);
    expect(undoMeta2.prevMetadata.frameInterval).toBeGreaterThan(0);
    expect(undoMeta2.prevMetadata.fps).toBeGreaterThan(0);

    // Preview encode should succeed (no Infinity fps)
    const fps = 1000 / undoMeta2.prevMetadata.frameInterval;
    expect(fps).toBeGreaterThan(0);
    expect(isFinite(fps)).toBe(true);

    const previewPath = path.join(workDir, 'preview.gif');
    await encodePreviewGif(framesDir, fps, previewPath);
    expect(fs.existsSync(previewPath)).toBe(true);
  });
});
