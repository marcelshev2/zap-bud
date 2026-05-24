import { upsertContact } from '../db/index.js';
import { logger } from '../logger.js';

export function handleContacts(contacts) {
  let count = 0;
  for (const c of contacts) {
    const jid = c.id || c.jid;
    if (!jid) continue;
    const name = c.name || c.verifiedName || c.notify || null;
    upsertContact({ jid, name, isGroup: jid.endsWith('@g.us') });
    count++;
  }
  if (count > 0) logger.debug({ count }, 'contacts synced');
}
