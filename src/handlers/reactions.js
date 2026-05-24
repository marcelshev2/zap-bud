import { addToPool, getMessage, getContact, updateMessageBody } from '../db/index.js';
import { transcribeForPool } from './audio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export async function handleReaction(reaction) {
  const { key, reaction: r } = reaction;
  if (!r || !key) return;
  if (!r.key?.fromMe) return;
  if (r.text !== config.triggerEmoji) return;

  const msgId = key.id;
  const chatJid = key.remoteJid;
  if (!msgId || !chatJid) return;

  const stored = getMessage(msgId, chatJid);
  if (!stored) {
    logger.warn({ msgId, chatJid }, 'reacted message not found in DB; skipping');
    return;
  }

  if (stored.type === 'audio' && !stored.body) {
    const transcript = await transcribeForPool(msgId, chatJid);
    if (transcript) {
      updateMessageBody(msgId, chatJid, transcript);
      logger.info({ msgId, chatJid }, 'audio transcribed on reaction');
    }
  }

  addToPool(msgId, chatJid);
  logger.info({ msgId, chatJid }, 'message added to memory pool');

  const contact = getContact(chatJid);
  logger.debug({ contact: contact?.name || chatJid }, 'pool updated');
}
