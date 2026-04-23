import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createWorkDir,
  cleanup,
  pushUndo,
  popUndo,
  pushRedo,
  popRedo,
  hasUndo,
  hasRedo,
  clearRedo,
} from '../../src/main/file-manager';
import type { UndoMeta } from '../../src/shared/types';

const TEST_BASE = path.resolve(__dirname, '../../.tmp/test-file-manager');

function createFrames(framesDir: string, count: number): void {
  fs.mkdirSync(framesDir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    fs.writeFileSync(path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`), `frame-${i}`);
  }
}

function makeEntry(type: UndoMeta['type'], affectedFrames: string[], prevCount: number): UndoMeta {
  return {
    type,
    affectedFrames,
    prevMetadata: { frameDir: '', frameCount: prevCount, fps: 10, frameInterval: 100 },
  };
}

describe('file-manager', () => {
  let workDir: string;

  beforeEach(() => {
    fs.mkdirSync(TEST_BASE, { recursive: true });
    workDir = createWorkDir(TEST_BASE);
  });

  afterEach(() => {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  });

  describe('createWorkDir / cleanup', () => {
    it('creates a unique directory', () => {
      expect(fs.existsSync(workDir)).toBe(true);
    });

    it('creates different directories on successive calls', () => {
      const dir2 = createWorkDir(TEST_BASE);
      expect(workDir).not.toBe(dir2);
    });

    it('cleanup removes the directory', () => {
      cleanup(workDir);
      expect(fs.existsSync(workDir)).toBe(false);
    });

    it('cleanup does not throw for non-existent directory', () => {
      expect(() => cleanup(path.join(TEST_BASE, 'nonexistent'))).not.toThrow();
    });
  });

  describe('undo stack', () => {
    it('hasUndo returns false when empty', () => {
      expect(hasUndo(workDir)).toBe(false);
    });

    it('pushUndo + hasUndo returns true', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);
      const framePaths = [path.join(framesDir, 'frame_00001.png')];
      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), framePaths);
      expect(hasUndo(workDir)).toBe(true);
    });

    it('popUndo restores frames and returns meta', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);
      const framePaths = [path.join(framesDir, 'frame_00001.png')];

      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), framePaths);

      // Simulate mosaic: overwrite
      fs.writeFileSync(path.join(framesDir, 'frame_00001.png'), 'mosaicked');

      const meta = popUndo(workDir);
      expect(meta.type).toBe('mosaic');
      expect(fs.readFileSync(path.join(framesDir, 'frame_00001.png'), 'utf-8')).toBe('frame-1');
    });

    it('popUndo removes the entry from stack', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);
      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      popUndo(workDir);
      expect(hasUndo(workDir)).toBe(false);
    });

    it('multiple pushUndo + multiple popUndo (LIFO)', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);

      // Push 3 mosaic operations
      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      fs.writeFileSync(path.join(framesDir, 'frame_00001.png'), 'mosaic-1');

      pushUndo(workDir, makeEntry('mosaic', ['frame_00002.png'], 3), [path.join(framesDir, 'frame_00002.png')]);
      fs.writeFileSync(path.join(framesDir, 'frame_00002.png'), 'mosaic-2');

      pushUndo(workDir, makeEntry('mosaic', ['frame_00003.png'], 3), [path.join(framesDir, 'frame_00003.png')]);
      fs.writeFileSync(path.join(framesDir, 'frame_00003.png'), 'mosaic-3');

      // Pop in reverse order
      popUndo(workDir);
      expect(fs.readFileSync(path.join(framesDir, 'frame_00003.png'), 'utf-8')).toBe('frame-3');

      popUndo(workDir);
      expect(fs.readFileSync(path.join(framesDir, 'frame_00002.png'), 'utf-8')).toBe('frame-2');

      popUndo(workDir);
      expect(fs.readFileSync(path.join(framesDir, 'frame_00001.png'), 'utf-8')).toBe('frame-1');

      expect(hasUndo(workDir)).toBe(false);
    });

    it('throws when popping empty undo stack', () => {
      expect(() => popUndo(workDir)).toThrow();
    });
  });

  describe('redo stack', () => {
    it('hasRedo returns false when empty', () => {
      expect(hasRedo(workDir)).toBe(false);
    });

    it('pushRedo + popRedo works', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);

      pushRedo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      expect(hasRedo(workDir)).toBe(true);

      fs.writeFileSync(path.join(framesDir, 'frame_00001.png'), 'undone');

      const meta = popRedo(workDir);
      expect(meta.type).toBe('mosaic');
      expect(fs.readFileSync(path.join(framesDir, 'frame_00001.png'), 'utf-8')).toBe('frame-1');
      expect(hasRedo(workDir)).toBe(false);
    });

    it('clearRedo removes all redo entries', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);

      pushRedo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      pushRedo(workDir, makeEntry('mosaic', ['frame_00002.png'], 3), [path.join(framesDir, 'frame_00002.png')]);
      expect(hasRedo(workDir)).toBe(true);

      clearRedo(workDir);
      expect(hasRedo(workDir)).toBe(false);
    });

    it('throws when popping empty redo stack', () => {
      expect(() => popRedo(workDir)).toThrow();
    });
  });

  describe('undo + redo workflow', () => {
    it('undo then redo restores the edited state', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);

      // Save original for undo
      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      fs.writeFileSync(path.join(framesDir, 'frame_00001.png'), 'mosaicked');

      // Undo: save edited state for redo, then restore
      pushRedo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      popUndo(workDir);
      expect(fs.readFileSync(path.join(framesDir, 'frame_00001.png'), 'utf-8')).toBe('frame-1');

      // Redo: save current for undo, then restore edited
      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      popRedo(workDir);
      expect(fs.readFileSync(path.join(framesDir, 'frame_00001.png'), 'utf-8')).toBe('mosaicked');
    });

    it('new operation after undo clears redo stack', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 3);

      pushUndo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      fs.writeFileSync(path.join(framesDir, 'frame_00001.png'), 'mosaic-1');

      // Undo
      pushRedo(workDir, makeEntry('mosaic', ['frame_00001.png'], 3), [path.join(framesDir, 'frame_00001.png')]);
      popUndo(workDir);

      // New operation should clear redo
      clearRedo(workDir);
      pushUndo(workDir, makeEntry('mosaic', ['frame_00002.png'], 3), [path.join(framesDir, 'frame_00002.png')]);

      expect(hasRedo(workDir)).toBe(false);
      expect(hasUndo(workDir)).toBe(true);
    });
  });

  describe('reduce/delete undo with mapping', () => {
    it('restores deleted frames with keptFrameMapping', () => {
      const framesDir = path.join(workDir, 'frames');
      createFrames(framesDir, 4);

      const toDelete = [
        path.join(framesDir, 'frame_00002.png'),
        path.join(framesDir, 'frame_00004.png'),
      ];
      const meta = makeEntry('delete', ['frame_00002.png', 'frame_00004.png'], 4);
      meta.keptFrameMapping = {
        'frame_00001.png': 'frame_00001.png',
        'frame_00002.png': 'frame_00003.png',
      };

      pushUndo(workDir, meta, toDelete);

      // Simulate delete + rename
      fs.unlinkSync(path.join(framesDir, 'frame_00002.png'));
      fs.unlinkSync(path.join(framesDir, 'frame_00004.png'));
      fs.renameSync(path.join(framesDir, 'frame_00003.png'), path.join(framesDir, 'frame_00002.png'));

      popUndo(workDir);
      const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
      expect(files.length).toBe(4);
    });
  });
});
