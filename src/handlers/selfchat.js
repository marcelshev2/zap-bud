import { sendText, getSelfJid } from '../gateway/whatsapp.js';
import { findContactByName, getContact, getPool } from '../db/index.js';
import { getActiveContact, setActiveContact, clearActiveContact } from '../state/session.js';
import { askBrain } from '../ai/claude.js';
import { logger } from '../logger.js';

const HELP_TEXT = `🧠 *Zap-Bud — comandos*
\`@<nome>\` — entrar no cérebro de um contato (ex: \`@ana\`)
\`<nome>\` — mesma coisa se for uma palavra só
\`/quem\` — qual contato está ativo agora
\`/sair\` — sair do contexto atual
\`/lembrar\` — listar mensagens na memória do contato ativo
\`/ajuda\` — esta mensagem

Para adicionar mensagens à memória, reaja com 🤖 em qualquer chat.`;

export async function handleSelfChat(msg, body) {
  const selfJid = getSelfJid();
  if (!selfJid) return;

  const text = (body || '').trim();
  if (!text) return;

  // Commands
  if (text === '/ajuda' || text === '/help') {
    return sendText(selfJid, HELP_TEXT);
  }
  if (text === '/sair' || text === '/exit') {
    clearActiveContact();
    return sendText(selfJid, '✅ Saí do contexto. Digite um nome para entrar em outro.');
  }
  if (text === '/quem' || text === '/who') {
    const jid = getActiveContact();
    if (!jid) return sendText(selfJid, 'Nenhum contato ativo. Digite um nome para entrar.');
    const c = getContact(jid);
    return sendText(selfJid, `Ativo: *${c?.name || jid}*`);
  }
  if (text === '/lembrar' || text === '/memory') {
    const jid = getActiveContact();
    if (!jid) return sendText(selfJid, 'Nenhum contato ativo. Digite um nome para entrar.');
    const pool = getPool(jid);
    if (!pool.length) return sendText(selfJid, 'Memória vazia. Reaja com 🤖 em mensagens para adicionar.');
    const lines = pool.map((m, i) => {
      const who = m.from_me ? 'Eu' : (m.sender_name || 'Contato');
      const preview = (m.body || '(sem texto)').slice(0, 80);
      return `${i + 1}. ${who}: ${preview}`;
    });
    return sendText(selfJid, `🧠 *Memória (${pool.length})*\n` + lines.join('\n'));
  }

  // Explicit contact switch with @
  if (text.startsWith('@')) {
    const name = text.slice(1).trim().split(/\s+/)[0];
    return switchToContact(name, selfJid);
  }

  // Single word, no spaces, no question mark, no punctuation → likely a contact name
  if (/^[\p{L}\p{N}_-]+$/u.test(text)) {
    const c = findContactByName(text);
    if (c) {
      setActiveContact(c.jid);
      return sendText(selfJid, `🧠 Falando sobre *${c.name}*. Pode perguntar.`);
    }
  }

  // Otherwise → query the active brain
  const activeJid = getActiveContact();
  if (!activeJid) {
    return sendText(selfJid,
      'Nenhum contato ativo. Digite um nome (ex: `ana` ou `@ana`) para entrar em um cérebro.\n\n`/ajuda` para ver comandos.',
    );
  }

  const contact = getContact(activeJid);
  const pool = getPool(activeJid);
  const answer = await askBrain({
    contactName: contact?.name || activeJid,
    pool,
    question: text,
  });

  return sendText(selfJid, answer);
}

async function switchToContact(name, selfJid) {
  const c = findContactByName(name);
  if (!c) {
    return sendText(selfJid, `Não achei nenhum contato chamado "${name}". Tente outro nome.`);
  }
  setActiveContact(c.jid);
  return sendText(selfJid, `🧠 Falando sobre *${c.name}*. Pode perguntar.`);
}
