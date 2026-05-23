import { insertMessage, upsertContact } from '../db/index.js';
import { logger } from '../logger.js';

function extractBody(msg) {
  const m = msg.message;
  if (!m) return { body: null, type: 'unknown' };
  if (m.conversation) return { body: m.conversation, type: 'text' };
  if (m.extendedTextMessage?.text) return { body: m.extendedTextMessage.text, type: 'text' };
  if (m.imageMessage) return { body: m.imageMessage.caption || '', type: 'image' };
  if (m.videoMessage) return { body: m.videoMessage.caption || '', type: 'video' };
  if (m.audioMessage) return { body: '', type: 'audio' };
  if (m.documentMessage) return { body: m.documentMessage.caption || '', type: 'document' };
  if (m.stickerMessage) return { body: '', type: 'sticker' };
  if (m.reactionMessage) return { body: m.reactionMessage.text || '', type: 'reaction' };
  return { body: null, type: 'unknown' };
}

export function recordMessage(msg) {
  if (!msg.key?.id || !msg.key?.remoteJid) return null;

  const { body, type } = extractBody(msg);
  if (type === 'reaction') return null; // reactions handled separately

  const chatJid = msg.key.remoteJid;
  const isGroup = chatJid.endsWith('@g.us');
  const senderJid = isGroup ? (msg.key.participant || null) : (msg.key.fromMe ? null : chatJid);
  const senderName = msg.pushName || null;

  upsertContact({
    jid: chatJid,
    name: isGroup ? (msg.message?.groupName || null) : senderName,
    isGroup,
  });

  const record = {
    msgId: msg.key.id,
    chatJid,
    senderJid,
    senderName,
    body,
    type,
    fromMe: !!msg.key.fromMe,
    timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
  };

  insertMessage(record);
  logger.debug({ msgId: record.msgId, type, chatJid }, 'message recorded');
  return record;
}
