import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { mkdirSync } from 'fs';

const AUTH_DIR = './auth';
mkdirSync(AUTH_DIR, { recursive: true });

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR, clientId: 'default' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  },
});

client.on('qr', (qr) => {
  console.log('\nScan this QR with WhatsApp -> Linked Devices:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\nConnected! Auth saved to ./auth/ - you can Ctrl+C now.\n');
});

client.on('auth_failure', (msg) => {
  console.error('Auth failed:', msg);
  process.exit(1);
});

client.initialize().catch(console.error);
