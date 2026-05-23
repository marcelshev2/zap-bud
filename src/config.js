import 'dotenv/config';
import path from 'node:path';

function required(name) {
  const v = process.env[name];
  if (!v || v.includes('PLACEHOLDER')) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v;
}

const hasGroq = process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('PLACEHOLDER');
const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('PLACEHOLDER');

if (!hasGroq && !hasOpenAI) {
  throw new Error('Set either GROQ_API_KEY (free) or OPENAI_API_KEY in your .env for transcription.');
}

export const config = {
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  groqApiKey: hasGroq ? process.env.GROQ_API_KEY : null,
  openaiApiKey: hasOpenAI ? process.env.OPENAI_API_KEY : null,
  claudeModel: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
  whisperModel: process.env.WHISPER_MODEL || (hasGroq ? 'whisper-large-v3-turbo' : 'whisper-1'),
  triggerEmoji: process.env.TRIGGER_EMOJI || '🤖',
  poolSize: parseInt(process.env.POOL_SIZE_PER_CONTACT || '15', 10),
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'pt-BR',
  dbPath: path.resolve(process.env.DB_PATH || './data/zap-bud.db'),
  authDir: path.resolve(process.env.AUTH_DIR || './auth'),
  tmpDir: path.resolve(process.env.TMP_DIR || './tmp'),
  sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10) * 60 * 1000,
  logLevel: process.env.LOG_LEVEL || 'info',
};
