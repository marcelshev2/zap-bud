import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { config } from '../config.js';
import { logger } from '../logger.js';

const baileysLogger = pino({ level: 'warn' });

let sock = null;
let selfJid = null;
let isConnecting = false;
let reconnectTimer = null;
const listeners = {
  message: [],
  reaction: [],
  ready: [],
  contacts: [],
};

export function onMessage(fn) { listeners.message.push(fn); }
export function onReaction(fn) { listeners.reaction.push(fn); }
export function onReady(fn) { listeners.ready.push(fn); }
export function onContacts(fn) { listeners.contacts.push(fn); }

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
  if (isConnecting) return;
  isConnecting = true;
  clearTimeout(reconnectTimer);

  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info('Scan this QR code with WhatsApp (Settings -> Linked Devices):');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      isConnecting = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ shouldReconnect, reason: lastDisconnect?.error?.message, statusCode }, 'connection closed');
      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          start().catch((e) => {
            logger.error({ err: e.message }, 'reconnect failed');
            isConnecting = false;
          });
        }, 5000);
      }
    } else if (connection === 'open') {
      isConnecting = false;
      selfJid = jidNormalizedUser(sock.user.id);
      logger.info({ selfJid }, 'whatsapp connected');
      for (const fn of listeners.ready) fn(selfJid);
    }
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    for (const fn of listeners.contacts) {
      try { fn(contacts); } catch (e) { logger.error({ err: e.message }, 'contacts handler failed'); }
    }
  });

  sock.ev.on('contacts.update', (contacts) => {
    for (const fn of listeners.contacts) {
      try { fn(contacts); } catch (e) { logger.error({ err: e.message }, 'contacts handler failed'); }
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
