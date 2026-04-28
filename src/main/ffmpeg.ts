import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { InputMetadata, FrameMetadata, ExportGifParams } from '../shared/types';

export function getFFmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('ffmpeg-static') as string;
  return p;
}

export function getFFprobePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('@ffprobe-installer/ffprobe') as { path: string };
  return p.path;
}

export function probe(filePath: string): Promise<InputMetadata> {
  return new Promise((resolve, reject) => {
    const ffprobe = getFFprobePath();
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-count_frames',
      filePath,
    ];

    execFile(ffprobe, args, (error, stdout) => {
      if (error) {
        reject(new Error(`ffprobe failed: ${error.message}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find(
          (s: { codec_type: string }) => s.codec_type === 'video',
        );

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = parseFloat(data.format?.duration ?? videoStream.duration ?? '0');
        const width = videoStream.width as number;
        const height = videoStream.height as number;

        // Frame count: nb_read_frames (from -count_frames) or nb_frames
        let frameCount = 0;
        if (videoStream.nb_read_frames) {
          frameCount = parseInt(videoStream.nb_read_frames, 10);
        } else if (videoStream.nb_frames) {
          frameCount = parseInt(videoStream.nb_frames, 10);
        }

        // fps: derive from frame count and duration, or from r_frame_rate
        let fps = 10;
        if (frameCount > 0 && duration > 0) {
          fps = frameCount / duration;
        } else {
          const rFrameRate = videoStream.r_frame_rate as string | undefined;
          if (rFrameRate) {
            const [num, den] = rFrameRate.split('/').map(Number);
            if (den > 0) {
              fps = num / den;
            }
          }
        }

        resolve({ filePath, duration, width, height, frameCount, fps });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${(e as Error).message}`));
      }
    });
  });
}

export function extractFrames(
  inputPath: string,
  outputDir: string,
): Promise<FrameMetadata> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });

    const ffmpeg = getFFmpegPath();
    // Extract all frames without fps filter (preserves every GIF frame)
    const args = [
      '-i', inputPath,
      '-y',
      path.join(outputDir, 'frame_%05d.png'),
    ];

    execFile(ffmpeg, args, async (error) => {
      if (error) {
        reject(new Error(`Frame extraction failed: ${error.message}`));
        return;
      }

      const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
      const frameCount = files.length;

      // Get duration to compute frame interval
      try {
        const meta = await probe(inputPath);
        const frameInterval = meta.duration > 0 ? (meta.duration * 1000) / frameCount : 100;
        const fps = 1000 / frameInterval;
        resolve({ frameDir: outputDir, frameCount, fps, frameInterval });
      } catch {
        // Fallback: assume 10fps
        resolve({ frameDir: outputDir, frameCount, fps: 10, frameInterval: 100 });
      }
    });
  });
}

export function exportGifFromFrames(params: ExportGifParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFFmpegPath();
    const { frameDir, frameInterval, outputPath } = params;

    const files = fs.readdirSync(frameDir).filter(f => f.endsWith('.png')).sort();
    const outputFps = 1000 / frameInterval;

    // Use the actual frame interval as both input and output rate
    // to preserve playback speed after frame reduction
    const filterComplex = 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';

    const args = [
      '-framerate', String(outputFps),
      '-i', path.join(frameDir, 'frame_%05d.png'),
      '-frames:v', String(files.length),
      '-filter_complex', filterComplex,
      '-r', String(outputFps),
      '-y',
      outputPath,
    ];

    execFile(ffmpeg, args, (error) => {
      if (error) {
        reject(new Error(`GIF export failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

export function encodePreviewGif(
  framesDir: string,
  fps: number,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFFmpegPath();

    const filterComplex = 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';

    const args = [
      '-framerate', String(fps),
      '-i', path.join(framesDir, 'frame_%05d.png'),
      '-filter_complex', filterComplex,
      '-r', String(fps),
      '-y',
      outputPath,
    ];

    execFile(ffmpeg, args, (error) => {
      if (error) {
        reject(new Error(`Preview GIF encode failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}
