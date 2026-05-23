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
const hasAnthropic = process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('PLACEHOLDER');
const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('PLACEHOLDER');

if (!hasGroq && !hasOpenAI) {
  throw new Error('Set GROQ_API_KEY (free) or OPENAI_API_KEY in your .env for transcription.');
}
if (!hasGroq && !hasAnthropic) {
  throw new Error('Set GROQ_API_KEY (free) or ANTHROPIC_API_KEY in your .env for the brain.');
}

// Brain priority: Anthropic > Groq LLM
// Transcription priority: Groq Whisper > OpenAI Whisper
export const config = {
  anthropicApiKey: hasAnthropic ? process.env.ANTHROPIC_API_KEY : null,
  groqApiKey: hasGroq ? process.env.GROQ_API_KEY : null,
  openaiApiKey: hasOpenAI ? process.env.OPENAI_API_KEY : null,
  useGroqForBrain: hasGroq && !hasAnthropic,
  claudeModel: process.env.CLAUDE_MODEL || (hasAnthropic ? 'claude-haiku-4-5-20251001' : 'llama-3.3-70b-versatile'),
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
