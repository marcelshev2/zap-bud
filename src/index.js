import { start, onMessage, onReaction, onReady, getSelfJid } from './gateway/whatsapp.js';
import { recordMessage } from './handlers/messages.js';
import { handleReaction } from './handlers/reactions.js';
import { handleAudio } from './handlers/audio.js';
import { handleSelfChat } from './handlers/selfchat.js';
import { logger } from './logger.js';

onReady((selfJid) => {
  logger.info({ selfJid }, 'zap-bud ready');
});

onMessage(async (msg) => {
  const record = recordMessage(msg);
  if (!record) return;

  const selfJid = getSelfJid();
  const isSelfChat = selfJid && msg.key.remoteJid === selfJid;

  // Self-chat → handle as a query/command to the brain
  if (isSelfChat && record.fromMe && record.type === 'text' && record.body) {
    // Ignore messages the bot itself sent to self-chat (it has fromMe=true too)
    // Heuristic: bot replies start with specific emoji headers we use
    if (!isBotEcho(record.body)) {
      await handleSelfChat(msg, record.body);
    }
    return;
  }

  // Audio outside self-chat → transcribe
  if (!isSelfChat && record.type === 'audio') {
    await handleAudio(msg);
  }
});

onReaction(async (reaction) => {
  await handleReaction(reaction);
});

function isBotEcho(body) {
  return (
    body.startsWith('🎙 ') ||
    body.startsWith('💬 ') ||
    body.startsWith('🧠 ') ||
    body.startsWith('✅ ')
  );
}

start().catch((err) => {
  logger.error({ err: err.message }, 'failed to start');
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('shutting down');
  process.exit(0);
});
