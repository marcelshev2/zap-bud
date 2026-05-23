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
  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
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
