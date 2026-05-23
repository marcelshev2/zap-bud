import { addToPool, getMessage, getPool, getContact } from '../db/index.js';
import { sendText, getSelfJid } from '../gateway/whatsapp.js';
import { suggestReplies } from '../ai/claude.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export async function handleReaction(reaction) {
  const { key, reaction: r } = reaction;
  if (!r || !key) return;

  // Only act on the user's own reactions
  if (!r.key?.fromMe && !key.fromMe) {
    // Reaction's own key indicates who reacted; we only care about ours
  }
  if (!r.key?.fromMe) return;

  // Only the configured trigger emoji
  if (r.text !== config.triggerEmoji) {
    // ignore — including remove events (r.text === '') by design
    return;
  }

  const msgId = key.id;
  const chatJid = key.remoteJid;
  if (!msgId || !chatJid) return;

  const stored = getMessage(msgId, chatJid);
  if (!stored) {
    logger.warn({ msgId, chatJid }, 'reacted message not found in DB; skipping');
    return;
  }

  addToPool(msgId, chatJid);
  logger.info({ msgId, chatJid }, 'message added to memory pool');

  const contact = getContact(chatJid);
  const contactName = contact?.name || chatJid.split('@')[0];

  // Auto-suggest replies for that message and deliver to self-chat
  const selfJid = getSelfJid();
  if (!selfJid) return;

  const pool = getPool(chatJid);
  const targetMessage = stored.body || '(mensagem não-textual)';

  const suggestions = await suggestReplies({
    contactName,
    pool,
    targetMessage,
  });

  const header = `💬 *${contactName}*\n_"${truncate(targetMessage, 120)}"_\n\n`;
  await sendText(selfJid, header + suggestions);
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
