import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { mkdirSync } from 'fs';
import pino from 'pino';

const AUTH_DIR = './auth';
mkdirSync(AUTH_DIR, { recursive: true });

const logger = pino({ level: 'silent' });

const PHONE_NUMBER = process.argv[2];

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  if (PHONE_NUMBER && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        const formatted = code.match(/.{1,4}/g).join('-');
        console.log('\n===========================================');
        console.log('PAIRING CODE:', formatted);
        console.log('===========================================');
        console.log('On WhatsApp: 3 dots -> Linked Devices ->');
        console.log('Connect with phone number -> enter this code');
        console.log('===========================================\n');
      } catch (e) {
        console.error('Failed to get pairing code:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr && !PHONE_NUMBER) {
      console.log('\nScan this QR with WhatsApp -> Linked Devices:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('\nConnected! Auth saved to ./auth/ - you can Ctrl+C now.\n');
    }
    if (connection === 'close') {
      console.log('Connection closed, retrying...');
    }
  });
}

main().catch(console.error);
