import { getState, setState, deleteState } from '../db/index.js';
import { config } from '../config.js';

const ACTIVE_KEY = 'active_contact_jid';

export function getActiveContact() {
  const row = getState(ACTIVE_KEY);
  if (!row) return null;
  if (Date.now() - row.updated_at > config.sessionTimeoutMs) {
    deleteState(ACTIVE_KEY);
    return null;
  }
  return row.value;
}

export function setActiveContact(jid) {
  setState(ACTIVE_KEY, jid);
}

export function clearActiveContact() {
  deleteState(ACTIVE_KEY);
}
