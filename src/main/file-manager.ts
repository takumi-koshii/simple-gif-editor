import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FrameMetadata, UndoMeta } from '../shared/types';

export function createWorkDir(baseDir: string): string {
  const id = crypto.randomUUID().slice(0, 8);
  const dir = path.join(baseDir, `work-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanup(workDir: string): void {
  fs.rmSync(workDir, { recursive: true, force: true });
}

// --- Stack helpers ---

function getStackDir(workDir: string, stack: 'undo' | 'redo'): string {
  return path.join(workDir, stack);
}

function getStackSize(workDir: string, stack: 'undo' | 'redo'): number {
  const dir = getStackDir(workDir, stack);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(d => {
    return fs.statSync(path.join(dir, d)).isDirectory();
  }).length;
}

function getEntryDir(workDir: string, stack: 'undo' | 'redo', index: number): string {
  return path.join(getStackDir(workDir, stack), String(index));
}

function pushToStack(
  workDir: string,
  stack: 'undo' | 'redo',
  meta: UndoMeta,
  framePaths: string[],
): void {
  const index = getStackSize(workDir, stack);
  const entryDir = getEntryDir(workDir, stack, index);
  const entryFramesDir = path.join(entryDir, 'frames');
  fs.mkdirSync(entryFramesDir, { recursive: true });

  for (const fp of framePaths) {
    const name = path.basename(fp);
    fs.copyFileSync(fp, path.join(entryFramesDir, name));
  }

  fs.writeFileSync(path.join(entryDir, 'meta.json'), JSON.stringify(meta));
}

function popFromStack(workDir: string, stack: 'undo' | 'redo'): UndoMeta {
  const size = getStackSize(workDir, stack);
  if (size === 0) {
    throw new Error(`No ${stack} entries to pop`);
  }

  const index = size - 1;
  const entryDir = getEntryDir(workDir, stack, index);
  const metaPath = path.join(entryDir, 'meta.json');
  const meta: UndoMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const entryFramesDir = path.join(entryDir, 'frames');
  const framesDir = path.join(workDir, 'frames');

  // Restore frames based on operation type
  if (meta.type === 'mosaic' || meta.type === 'crop') {
    for (const name of meta.affectedFrames) {
      fs.copyFileSync(path.join(entryFramesDir, name), path.join(framesDir, name));
    }
  } else if (meta.type === 'reduce' || meta.type === 'delete') {
    if (meta.keptFrameMapping) {
      const entries = Object.entries(meta.keptFrameMapping);
      for (const [newName] of entries) {
        const src = path.join(framesDir, newName);
        if (fs.existsSync(src)) {
          fs.renameSync(src, path.join(framesDir, `_tmp_${newName}`));
        }
      }
      for (const [newName, originalName] of entries) {
        const src = path.join(framesDir, `_tmp_${newName}`);
        if (fs.existsSync(src)) {
          fs.renameSync(src, path.join(framesDir, originalName));
        }
      }
    }

    for (const name of meta.affectedFrames) {
      fs.copyFileSync(path.join(entryFramesDir, name), path.join(framesDir, name));
    }

    const allFiles = fs.readdirSync(framesDir)
      .filter(f => f.endsWith('.png'))
      .sort();
    for (let i = 0; i < allFiles.length; i++) {
      const newName = `frame_${String(i + 1).padStart(5, '0')}.png`;
      if (allFiles[i] !== newName) {
        fs.renameSync(path.join(framesDir, allFiles[i]), path.join(framesDir, newName));
      }
    }
  }

  // Remove the entry
  fs.rmSync(entryDir, { recursive: true, force: true });

  return meta;
}

function clearStack(workDir: string, stack: 'undo' | 'redo'): void {
  const dir = getStackDir(workDir, stack);
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- Public API ---

export function hasUndo(workDir: string): boolean {
  return getStackSize(workDir, 'undo') > 0;
}

export function hasRedo(workDir: string): boolean {
  return getStackSize(workDir, 'redo') > 0;
}

export function pushUndo(workDir: string, meta: UndoMeta, framePaths: string[]): void {
  pushToStack(workDir, 'undo', meta, framePaths);
}

export function popUndo(workDir: string): UndoMeta {
  return popFromStack(workDir, 'undo');
}

export function pushRedo(workDir: string, meta: UndoMeta, framePaths: string[]): void {
  pushToStack(workDir, 'redo', meta, framePaths);
}

export function popRedo(workDir: string): UndoMeta {
  return popFromStack(workDir, 'redo');
}

export function clearRedo(workDir: string): void {
  clearStack(workDir, 'redo');
}

// --- Convenience functions for creating undo entries ---

export function createMosaicBackup(workDir: string, framePaths: string[], prevMetadata: FrameMetadata): void {
  clearRedo(workDir);
  const meta: UndoMeta = {
    type: 'mosaic',
    affectedFrames: framePaths.map(fp => path.basename(fp)),
    prevMetadata,
  };
  pushUndo(workDir, meta, framePaths);
}

export function createReduceBackup(
  workDir: string,
  deletedFramePaths: string[],
  prevMetadata: FrameMetadata,
  keptFrameMapping?: Record<string, string>,
): void {
  clearRedo(workDir);
  const meta: UndoMeta = {
    type: 'reduce',
    affectedFrames: deletedFramePaths.map(fp => path.basename(fp)),
    keptFrameMapping,
    prevMetadata,
  };
  pushUndo(workDir, meta, deletedFramePaths);
}

export function createDeleteBackup(
  workDir: string,
  deletedFramePaths: string[],
  allFrameNames: string[],
  prevMetadata: FrameMetadata,
): void {
  clearRedo(workDir);
  const deletedSet = new Set(deletedFramePaths.map(fp => path.basename(fp)));
  const keptOriginal = allFrameNames.filter(n => !deletedSet.has(n));
  const keptFrameMapping: Record<string, string> = {};
  keptOriginal.forEach((name, i) => {
    keptFrameMapping[`frame_${String(i + 1).padStart(5, '0')}.png`] = name;
  });

  const meta: UndoMeta = {
    type: 'delete',
    affectedFrames: deletedFramePaths.map(fp => path.basename(fp)),
    keptFrameMapping,
    prevMetadata,
  };
  pushUndo(workDir, meta, deletedFramePaths);
}

export function createCropBackup(workDir: string, prevMetadata: FrameMetadata): void {
  clearRedo(workDir);
  const framesDir = path.join(workDir, 'frames');
  const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
  const framePaths = files.map(f => path.join(framesDir, f));

  const meta: UndoMeta = {
    type: 'crop',
    affectedFrames: files,
    prevMetadata,
  };
  pushUndo(workDir, meta, framePaths);
}

// --- Legacy compatibility ---

export function hasBackup(workDir: string): boolean {
  return hasUndo(workDir);
}

export function restoreBackup(workDir: string): UndoMeta {
  return popUndo(workDir);
}
