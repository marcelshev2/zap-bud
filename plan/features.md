# Feature Specifications

## 1. Audio Transcription

**Trigger**: Any incoming message that contains a voice note (audio/ogg or audio/mp4).

**Flow**:
1. Bot automatically downloads the audio attachment.
2. Sends it to OpenAI Whisper (`whisper-1` model).
3. Replies directly in the same chat: `🎙 Transcript: <text>`.
4. Saves the transcript alongside the original message in the DB.

**Notes**:
- No user action required — it's always on for voice notes.
- If Whisper fails, reply with a polite error; do not crash.
- Language auto-detection (Whisper handles this natively).

---

## 2. Answer Suggestions

**Trigger**: Any text message received from a contact (not a group, not the user themselves).

**Flow**:
1. Fetch the last N messages exchanged with that contact (default N=20).
2. Fetch any stored notes about that contact.
3. Send context + incoming message to GPT with a system prompt that instructs it to generate 2–3 distinct reply options.
4. Deliver suggestions to the user's self-chat (the "Saved Messages" / own number chat).

**Suggestion format delivered to self-chat**:
```
💬 Reply suggestions for *<Contact Name>*:
1. <option 1>
2. <option 2>
3. <option 3>
```

**Notes**:
- Suggestions are sent to self-chat so the main conversation stays clean.
- User can copy-paste the suggestion they like.
- Context injection: if the user has a note like "Ana is my sister, lives in São Paulo", that gets prepended to the GPT prompt.

---

## 3. Reminders

**Trigger**: User sends a message starting with `/remind` (or a natural-language equivalent detected by intent classifier).

**Commands**:
| Command | Example |
|---|---|
| Set reminder | `/remind call dentist tomorrow at 10am` |
| List reminders | `/reminders` |
| Delete reminder | `/remind delete 3` (by ID shown in list) |

**Flow**:
1. Pass the full command text to GPT to extract: subject, datetime (ISO string), recurrence (if any).
2. Store in `reminders` table.
3. Confirm: `✅ Reminder set for <date/time>: <subject>`.
4. Scheduler fires a WhatsApp message to the user at the due time.

---

## 4. Notes

**Trigger**: User sends a message starting with `/note`.

**Commands**:
| Command | Example |
|---|---|
| Save note | `/note Call the bank about account #4321` |
| Save note about contact | `/note @Ana Her birthday is June 12` |
| List notes | `/notes` |
| Search notes | `/notes bank` |
| Delete note | `/note delete 5` |

**Flow**:
1. Parse command to extract: content, optional contact tag.
2. Store in `notes` table.
3. Confirm: `📝 Note saved.`
4. Notes tagged to a contact are automatically injected as context into suggestions for that contact.

---

## 5. Tasks

**Trigger**: User sends a message starting with `/task` or `/todo`.

**Commands**:
| Command | Example |
|---|---|
| Add task | `/task Buy groceries` |
| List tasks | `/tasks` |
| Complete task | `/task done 2` |
| Delete task | `/task delete 2` |

**Flow**:
1. Store task in `tasks` table with status `pending`.
2. `/tasks` returns a formatted checklist.
3. Completing marks it `done` (soft delete, kept for history).

---

## 6. Help

**Trigger**: `/help` or when the user sends an unrecognised command.

Sends a formatted command reference to the user's chat.

---

## Intent Classification (optional enhancement)

Instead of requiring strict `/` prefixes, a lightweight GPT call can classify the user's free-text message into one of:
- `reminder_set`, `reminder_list`, `reminder_delete`
- `note_save`, `note_list`, `note_search`
- `task_add`, `task_list`, `task_complete`
- `general_chat` (no command)

This allows more natural inputs like "remind me to call mom tonight" without the `/remind` prefix.
