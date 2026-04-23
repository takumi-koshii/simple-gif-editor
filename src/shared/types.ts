export interface InputMetadata {
  filePath: string;
  duration: number;
  width: number;
  height: number;
  frameCount: number;
  fps: number; // average fps = frameCount / duration
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameMetadata {
  frameDir: string;
  frameCount: number;
  fps: number;
  frameInterval: number; // ms per frame
}

export type UndoOperationType = 'mosaic' | 'reduce' | 'delete' | 'crop';

export interface UndoMeta {
  type: UndoOperationType;
  affectedFrames: string[];
  /** For reduce undo: maps new sequential name → original name for kept frames */
  keptFrameMapping?: Record<string, string>;
  prevMetadata: FrameMetadata;
}

export interface MosaicParams {
  framePaths: string[];
  rect: Rect;
  blockSize: number;
}

export type ReduceRate = 2 | 4 | 8;

export interface ExportGifParams {
  frameDir: string;
  frameInterval: number;
  outputPath: string;
}

export interface EncodePreviewGifParams {
  frameDir: string;
  fps: number;
  outputPath: string;
}
