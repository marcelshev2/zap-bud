import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../logger.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_BRAIN = `Você é o cérebro pessoal de um assistente de WhatsApp para um único usuário.
Você recebe um conjunto de mensagens que foram explicitamente marcadas pelo usuário como
importantes ("a memória") sobre um contato específico, e uma pergunta do usuário sobre essa memória.

Regras:
- Responda no idioma da pergunta do usuário (padrão: ${config.defaultLanguage}).
- Seja direto, breve e útil. Sem rodeios.
- Quando o usuário pedir sugestões de resposta, retorne exatamente 3 opções curtas, uma por linha, numeradas:
    1. <resposta curta e direta>
    2. <resposta neutra/intermediária>
    3. <resposta mais calorosa/longa>
- Adapte o tom ao tom das mensagens na memória.
- Se a memória estiver vazia, diga isso e peça ao usuário para marcar mensagens com 🤖.
- Nunca invente fatos que não estejam na memória. Se não souber, diga.`;

const SYSTEM_SUGGEST = `Você é o cérebro de um assistente de WhatsApp para um único usuário.
Você recebe a memória de um contato (mensagens que o usuário marcou como importantes) e a
mensagem específica que o usuário quer responder.

Sua tarefa: gerar EXATAMENTE 3 sugestões de resposta curtas, uma por linha, numeradas:
1. <curta e direta>
2. <neutra/intermediária>
3. <calorosa ou mais longa>

Regras:
- Use o idioma da conversa.
- Combine com o tom e estilo das mensagens da memória.
- Sem prefixos, sem explicações, sem disclaimers. Apenas as 3 linhas numeradas.`;

function formatPool(pool, contactName) {
  if (!pool.length) return '(memória vazia — peça ao usuário para reagir com 🤖 em mensagens)';
  return pool.map((m) => {
    const who = m.from_me ? 'Eu' : (m.sender_name || contactName || 'Contato');
    const when = new Date(m.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ');
    return `[${when}] ${who}: ${m.body || '(sem texto)'}`;
  }).join('\n');
}

export async function askBrain({ contactName, pool, question }) {
  const memory = formatPool(pool, contactName);
  const userContent = `Contato: ${contactName}\n\nMemória:\n${memory}\n\nPergunta: ${question}`;

  try {
    const res = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 600,
      system: SYSTEM_BRAIN,
      messages: [{ role: 'user', content: userContent }],
    });
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    logger.error({ err: err.message }, 'claude askBrain failed');
    return 'Não consegui consultar o cérebro agora. Tenta de novo em um instante.';
  }
}

export async function suggestReplies({ contactName, pool, targetMessage }) {
  const memory = formatPool(pool, contactName);
  const userContent = `Contato: ${contactName}\n\nMemória:\n${memory}\n\nMensagem para responder:\n"${targetMessage}"`;

  try {
    const res = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 400,
      system: SYSTEM_SUGGEST,
      messages: [{ role: 'user', content: userContent }],
    });
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    logger.error({ err: err.message }, 'claude suggestReplies failed');
    return 'Não consegui gerar sugestões agora. Tenta de novo em um instante.';
  }
}
