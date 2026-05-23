import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';
import { logger } from '../logger.js';

let client = null;
let selfJid = null;
const listeners = { message: [], reaction: [], ready: [] };

export function onMessage(fn) { listeners.message.push(fn); }
export function onReaction(fn) { listeners.reaction.push(fn); }
export function onReady(fn) { listeners.ready.push(fn); }
export function getSelfJid() { return selfJid; }
export function getSocket() { return client; }

function toBaileysMsg(msg) {
  const isGroup = msg.from?.endsWith('@g.us');
  const remoteJid = msg.fromMe ? (msg.to || msg.from) : msg.from;

  let messageObj = {};
  switch (msg.type) {
    case 'chat':
      messageObj = { conversation: msg.body };
      break;
    case 'ptt':
    case 'audio':
      messageObj = { audioMessage: { ptt: msg.type === 'ptt' } };
      break;
    case 'image':
      messageObj = { imageMessage: { caption: msg.body || '' } };
      break;
    case 'video':
      messageObj = { videoMessage: { caption: msg.body || '' } };
      break;
    case 'document':
      messageObj = { documentMessage: { caption: msg.body || '' } };
      break;
    case 'sticker':
      messageObj = { stickerMessage: {} };
      break;
    default:
      messageObj = {};
  }

  return {
    key: {
      id: msg.id.id,
      remoteJid,
      fromMe: msg.fromMe,
      participant: isGroup ? msg.author : undefined,
    },
    message: messageObj,
    pushName: msg._data?.notifyName || null,
    messageTimestamp: msg.timestamp,
    _wwMsg: msg,
  };
}

export async function sendText(jid, text) {
  if (!client) throw new Error('Client not ready');
  return client.sendMessage(jid, text);
}

export async function downloadAudio(msg) {
  const wwMsg = msg._wwMsg;
  if (!wwMsg) throw new Error('No wwebjs message reference');
  const media = await wwMsg.downloadMedia();
  if (!media) throw new Error('Could not download media');
  return Buffer.from(media.data, 'base64');
}

function makePuppeteerArgs() {
  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
    ],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  };
}

export async function start() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.authDir, clientId: 'default' }),
    puppeteer: makePuppeteerArgs(),
  });

  client.on('qr', (qr) => {
    logger.info('Scan this QR with WhatsApp -> Linked Devices:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    selfJid = client.info.wid._serialized;
    logger.info({ selfJid }, 'whatsapp connected');
    for (const fn of listeners.ready) fn(selfJid);
  });

  client.on('message', async (msg) => {
    if (msg.type === 'reaction') return;
    const baileysMsg = toBaileysMsg(msg);
    for (const fn of listeners.message) {
      try { await fn(baileysMsg); } catch (e) { logger.error({ err: e.message }, 'message handler failed'); }
    }
  });

  client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    if (msg.type === 'reaction') return;
    const baileysMsg = toBaileysMsg(msg);
    for (const fn of listeners.message) {
      try { await fn(baileysMsg); } catch (e) { logger.error({ err: e.message }, 'message handler failed'); }
    }
  });

  client.on('message_reaction', async (reaction) => {
    const baileysReaction = {
      key: {
        id: reaction.msgId.id,
        remoteJid: reaction.msgId.remote,
        fromMe: reaction.msgId.fromMe,
      },
      reaction: {
        key: {
          fromMe: reaction.senderId === selfJid,
          id: reaction.id.id,
        },
        text: reaction.reaction,
      },
    };
    for (const fn of listeners.reaction) {
      try { await fn(baileysReaction); } catch (e) { logger.error({ err: e.message }, 'reaction handler failed'); }
    }
  });

  client.on('auth_failure', (msg) => {
    logger.error({ msg }, 'auth failure — delete auth/ and restart to re-link');
  });

  client.on('disconnected', (reason) => {
    logger.warn({ reason }, 'client disconnected, reinitializing in 5s');
    setTimeout(() => start().catch(e => logger.error({ err: e.message }, 'reconnect failed')), 5000);
  });

  await client.initialize();
  return client;
}
