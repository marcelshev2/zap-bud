# Zap-Bud — Final Plan

A personal WhatsApp assistant with two core features:

1. **Auto-transcription** of all incoming voice notes (sent to your self-chat).
2. **Per-contact memory brain** you can chat with — react 🤖 on messages to add them to that contact's memory, then talk to the brain in self-chat.

---

## The two flows

### Flow 1 — Audio transcription (automatic)
- Someone sends you a voice note.
- Bot downloads it, converts ogg→mp3, sends to OpenAI Whisper.
- Transcript is delivered to your self-chat as: `🎙 <Contact>: <transcript>`.
- The original chat stays untouched — the other person sees nothing.

### Flow 2 — Per-contact memory (on demand)
- You tap 🤖 on a message in any chat (1:1 or group).
- Bot captures the reaction event and adds that message to that contact's memory pool.
- You untap 🤖 for social cleanup — bot ignores the remove event.
- Pool auto-prunes to the **15 most recent reacted messages** per contact.
- You go to your self-chat to talk to that contact's brain.

### Talking to a contact brain (in self-chat)
- Type a single word matching a contact name (e.g., `ana`) — bot switches into Ana's context and confirms: *"Falando sobre Ana. Pode perguntar."*
- Or use explicit prefix: `@ana`
- Once a context is active, any question you type is answered using Ana's memory pool.
- Switch contexts at any time by typing another name.
- Special commands in self-chat:
  - `/sair` — exit current context
  - `/quem` — show current active contact
  - `/lembrar` — list what's in current contact's memory

---

## Stack

| Layer | Choice |
|---|---|
| WhatsApp | Baileys (Node.js, unofficial WhatsApp Web pairing) |
| Brain (LLM) | Anthropic Claude (Haiku 4.5) |
| Transcription | OpenAI Whisper API |
| Storage | SQLite (local file) |
| Audio conversion | ffmpeg via fluent-ffmpeg |
| Runtime | Node.js 20+, runs on user's laptop initially |

---

## Locked decisions

- **Trigger**: 🤖 reaction on a message in the original chat.
- **Social cleanup**: react then unreact — bot only listens to the ADD event.
- **Context organization**: per-contact pool (no folders).
- **Pruning**: auto, last 15 reacted messages per contact.
- **Context-switching UX**: stateful — type a contact name to "enter" their brain (Option B).
- **Language**: PT-BR default, model auto-adapts to the thread's language.
- **Suggestion format**: 3 compact one-liners with varied tones.
- **Hosting**: laptop first, VPS later when validated.

---

## Out of scope for MVP

- Folders / context buckets beyond per-contact.
- Reminders, notes, tasks (originally brainstormed, deferred).
- Auto-suggestions without explicit 🤖 reaction.
- Multi-user / multi-tenant.
- Intent classification beyond contact-name detection.

---

## Known constraints (accepted)

| Constraint | Severity |
|---|---|
| Baileys account ban risk (unofficial client) | Low for personal volume |
| Laptop sleep → bot offline | Medium — disable sleep or use VPS |
| Phone must stay online | Low — normal usage is fine |
| Occasional QR re-pair | Low |
| ffmpeg required on host | Trivial one-time install |
| Two API keys (Anthropic + OpenAI) | Trivial |

---

## Budget estimate (personal use)

- Whisper (~30 voice notes/day, ~1 min each): **~R$5/month**
- Claude Haiku 4.5 (~50 brain queries/day): **~R$5–10/month**
- Total: **under R$15/month** for typical personal usage.
