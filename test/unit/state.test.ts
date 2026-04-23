import { describe, it, expect } from 'vitest';
import { createAppState } from '../../src/renderer/lib/state';

describe('state', () => {
  it('has correct initial state', () => {
    const state = createAppState();
    expect(state.filePath).toBeNull();
    expect(state.inputMetadata).toBeNull();
    expect(state.crop).toBeNull();
    expect(state.framesExtracted).toBe(false);
    expect(state.canUndo).toBe(false);
    expect(state.frameMetadata).toBeNull();
    expect(state.selectedFrames.size).toBe(0);
  });

  it('stores input metadata after file load', () => {
    const state = createAppState();
    state.inputMetadata = {
      filePath: '/test.gif',
      duration: 3,
      width: 320,
      height: 240,
      frameCount: 30,
      fps: 10,
    };
    state.filePath = '/test.gif';
    expect(state.filePath).toBe('/test.gif');
    expect(state.inputMetadata!.frameCount).toBe(30);
  });

  it('stores crop rect', () => {
    const state = createAppState();
    state.crop = { x: 10, y: 20, width: 300, height: 200 };
    expect(state.crop).toEqual({ x: 10, y: 20, width: 300, height: 200 });
  });

  it('tracks frame extraction status', () => {
    const state = createAppState();
    expect(state.framesExtracted).toBe(false);
    state.framesExtracted = true;
    expect(state.framesExtracted).toBe(true);
  });

  it('tracks undo availability', () => {
    const state = createAppState();
    expect(state.canUndo).toBe(false);
    state.canUndo = true;
    expect(state.canUndo).toBe(true);
  });

  it('stores frame metadata after extraction', () => {
    const state = createAppState();
    state.frameMetadata = {
      frameDir: '/tmp/frames',
      frameCount: 30,
      fps: 10,
      frameInterval: 100,
    };
    expect(state.frameMetadata!.frameCount).toBe(30);
  });

  it('manages selected frame indices', () => {
    const state = createAppState();
    state.selectedFrames.add(0);
    state.selectedFrames.add(3);
    state.selectedFrames.add(5);
    expect(state.selectedFrames.size).toBe(3);
    expect(state.selectedFrames.has(3)).toBe(true);
    state.selectedFrames.delete(3);
    expect(state.selectedFrames.has(3)).toBe(false);
    state.selectedFrames.clear();
    expect(state.selectedFrames.size).toBe(0);
  });
});
