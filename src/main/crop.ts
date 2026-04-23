import sharp from 'sharp';
import * as fs from 'fs';
import type { Rect } from '../shared/types';

export async function applyCrop(
  framePaths: string[],
  rect: Rect,
): Promise<{ width: number; height: number }> {
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error('Crop rect width and height must be greater than 0');
  }

  let finalWidth = 0;
  let finalHeight = 0;

  for (const framePath of framePaths) {
    const metadata = await sharp(framePath).metadata();
    const imgWidth = metadata.width!;
    const imgHeight = metadata.height!;

    // Clip rect to image bounds
    const left = Math.max(0, Math.min(rect.x, imgWidth - 1));
    const top = Math.max(0, Math.min(rect.y, imgHeight - 1));
    const right = Math.min(rect.x + rect.width, imgWidth);
    const bottom = Math.min(rect.y + rect.height, imgHeight);
    const clippedWidth = right - left;
    const clippedHeight = bottom - top;

    if (clippedWidth <= 0 || clippedHeight <= 0) {
      continue;
    }

    await sharp(framePath)
      .extract({ left, top, width: clippedWidth, height: clippedHeight })
      .png()
      .toFile(framePath + '.tmp');

    fs.renameSync(framePath + '.tmp', framePath);
    finalWidth = clippedWidth;
    finalHeight = clippedHeight;
  }

  return { width: finalWidth, height: finalHeight };
}
