import { start, onMessage, onReaction, onReady, onContacts, getSelfJid } from './gateway/whatsapp.js';
import { recordMessage } from './handlers/messages.js';
import { handleReaction } from './handlers/reactions.js';
import { cacheIncomingAudio } from './handlers/audio.js';
import { handleSelfChat } from './handlers/selfchat.js';
import { handleContacts } from './handlers/contacts.js';
import { logger } from './logger.js';

onReady((selfJid) => {
  logger.info({ selfJid }, 'zap-bud ready');
});

onContacts(handleContacts);

onMessage(async (msg) => {
  const record = recordMessage(msg);
  if (!record) return;

  const selfJid = getSelfJid();
  const isSelfChat = selfJid && msg.key.remoteJid === selfJid;

  if (isSelfChat && record.fromMe && record.type === 'text' && record.body) {
    await handleSelfChat(msg, record.body);
    return;
  }

  if (!isSelfChat && record.type === 'audio') {
    await cacheIncomingAudio(msg);
  }
});

onReaction(async (reaction) => {
  await handleReaction(reaction);
});

start().catch((err) => {
  logger.error({ err: err.message }, 'failed to start');
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('shutting down');
  process.exit(0);
});
