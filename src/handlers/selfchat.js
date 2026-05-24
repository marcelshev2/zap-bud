import { sendText, getSelfJid } from '../gateway/whatsapp.js';
import { searchContacts, getContact, getPool, getSession, saveSession } from '../db/index.js';
import { askBrain } from '../ai/claude.js';
import { STATES, PARENT } from '../util/fsm.js';
import { logger } from '../logger.js';

const PICK_TTL_MS = 5 * 60 * 1000;

const MENU_TEXT = `🤖 *Zap-Bud*

\`/find\` *_nome_*   entrar no cérebro de um contato
\`/find\`            buscar contato (passo a passo)
\`/who\`             contato ativo
\`/memory\`          ver memória do contato ativo
\`/help\`            este menu

Reaja 🤖 em mensagens para adicionar à memória.`;

function footer(...cmds) {
  return '\n\n' + cmds.map(c => `\`${c}\``).join('  ·  ');
}

export async function handleSelfChat(msg, body) {
  const selfJid = getSelfJid();
  if (!selfJid) return;

  const text = (body || '').trim();
  if (!text || !text.startsWith('/')) return;

  const session = getSession();
  const nextSession = await dispatch(session, text, selfJid);
  saveSession(nextSession);
}

async function dispatch(session, text, selfJid) {
  const lower = text.toLowerCase();

  if (lower === '/bud' || lower === '/help') {
    await sendText(selfJid, MENU_TEXT);
    return { state: STATES.MENU };
  }

  if (lower === '/back') {
    return goBack(session, selfJid);
  }

  if (session.state === STATES.IDLE) {
    return session;
  }

  switch (session.state) {
    case STATES.MENU:          return handleMenu(session, text, selfJid);
    case STATES.AWAITING_NAME: return handleAwaitingName(session, text, selfJid);
    case STATES.AWAITING_PICK: return handleAwaitingPick(session, text, selfJid);
    case STATES.IN_BRAIN:      return handleInBrain(session, text, selfJid);
    case STATES.AWAITING_QUESTION: return handleAwaitingQuestion(session, text, selfJid);
    default: return session;
  }
}

async function goBack(session, selfJid) {
  const parent = PARENT[session.state] ?? STATES.IDLE;
  if (parent === STATES.IDLE) {
    await sendText(selfJid, '✅ Zap-Bud pausado. Digite `/bud` para voltar.');
    return { state: STATES.IDLE };
  }
  if (parent === STATES.MENU) {
    await sendText(selfJid, MENU_TEXT);
    return { state: STATES.MENU };
  }
  if (parent === STATES.IN_BRAIN && session.activeJid) {
    return enterBrain(session.activeJid, selfJid, session);
  }
  if (parent === STATES.AWAITING_NAME) {
    await sendText(selfJid, 'Qual o nome do contato?' + footer('/back'));
    return { state: STATES.AWAITING_NAME };
  }
  await sendText(selfJid, MENU_TEXT);
  return { state: STATES.MENU };
}

async function handleMenu(session, text, selfJid) {
  const lower = text.toLowerCase();

  if (lower === '/find') {
    await sendText(selfJid, 'Qual o nome do contato?' + footer('/back'));
    return { state: STATES.AWAITING_NAME };
  }
  if (lower.startsWith('/find ')) {
    return searchAndEnter(text.slice(6).trim(), session, selfJid);
  }
  if (lower === '/who') {
    await sendText(selfJid, 'Nenhum contato ativo. Use `/find` para entrar em um.');
    return session;
  }
  if (lower === '/memory') {
    await sendText(selfJid, 'Nenhum contato ativo. Use `/find` para entrar em um.');
    return session;
  }

  await sendText(selfJid, `Comando não reconhecido. ${MENU_TEXT}`);
  return session;
}

async function handleAwaitingName(session, text, selfJid) {
  if (text.toLowerCase().startsWith('/find ')) {
    return searchAndEnter(text.slice(6).trim(), session, selfJid);
  }
  if (text.startsWith('/')) {
    await sendText(selfJid, 'Aguardando um nome de contato. `/back` para voltar.' + footer('/back'));
    return session;
  }
  return searchAndEnter(text, session, selfJid);
}

async function handleAwaitingPick(session, text, selfJid) {
  if (session.pickedAt && Date.now() - session.pickedAt > PICK_TTL_MS) {
    await sendText(selfJid, 'Seleção expirou. Qual o nome do contato?' + footer('/back'));
    return { state: STATES.AWAITING_NAME };
  }

  if (text.toLowerCase().startsWith('/find ')) {
    return searchAndEnter(text.slice(6).trim(), session, selfJid);
  }
  if (text.startsWith('/')) {
    await sendText(selfJid, 'Digite o número da lista ou `/back` para tentar outro nome.' + footer('/back'));
    return session;
  }

  const n = parseInt(text, 10);
  const candidates = session.candidates || [];
  if (isNaN(n) || n < 1 || n > candidates.length) {
    await sendText(selfJid, `Digite um número de 1 a ${candidates.length}.` + footer('/back'));
    return session;
  }
  return enterBrain(candidates[n - 1].jid, selfJid, session);
}

