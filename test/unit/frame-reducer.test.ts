import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { reduceFrames } from '../../src/main/frame-reducer';
import type { FrameMetadata } from '../../src/shared/types';

const TEST_OUTPUT = path.resolve(__dirname, '../../.tmp/test-frame-reducer');

function createFrames(dir: string, count: number): void {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    fs.writeFileSync(
      path.join(dir, `frame_${String(i).padStart(5, '0')}.png`),
      `frame-${i}`,
    );
  }
}

function listFrames(dir: string): string[] {
  return fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
}

describe('frame-reducer', () => {
  let framesDir: string;

  beforeEach(() => {
    framesDir = path.join(TEST_OUTPUT, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  const baseMeta: FrameMetadata = {
    frameDir: '',
    frameCount: 8,
    fps: 30,
    frameInterval: 33.33,
  };

  describe('1/2 reduction', () => {
    it('keeps 4 frames from 8', () => {
      createFrames(framesDir, 8);
      const meta = { ...baseMeta, frameDir: framesDir };
      const result = reduceFrames(framesDir, 2, meta);
      expect(result.newMetadata.frameCount).toBe(4);
      expect(listFrames(framesDir).length).toBe(4);
    });
  });

  describe('1/4 reduction', () => {
    it('keeps 2 frames from 8', () => {
      createFrames(framesDir, 8);
      const meta = { ...baseMeta, frameDir: framesDir };
      const result = reduceFrames(framesDir, 4, meta);
      expect(result.newMetadata.frameCount).toBe(2);
      expect(listFrames(framesDir).length).toBe(2);
    });
  });

  describe('1/8 reduction', () => {
    it('keeps 1 frame from 8', () => {
      createFrames(framesDir, 8);
      const meta = { ...baseMeta, frameDir: framesDir };
      const result = reduceFrames(framesDir, 8, meta);
      expect(result.newMetadata.frameCount).toBe(1);
      expect(listFrames(framesDir).length).toBe(1);
    });
  });

  it('renames remaining frames to sequential order', () => {
    createFrames(framesDir, 8);
    const meta = { ...baseMeta, frameDir: framesDir };
    reduceFrames(framesDir, 2, meta);
    const files = listFrames(framesDir);
    expect(files).toEqual([
      'frame_00001.png',
      'frame_00002.png',
      'frame_00003.png',
      'frame_00004.png',
    ]);
  });

  it('updates frame interval to N times the original', () => {
    createFrames(framesDir, 8);
    const meta = { ...baseMeta, frameDir: framesDir, frameInterval: 33.33 };
    const result = reduceFrames(framesDir, 4, meta);
    expect(result.newMetadata.frameInterval).toBeCloseTo(33.33 * 4, 1);
  });

  it('keeps at least 1 frame when count < rate', () => {
    createFrames(framesDir, 2);
    const meta = { ...baseMeta, frameDir: framesDir, frameCount: 2 };
    const result = reduceFrames(framesDir, 8, meta);
    expect(result.newMetadata.frameCount).toBe(1);
    expect(listFrames(framesDir).length).toBe(1);
  });

  it('returns deleted frame paths for backup', () => {
    createFrames(framesDir, 8);
    const meta = { ...baseMeta, frameDir: framesDir };
    const result = reduceFrames(framesDir, 2, meta);
    expect(result.deletedPaths.length).toBe(4);
    // Deleted paths should be the original paths of removed frames
    for (const p of result.deletedPaths) {
      expect(p).toContain('frame_');
      expect(p).toContain('.png');
    }
  });
});
