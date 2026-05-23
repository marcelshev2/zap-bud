export const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  jid TEXT PRIMARY KEY,
  name TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  msg_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  sender_jid TEXT,
  sender_name TEXT,
  body TEXT,
  type TEXT NOT NULL,
  from_me INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  in_pool INTEGER NOT NULL DEFAULT 0,
  added_to_pool_at INTEGER,
  PRIMARY KEY (msg_id, chat_jid)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_jid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pool ON messages(chat_jid, in_pool, added_to_pool_at DESC);

CREATE TABLE IF NOT EXISTS transcripts (
  msg_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (msg_id, chat_jid)
);

CREATE TABLE IF NOT EXISTS session_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL
);
`;
