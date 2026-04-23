import { describe, it, expect } from 'vitest';
import {
  displayToVideo,
  videoToDisplay,
  clipRect,
} from '../../src/shared/coordinates';
import type { Rect } from '../../src/shared/types';

interface Size {
  width: number;
  height: number;
}

describe('coordinates', () => {
  const videoSize: Size = { width: 1920, height: 1080 };
  const displaySize: Size = { width: 960, height: 540 };

  describe('displayToVideo', () => {
    it('scales coordinates from display to video space', () => {
      const result = displayToVideo({ x: 100, y: 50 }, displaySize, videoSize);
      expect(result.x).toBe(200);
      expect(result.y).toBe(100);
    });

    it('handles 1:1 scale', () => {
      const result = displayToVideo({ x: 100, y: 50 }, videoSize, videoSize);
      expect(result.x).toBe(100);
      expect(result.y).toBe(50);
    });
  });

  describe('videoToDisplay', () => {
    it('scales coordinates from video to display space', () => {
      const result = videoToDisplay({ x: 200, y: 100 }, displaySize, videoSize);
      expect(result.x).toBe(100);
      expect(result.y).toBe(50);
    });

    it('is the inverse of displayToVideo', () => {
      const original = { x: 123, y: 456 };
      const toVideo = displayToVideo(original, displaySize, videoSize);
      const backToDisplay = videoToDisplay(toVideo, displaySize, videoSize);
      expect(backToDisplay.x).toBeCloseTo(original.x, 5);
      expect(backToDisplay.y).toBeCloseTo(original.y, 5);
    });
  });

  describe('clipRect', () => {
    it('returns unchanged rect when fully within bounds', () => {
      const rect: Rect = { x: 10, y: 20, width: 100, height: 80 };
      const result = clipRect(rect, 1920, 1080);
      expect(result).toEqual(rect);
    });

    it('clips rect that extends beyond right edge', () => {
      const rect: Rect = { x: 1850, y: 0, width: 100, height: 50 };
      const result = clipRect(rect, 1920, 1080);
      expect(result.x).toBe(1850);
      expect(result.width).toBe(70);
    });

    it('clips rect that extends beyond bottom edge', () => {
      const rect: Rect = { x: 0, y: 1050, width: 50, height: 100 };
      const result = clipRect(rect, 1920, 1080);
      expect(result.y).toBe(1050);
      expect(result.height).toBe(30);
    });

    it('clips negative x/y to zero', () => {
      const rect: Rect = { x: -10, y: -20, width: 100, height: 80 };
      const result = clipRect(rect, 1920, 1080);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(90);
      expect(result.height).toBe(60);
    });

    it('returns zero-size rect when completely outside', () => {
      const rect: Rect = { x: 2000, y: 2000, width: 100, height: 100 };
      const result = clipRect(rect, 1920, 1080);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });
  });
});
