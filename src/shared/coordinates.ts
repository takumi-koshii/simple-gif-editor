import type { Rect } from './types';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export function displayToVideo(point: Point, displaySize: Size, videoSize: Size): Point {
  const scaleX = videoSize.width / displaySize.width;
  const scaleY = videoSize.height / displaySize.height;
  return {
    x: point.x * scaleX,
    y: point.y * scaleY,
  };
}

export function videoToDisplay(point: Point, displaySize: Size, videoSize: Size): Point {
  const scaleX = displaySize.width / videoSize.width;
  const scaleY = displaySize.height / videoSize.height;
  return {
    x: point.x * scaleX,
    y: point.y * scaleY,
  };
}

export function clipRect(rect: Rect, imgWidth: number, imgHeight: number): Rect {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(imgWidth, rect.x + rect.width);
  const bottom = Math.min(imgHeight, rect.y + rect.height);

  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  return { x: left, y: top, width, height };
}
