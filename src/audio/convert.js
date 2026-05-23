import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

fs.mkdirSync(config.tmpDir, { recursive: true });

export function oggToMp3(inputPath) {
  const outputPath = path.join(
    config.tmpDir,
    `${path.basename(inputPath, path.extname(inputPath))}.mp3`,
  );
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .format('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

export function writeBufferToTmp(buffer, suffix = '.ogg') {
  fs.mkdirSync(config.tmpDir, { recursive: true });
  const filePath = path.join(config.tmpDir, `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function cleanup(...paths) {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
