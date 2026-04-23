import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { probe, extractFrames, exportGifFromFrames, encodePreviewGif } from './ffmpeg';
import { applyMosaic } from './mosaic';
import { applyCrop } from './crop';
import { reduceFrames } from './frame-reducer';
import {
  createWorkDir,
  cleanup,
  createMosaicBackup,
  createCropBackup,
  createReduceBackup,
  createDeleteBackup,
  hasUndo,
  hasRedo,
  popUndo,
  popRedo,
  pushUndo,
  pushRedo,
} from './file-manager';
import type { FrameMetadata, Rect, ReduceRate } from '../shared/types';

let currentFilePath: string | null = null;
let workDir: string | null = null;
let frameMetadata: FrameMetadata | null = null;

function getWorkDir(): string {
  if (!workDir) {
    workDir = createWorkDir(path.join(os.tmpdir(), 'my-gif-editor'));
  }
  return workDir;
}

function getFramesDir(): string {
  return path.join(getWorkDir(), 'frames');
}

function listFrameFiles(): string[] {
  return fs.readdirSync(getFramesDir()).filter(f => f.endsWith('.png')).sort();
}

function resetSession(): void {
  if (workDir) {
    cleanup(workDir);
    workDir = null;
  }
  currentFilePath = null;
  frameMetadata = null;
}

