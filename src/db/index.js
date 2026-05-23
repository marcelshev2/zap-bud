import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';
import { logger } from '../logger.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);

logger.info({ path: config.dbPath }, 'db ready');

// Contacts

const upsertContactStmt = db.prepare(`
  INSERT INTO contacts (jid, name, is_group, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(jid) DO UPDATE SET
    name = COALESCE(excluded.name, name),
    is_group = excluded.is_group,
    updated_at = excluded.updated_at
`);

export function upsertContact({ jid, name, isGroup }) {
  upsertContactStmt.run(jid, name || null, isGroup ? 1 : 0, Date.now());
}

const findContactByNameStmt = db.prepare(`
  SELECT jid, name, is_group FROM contacts
  WHERE LOWER(name) = LOWER(?)
  LIMIT 1
`);

export function findContactByName(name) {
  return findContactByNameStmt.get(name);
}

const getContactStmt = db.prepare(`SELECT jid, name, is_group FROM contacts WHERE jid = ?`);
export function getContact(jid) {
  return getContactStmt.get(jid);
}

// Messages

const insertMessageStmt = db.prepare(`
  INSERT OR REPLACE INTO messages
    (msg_id, chat_jid, sender_jid, sender_name, body, type, from_me, timestamp, in_pool, added_to_pool_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?,
    COALESCE((SELECT in_pool FROM messages WHERE msg_id = ? AND chat_jid = ?), 0),
    (SELECT added_to_pool_at FROM messages WHERE msg_id = ? AND chat_jid = ?)
  )
`);

export function insertMessage(m) {
  insertMessageStmt.run(
    m.msgId, m.chatJid, m.senderJid || null, m.senderName || null,
    m.body || null, m.type, m.fromMe ? 1 : 0, m.timestamp,
    m.msgId, m.chatJid, m.msgId, m.chatJid,
  );
}

const getMessageStmt = db.prepare(`SELECT * FROM messages WHERE msg_id = ? AND chat_jid = ?`);
export function getMessage(msgId, chatJid) {
  return getMessageStmt.get(msgId, chatJid);
}

// Pool management

const addToPoolStmt = db.prepare(`
  UPDATE messages SET in_pool = 1, added_to_pool_at = ?
  WHERE msg_id = ? AND chat_jid = ?
`);

const poolByChatStmt = db.prepare(`
  SELECT msg_id, sender_name, body, timestamp, from_me
  FROM messages
  WHERE chat_jid = ? AND in_pool = 1
  ORDER BY added_to_pool_at DESC
`);

const oldestPoolEntriesStmt = db.prepare(`
  SELECT msg_id FROM messages
  WHERE chat_jid = ? AND in_pool = 1
  ORDER BY added_to_pool_at ASC
  LIMIT ?
`);

const removeFromPoolStmt = db.prepare(`
  UPDATE messages SET in_pool = 0, added_to_pool_at = NULL
  WHERE msg_id = ? AND chat_jid = ?
`);

export function addToPool(msgId, chatJid) {
  addToPoolStmt.run(Date.now(), msgId, chatJid);
  prunePool(chatJid);
}

export function prunePool(chatJid) {
  const all = poolByChatStmt.all(chatJid);
  const excess = all.length - config.poolSize;
  if (excess > 0) {
    const toRemove = oldestPoolEntriesStmt.all(chatJid, excess);
    for (const row of toRemove) {
      removeFromPoolStmt.run(row.msg_id, chatJid);
    }
  }
}

export function getPool(chatJid) {
  return poolByChatStmt.all(chatJid).reverse(); // chronological order for the LLM
}

// Transcripts

const saveTranscriptStmt = db.prepare(`
  INSERT OR REPLACE INTO transcripts (msg_id, chat_jid, text, created_at)
  VALUES (?, ?, ?, ?)
`);

export function saveTranscript(msgId, chatJid, text) {
  saveTranscriptStmt.run(msgId, chatJid, text, Date.now());
}

// Session state (for current active contact in self-chat)

const getStateStmt = db.prepare(`SELECT value, updated_at FROM session_state WHERE key = ?`);
const setStateStmt = db.prepare(`
  INSERT INTO session_state (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const deleteStateStmt = db.prepare(`DELETE FROM session_state WHERE key = ?`);

export function getState(key) {
  return getStateStmt.get(key);
}
export function setState(key, value) {
  setStateStmt.run(key, value, Date.now());
}
export function deleteState(key) {
  deleteStateStmt.run(key);
}

export default db;
