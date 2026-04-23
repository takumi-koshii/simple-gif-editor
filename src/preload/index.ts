import { contextBridge, ipcRenderer } from 'electron';
import type { FrameMetadata } from '../shared/types';

export interface ElectronAPI {
  openFile(): Promise<{
    filePath: string;
    duration: number;
    width: number;
    height: number;
    frameCount: number;
    fps: number;
    frameMetadata: FrameMetadata;
    previewPath: string;
  } | null>;
  getThumbnails(thumbHeight: number): Promise<string[]>;
  deleteFrames(frameIndices: number[]): Promise<FrameMetadata>;
  applyCrop(rect: { x: number; y: number; width: number; height: number }): Promise<{ width: number; height: number; frameCount: number }>;
  applyMosaic(startFrame: number, endFrame: number, rect: { x: number; y: number; width: number; height: number }, blockSize: number): Promise<void>;
  reduceFrames(rate: 2 | 4 | 8): Promise<{ frameCount: number; frameInterval: number }>;
  undo(): Promise<{ prevFrameCount: number; prevFrameInterval: number } | null>;
  redo(): Promise<{ prevFrameCount: number; prevFrameInterval: number } | null>;
  hasUndo(): Promise<boolean>;
  hasRedo(): Promise<boolean>;
  exportGif(): Promise<string | null>;
  encodePreview(): Promise<string>;
  getFrameDataUrl(frameIndex: number): Promise<string>;
}

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  getThumbnails: (thumbHeight: number) => ipcRenderer.invoke('frames:get-thumbnails', thumbHeight),
  deleteFrames: (frameIndices: number[]) => ipcRenderer.invoke('frames:delete', frameIndices),
  applyCrop: (rect: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('frames:apply-crop', rect),
  applyMosaic: (startFrame: number, endFrame: number, rect: { x: number; y: number; width: number; height: number }, blockSize: number) =>
    ipcRenderer.invoke('mosaic:apply', startFrame, endFrame, rect, blockSize),
  reduceFrames: (rate: 2 | 4 | 8) => ipcRenderer.invoke('frames:reduce', rate),
  undo: () => ipcRenderer.invoke('edit:undo'),
  redo: () => ipcRenderer.invoke('edit:redo'),
  hasUndo: () => ipcRenderer.invoke('edit:has-undo'),
  hasRedo: () => ipcRenderer.invoke('edit:has-redo'),
  exportGif: () => ipcRenderer.invoke('ffmpeg:export-gif'),
  encodePreview: () => ipcRenderer.invoke('ffmpeg:encode-preview'),
  getFrameDataUrl: (frameIndex: number) => ipcRenderer.invoke('frames:get-data-url', frameIndex),
} satisfies ElectronAPI);
