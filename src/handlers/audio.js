import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { downloadAudio } from '../gateway/whatsapp.js';
import { writeBufferToTmp, cleanup } from '../audio/convert.js';
import { transcribeFile } from '../ai/whisper.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const audioDir = path.join(path.dirname(config.dbPath), 'audio');
fs.mkdirSync(audioDir, { recursive: true });

function audioPath(msgId, chatJid) {
  const safe = `${chatJid.replace(/[^a-z0-9]/gi, '_')}__${msgId}`;
  return path.join(audioDir, `${safe}.mp3`);
}

function convertToMp3(inputPath, outputPath) {
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

export async function cacheIncomingAudio(msg) {
  if (!msg.message?.audioMessage) return;
  if (msg.key?.fromMe) return;

  const msgId = msg.key?.id;
  const chatJid = msg.key?.remoteJid;
  if (!msgId || !chatJid) return;

  const dest = audioPath(msgId, chatJid);
  if (fs.existsSync(dest)) return;

  let oggPath = null;
  try {
    const buffer = await downloadAudio(msg);
    oggPath = writeBufferToTmp(buffer, '.ogg');
    await convertToMp3(oggPath, dest);
    logger.debug({ msgId, chatJid }, 'audio cached');
  } catch (err) {
    logger.error({ err: err.message, msgId, chatJid }, 'audio cache failed');
  } finally {
    cleanup(oggPath);
  }
}

export async function transcribeForPool(msgId, chatJid) {
  const mp3 = audioPath(msgId, chatJid);
  if (!fs.existsSync(mp3)) {
    logger.warn({ msgId, chatJid }, 'audio file not found for transcription');
    return null;
  }
  try {
    const text = await transcribeFile(mp3);
    return text || null;
  } catch (err) {
    logger.error({ err: err.message, msgId, chatJid }, 'transcription failed');
    return null;
  } finally {
    cleanup(mp3);
  }
}
