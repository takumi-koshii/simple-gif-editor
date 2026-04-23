import sharp from 'sharp';
import * as fs from 'fs';
import type { Rect } from '../shared/types';

export async function applyMosaic(
  framePaths: string[],
  rect: Rect,
  blockSize: number,
): Promise<void> {
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error('Mosaic rect width and height must be greater than 0');
  }

  for (const framePath of framePaths) {
    await applyMosaicToFrame(framePath, rect, blockSize);
  }
}

async function applyMosaicToFrame(
  framePath: string,
  rect: Rect,
  blockSize: number,
): Promise<void> {
  const { data, info } = await sharp(framePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imgWidth = info.width;
  const imgHeight = info.height;
  const channels = info.channels;

  // Clip rect to image bounds
  const left = Math.max(0, Math.min(rect.x, imgWidth - 1));
  const top = Math.max(0, Math.min(rect.y, imgHeight - 1));
  const right = Math.min(rect.x + rect.width, imgWidth);
  const bottom = Math.min(rect.y + rect.height, imgHeight);
  const clippedWidth = right - left;
  const clippedHeight = bottom - top;

  if (clippedWidth <= 0 || clippedHeight <= 0) {
    return;
  }

  // Create a mutable copy
  const pixels = Buffer.alloc(data.length);
  data.copy(pixels);

  // Apply pixelation directly: for each block, compute average color and fill
  for (let by = top; by < top + clippedHeight; by += blockSize) {
    for (let bx = left; bx < left + clippedWidth; bx += blockSize) {
      const bw = Math.min(blockSize, left + clippedWidth - bx);
      const bh = Math.min(blockSize, top + clippedHeight - by);
      const count = bw * bh;

      // Compute average color of the block
      const sum = new Array(channels).fill(0);
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const idx = (y * imgWidth + x) * channels;
          for (let c = 0; c < channels; c++) {
            sum[c] += data[idx + c];
          }
        }
      }
      const avg = sum.map(s => Math.round(s / count));

      // Fill block with average color
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const idx = (y * imgWidth + x) * channels;
          for (let c = 0; c < channels; c++) {
            pixels[idx + c] = avg[c];
          }
        }
      }
    }
  }

  // Write back to PNG
  await sharp(pixels, {
    raw: { width: imgWidth, height: imgHeight, channels },
  })
    .png()
    .toFile(framePath + '.tmp');

  fs.renameSync(framePath + '.tmp', framePath);
}
