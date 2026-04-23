import type { InputMetadata, FrameMetadata, Rect } from '../../shared/types';

export interface AppState {
  filePath: string | null;
  inputMetadata: InputMetadata | null;
  crop: Rect | null;
  framesExtracted: boolean;
  canUndo: boolean;
  frameMetadata: FrameMetadata | null;
  selectedFrames: Set<number>;
}

export function createAppState(): AppState {
  return {
    filePath: null,
    inputMetadata: null,
    crop: null,
    framesExtracted: false,
    canUndo: false,
    frameMetadata: null,
    selectedFrames: new Set(),
  };
}
