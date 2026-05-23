import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { config } from '../config.js';
import { logger } from '../logger.js';

const baileysLogger = pino({ level: 'warn' });

let sock = null;
let selfJid = null;
const listeners = {
  message: [],
  reaction: [],
  ready: [],
};

export function onMessage(fn) { listeners.message.push(fn); }
export function onReaction(fn) { listeners.reaction.push(fn); }
export function onReady(fn) { listeners.ready.push(fn); }

export function getSelfJid() { return selfJid; }
export function getSocket() { return sock; }

export async function sendText(jid, text, quotedMsg) {
  if (!sock) throw new Error('Socket not ready');
  const options = quotedMsg ? { quoted: quotedMsg } : {};
  return sock.sendMessage(jid, { text }, options);
}

export async function downloadAudio(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {}, { logger: baileysLogger });
  return buffer;
}

export async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info('Scan this QR code with WhatsApp (Settings → Linked Devices):');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.warn({ shouldReconnect, reason: lastDisconnect?.error?.message }, 'connection closed');
      if (shouldReconnect) start().catch((e) => logger.error({ err: e.message }, 'reconnect failed'));
    } else if (connection === 'open') {
      selfJid = jidNormalizedUser(sock.user.id);
      logger.info({ selfJid }, 'whatsapp connected');
      for (const fn of listeners.ready) fn(selfJid);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      for (const fn of listeners.message) {
        try { await fn(msg); } catch (e) { logger.error({ err: e.message }, 'message handler failed'); }
      }
    }
  });

  sock.ev.on('messages.reaction', async (reactions) => {
    for (const reaction of reactions) {
      for (const fn of listeners.reaction) {
        try { await fn(reaction); } catch (e) { logger.error({ err: e.message }, 'reaction handler failed'); }
      }
    }
  });

  return sock;
}