export function registerIpcHandlers(): void {
  // Open GIF file, probe metadata, extract frames, generate preview
  ipcMain.handle('dialog:open-file', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'GIF Image', extensions: ['gif'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    resetSession();
    currentFilePath = result.filePaths[0];

    const meta = await probe(currentFilePath);
    const framesDir = getFramesDir();
    frameMetadata = await extractFrames(currentFilePath, framesDir);

    // Generate initial preview GIF from extracted frames
    const previewPath = path.join(getWorkDir(), 'preview.gif');
    const fps = 1000 / frameMetadata.frameInterval;
    await encodePreviewGif(framesDir, fps, previewPath);

    return {
      filePath: meta.filePath,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      frameCount: meta.frameCount,
      fps: meta.fps,
      frameMetadata,
      previewPath,
    };
  });

  // Get thumbnails for frame card list
  ipcMain.handle('frames:get-thumbnails', async (_event, thumbHeight: number) => {
    const framesDir = getFramesDir();
    const files = listFrameFiles();
    const thumbnails: string[] = [];
    for (const file of files) {
      const buf = await sharp(path.join(framesDir, file))
        .resize({ height: thumbHeight })
        .png()
        .toBuffer();
      thumbnails.push(`data:image/png;base64,${buf.toString('base64')}`);
    }
    return thumbnails;
  });

  // Delete selected frames
  ipcMain.handle('frames:delete', (_event, frameIndices: number[]) => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const framesDir = getFramesDir();
    const files = listFrameFiles();

    const indicesToDelete = new Set(frameIndices);
    const toDelete = files.filter((_, i) => indicesToDelete.has(i)).map(f => path.join(framesDir, f));

    if (toDelete.length === 0) return frameMetadata;
    if (toDelete.length >= files.length) throw new Error('Cannot delete all frames');

    createDeleteBackup(getWorkDir(), toDelete, files, frameMetadata);

    // Delete files
    for (const fp of toDelete) {
      fs.unlinkSync(fp);
    }

    // Rename remaining to sequential
    const remaining = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    for (let i = 0; i < remaining.length; i++) {
      const newName = `frame_${String(i + 1).padStart(5, '0')}.png`;
      if (remaining[i] !== newName) {
        fs.renameSync(path.join(framesDir, remaining[i]), path.join(framesDir, newName));
      }
    }

    frameMetadata = {
      ...frameMetadata,
      frameCount: remaining.length,
    };
    return frameMetadata;
  });

  // Apply crop to all frames
  ipcMain.handle('frames:apply-crop', async (_event, rect: Rect) => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const framesDir = getFramesDir();
    const files = listFrameFiles();
    const paths = files.map(f => path.join(framesDir, f));

    createCropBackup(getWorkDir(), frameMetadata);
    const { width, height } = await applyCrop(paths, rect);

    frameMetadata = { ...frameMetadata, frameCount: files.length };
    return { width, height, frameCount: files.length };
  });

  ipcMain.handle('mosaic:apply', async (_event, startFrame: number, endFrame: number, rect: Rect, blockSize: number) => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const files = listFrameFiles();
    const framesDir = getFramesDir();
    const targetFiles = files.slice(startFrame, endFrame).map(f => path.join(framesDir, f));

    createMosaicBackup(getWorkDir(), targetFiles, frameMetadata);
    await applyMosaic(targetFiles, rect, blockSize);
  });

  ipcMain.handle('frames:reduce', (_event, rate: ReduceRate) => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const framesDir = getFramesDir();
    const files = listFrameFiles();

    const toDelete = files.filter((_, i) => i % rate !== 0).map(f => path.join(framesDir, f));
    const keptOriginal = files.filter((_, i) => i % rate === 0);
    const mapping: Record<string, string> = {};
    keptOriginal.forEach((name, i) => {
      mapping[`frame_${String(i + 1).padStart(5, '0')}.png`] = name;
    });

    createReduceBackup(getWorkDir(), toDelete, frameMetadata, mapping);
    const result = reduceFrames(framesDir, rate, frameMetadata);
    frameMetadata = result.newMetadata;
    return { frameCount: frameMetadata.frameCount, frameInterval: frameMetadata.frameInterval };
  });

  ipcMain.handle('edit:undo', () => {
    const wd = getWorkDir();
    if (!hasUndo(wd)) return null;

    // Save current state to redo before restoring
    if (frameMetadata) {
      const framesDir = getFramesDir();
      const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
      const framePaths = files.map(f => path.join(framesDir, f));
      const redoMeta = {
        type: 'crop' as const, // Use crop type to save all current frames
        affectedFrames: files,
        prevMetadata: { ...frameMetadata, frameDir: framesDir },
      };
      pushRedo(wd, redoMeta, framePaths);
    }

    const meta = popUndo(wd);
    frameMetadata = meta.prevMetadata;
    frameMetadata.frameDir = getFramesDir();
    return { prevFrameCount: frameMetadata.frameCount, prevFrameInterval: frameMetadata.frameInterval };
  });

  ipcMain.handle('edit:redo', () => {
    const wd = getWorkDir();
    if (!hasRedo(wd)) return null;

    // Save current state to undo before redo
    if (frameMetadata) {
      const framesDir = getFramesDir();
      const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
      const framePaths = files.map(f => path.join(framesDir, f));
      const undoMeta = {
        type: 'crop' as const,
        affectedFrames: files,
        prevMetadata: { ...frameMetadata, frameDir: framesDir },
      };
      pushUndo(wd, undoMeta, framePaths);
    }

    const meta = popRedo(wd);
    frameMetadata = meta.prevMetadata;
    frameMetadata.frameDir = getFramesDir();
    return { prevFrameCount: frameMetadata.frameCount, prevFrameInterval: frameMetadata.frameInterval };
  });

  ipcMain.handle('edit:has-undo', () => {
    return workDir ? hasUndo(getWorkDir()) : false;
  });

  ipcMain.handle('edit:has-redo', () => {
    return workDir ? hasRedo(getWorkDir()) : false;
  });

  ipcMain.handle('ffmpeg:export-gif', async () => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showSaveDialog(win, {
      defaultPath: 'output.gif',
      filters: [{ name: 'GIF', extensions: ['gif'] }],
    });
    if (result.canceled || !result.filePath) return null;

    await exportGifFromFrames({
      frameDir: getFramesDir(),
      frameInterval: frameMetadata.frameInterval,
      outputPath: result.filePath,
    });

    return result.filePath;
  });

  ipcMain.handle('ffmpeg:encode-preview', async () => {
    if (!frameMetadata) throw new Error('Frames not extracted');
    const previewPath = path.join(getWorkDir(), 'preview.gif');
    const fps = 1000 / frameMetadata.frameInterval;
    await encodePreviewGif(getFramesDir(), fps, previewPath);
    return previewPath;
  });

  ipcMain.handle('frames:get-data-url', async (_event, frameIndex: number) => {
    const framesDir = getFramesDir();
    const files = listFrameFiles();
    if (frameIndex < 0 || frameIndex >= files.length) throw new Error('Frame index out of range');
    const data = fs.readFileSync(path.join(framesDir, files[frameIndex]));
    return `data:image/png;base64,${data.toString('base64')}`;
  });
}

export function cleanupOnQuit(): void {
  resetSession();
}
