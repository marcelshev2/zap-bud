import OpenAI from 'openai';
import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Groq exposes a Whisper API that's compatible with OpenAI's format.
// When GROQ_API_KEY is set it is used (free tier). Otherwise falls back to OpenAI.
const client = config.groqApiKey
  ? new OpenAI({ apiKey: config.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' })
  : new OpenAI({ apiKey: config.openaiApiKey });

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
