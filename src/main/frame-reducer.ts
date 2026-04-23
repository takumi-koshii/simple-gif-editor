import * as fs from 'fs';
import * as path from 'path';
import type { FrameMetadata, ReduceRate } from '../shared/types';

export interface ReduceResult {
  newMetadata: FrameMetadata;
  deletedPaths: string[];
}

export function reduceFrames(
  framesDir: string,
  rate: ReduceRate,
  currentMetadata: FrameMetadata,
): ReduceResult {
  const files = fs.readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort();

  // Select frames to keep: every Nth frame (0-indexed: 0, rate, 2*rate, ...)
  const keepIndices = new Set<number>();
  for (let i = 0; i < files.length; i += rate) {
    keepIndices.add(i);
  }
  // Ensure at least 1 frame
  if (keepIndices.size === 0 && files.length > 0) {
    keepIndices.add(0);
  }

  const deletedPaths: string[] = [];
  const keptFiles: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const fullPath = path.join(framesDir, files[i]);
    if (keepIndices.has(i)) {
      keptFiles.push(files[i]);
    } else {
      deletedPaths.push(fullPath);
    }
  }

  // Delete removed frames
  for (const p of deletedPaths) {
    fs.unlinkSync(p);
  }

  // Rename remaining frames to sequential order
  for (let i = 0; i < keptFiles.length; i++) {
    const oldPath = path.join(framesDir, keptFiles[i]);
    const newName = `frame_${String(i + 1).padStart(5, '0')}.png`;
    const newPath = path.join(framesDir, newName);
    if (oldPath !== newPath) {
      fs.renameSync(oldPath, newPath);
    }
  }

  const newMetadata: FrameMetadata = {
    frameDir: framesDir,
    frameCount: keptFiles.length,
    fps: currentMetadata.fps / rate,
    frameInterval: currentMetadata.frameInterval * rate,
  };

  return { newMetadata, deletedPaths };
}
