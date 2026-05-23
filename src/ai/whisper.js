import OpenAI from 'openai';
import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../logger.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export async function transcribeFile(filePath) {
  try {
    const res = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: config.whisperModel,
    });
    return res.text?.trim() || '';
  } catch (err) {
    logger.error({ err: err.message, filePath }, 'whisper transcription failed');
    throw err;
  }
}