async function handleInBrain(session, text, selfJid) {
  const lower = text.toLowerCase();

  if (lower === '/find') {
    await sendText(selfJid, 'Qual o nome do contato?' + footer('/back'));
    return { ...session, state: STATES.AWAITING_NAME };
  }
  if (lower.startsWith('/find ')) {
    return searchAndEnter(text.slice(6).trim(), session, selfJid);
  }
  if (lower === '/ask') {
    const contact = getContact(session.activeJid);
    const name = contact?.name || session.activeJid;
    await sendText(selfJid, `Qual a pergunta sobre *${name}*?` + footer('/back'));
    return { ...session, state: STATES.AWAITING_QUESTION };
  }
  if (lower.startsWith('/ask ')) {
    return askAndReply(text.slice(5).trim(), session, selfJid);
  }
  if (lower === '/who') {
    const contact = getContact(session.activeJid);
    const name = contact?.name || session.activeJid;
    const pool = getPool(session.activeJid);
    await sendText(selfJid, `Ativo: *${name}* (${pool.length} msgs na memória)` + footer('/ask', '/memory', '/find', '/back'));
    return session;
  }
  if (lower === '/memory') {
    return showMemory(session, selfJid);
  }

  await sendText(selfJid, 'Comando não reconhecido.' + footer('/ask', '/memory', '/find', '/who', '/back'));
  return session;
}

async function handleAwaitingQuestion(session, text, selfJid) {
  if (text.startsWith('/')) {
    await sendText(selfJid, 'Aguardando sua pergunta. `/back` para voltar.' + footer('/back'));
    return session;
  }
  return askAndReply(text, session, selfJid);
}

async function searchAndEnter(query, session, selfJid) {
  if (!query) {
    await sendText(selfJid, 'Qual o nome do contato?' + footer('/back'));
    return { ...session, state: STATES.AWAITING_NAME };
  }

  const { matches } = searchContacts(query);

  if (!matches.length) {
    await sendText(selfJid,
      `❌ Não achei nenhum contato para _"${query}"_.\n\nTente outro nome ou `/back` para voltar.` +
      footer('/back'),
    );
    return { ...session, state: STATES.AWAITING_NAME };
  }

  if (matches.length === 1) {
    return enterBrain(matches[0].jid, selfJid, session);
  }

  const list = matches
    .map((c, i) => {
      const pool = getPool(c.jid);
      return `${i + 1}. ${c.name}${pool.length ? ` (${pool.length} msgs)` : ''}`;
    })
    .join('\n');

  await sendText(selfJid,
    `Achei ${matches.length}:\n${list}\n\nDigite o número, \`/find\` *_outro nome_* pra refinar, \`/back\` pra voltar.`,
  );
  return { state: STATES.AWAITING_PICK, candidates: matches, pickedAt: Date.now(), activeJid: session.activeJid };
}

async function enterBrain(jid, selfJid, session) {
  const contact = getContact(jid);
  const name = contact?.name || jid;
  const pool = getPool(jid);

  if (!pool.length) {
    await sendText(selfJid,
      `🧠 *${name}* não tem nenhuma mensagem na memória ainda.\n\nVá ao chat com ele(a) e reaja 🤖 em mensagens ou áudios para adicionar (máx 15).` +
      footer('/find', '/back'),
    );
    return { state: STATES.IN_BRAIN, activeJid: jid };
  }

  await sendText(selfJid,
    `🧠 Falando sobre *${name}* (${pool.length} msgs na memória).` +
    footer('/ask', '/memory', '/find', '/back'),
  );
  return { state: STATES.IN_BRAIN, activeJid: jid };
}

async function askAndReply(question, session, selfJid) {
  const contact = getContact(session.activeJid);
  const pool = getPool(session.activeJid);

  if (!pool.length) {
    await sendText(selfJid,
      `❌ Memória de *${contact?.name || session.activeJid}* está vazia.\n\nReaja 🤖 em mensagens no chat dele(a).` +
      footer('/find', '/back'),
    );
    return { ...session, state: STATES.IN_BRAIN };
  }

  try {
    const answer = await askBrain({ contactName: contact?.name || session.activeJid, pool, question });
    await sendText(selfJid, answer + footer('/ask', '/memory', '/find', '/back'));
  } catch (err) {
    logger.error({ err: err.message }, 'askBrain failed');
    await sendText(selfJid, '❌ Erro ao consultar o cérebro. Tenta de novo.' + footer('/ask', '/back'));
  }
  return { ...session, state: STATES.IN_BRAIN };
}

async function showMemory(session, selfJid) {
  const contact = getContact(session.activeJid);
  const name = contact?.name || session.activeJid;
  const pool = getPool(session.activeJid);

  if (!pool.length) {
    await sendText(selfJid,
      `🧠 *${name}* sem memória. Reaja 🤖 em mensagens no chat dele(a).` +
      footer('/find', '/back'),
    );
    return session;
  }

  const lines = pool.map((m, i) => {
    const who = m.from_me ? 'Eu' : (m.sender_name || name);
    const preview = (m.body || '(sem texto)').slice(0, 80);
    return `${i + 1}. ${who}: ${preview}`;
  });

  await sendText(selfJid,
    `🧠 *Memória de ${name}* (${pool.length})\n\n` + lines.join('\n') +
    footer('/ask', '/find', '/back'),
  );
  return session;
}
