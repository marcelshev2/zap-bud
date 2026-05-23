import { downloadAudio, sendText, getSelfJid } from '../gateway/whatsapp.js';
import { writeBufferToTmp, oggToMp3, cleanup } from '../audio/convert.js';
import { transcribeFile } from '../ai/whisper.js';
import { saveTranscript, getContact } from '../db/index.js';
import { logger } from '../logger.js';

export async function handleAudio(msg) {
  if (!msg.message?.audioMessage) return;
  if (msg.key?.fromMe) return; // skip our own voice notes

  const chatJid = msg.key.remoteJid;
  const msgId = msg.key.id;
  if (!chatJid || !msgId) return;

  let oggPath = null;
  let mp3Path = null;

  try {
    const buffer = await downloadAudio(msg);
    oggPath = writeBufferToTmp(buffer, '.ogg');
    mp3Path = await oggToMp3(oggPath);

    const transcript = await transcribeFile(mp3Path);
    if (!transcript) return;

    saveTranscript(msgId, chatJid, transcript);

    const contact = getContact(chatJid);
    const contactName = contact?.name || msg.pushName || chatJid.split('@')[0];

    const selfJid = getSelfJid();
    if (!selfJid) return;

    const header = `🎙 *${contactName}*\n`;
    await sendText(selfJid, header + transcript);
    logger.info({ msgId, chatJid, contactName }, 'audio transcribed');
  } catch (err) {
    logger.error({ err: err.message, msgId, chatJid }, 'audio transcription failed');
  } finally {
    cleanup(oggPath, mp3Path);
  }
}
