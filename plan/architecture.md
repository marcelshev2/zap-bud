# System Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     WhatsApp (phone)                    │
└───────────────────────────┬─────────────────────────────┘
                            │  (Baileys WebSocket)
┌───────────────────────────▼─────────────────────────────┐
│                   WhatsApp Gateway                      │
│  - Maintains Baileys session (QR auth)                  │
│  - Receives/sends messages                              │
│  - Emits events: text, audio, image, reaction           │
└────────┬──────────────────┬──────────────────┬──────────┘
         │                  │                  │
┌────────▼──────┐  ┌────────▼──────┐  ┌────────▼──────────┐
│ Audio Handler │  │ Message Router│  │ Scheduler / Cron  │
│               │  │               │  │                   │
│ - Download    │  │ - Classify    │  │ - Fire reminders  │
│   voice note  │  │   intent      │  │ - Recurring tasks │
│ - Send to     │  │ - Route to    │  └───────────────────┘
│   Whisper API │  │   handler     │
└────────┬──────┘  └───────┬───────┘
         │                 │
         │         ┌───────▼────────────────────────────┐
         │         │           Feature Handlers          │
         │         │                                     │
         │         │  ┌─────────────┐  ┌─────────────┐  │
         │         │  │  Reminder   │  │  Notes/Task │  │
         │         │  │  Handler    │  │  Handler    │  │
         │         │  └─────────────┘  └─────────────┘  │
         │         │  ┌─────────────────────────────┐    │
         │         │  │   Reply Suggestion Handler  │    │
         │         │  └─────────────────────────────┘    │
         │         └───────┬────────────────────────────┘
         │                 │
┌────────▼─────────────────▼─────────────────────────────┐
│                   OpenAI Client                         │
│  - Whisper (audio → text)                              │
│  - GPT-4o / GPT-4o-mini (intent, suggestions, chat)   │
└─────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   Persistence Layer                     │
│  - SQLite (local, single-user, zero-ops)                │
│  - Tables: messages, notes, reminders, tasks, contacts  │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. WhatsApp Gateway (`src/gateway/`)
Wraps Baileys. Responsibilities:
- Authenticate via QR code and persist the session so re-scans aren't needed.
- Emit a unified `IncomingMessage` event regardless of message type (text, audio, image, etc.).
- Provide a `send(jid, content)` method that abstracts Baileys' `sendMessage`.

### 2. Message Router (`src/router/`)
Receives every `IncomingMessage` and decides which handler(s) should process it:
- If the message contains an audio attachment → also trigger Audio Handler.
- If the message looks like a command (starts with `/` or matches intent) → route to the appropriate feature handler.
- Otherwise → trigger Reply Suggestion Handler.

### 3. Audio Handler (`src/handlers/audio.ts`)
- Downloads the voice note binary from Baileys.
- Sends it to OpenAI's Whisper API (`audio/transcriptions`).
- Returns the transcript and optionally saves it to the messages table.
- Sends the transcript back to the chat as a reply.

### 4. Reply Suggestion Handler (`src/handlers/suggestions.ts`)
- Pulls recent conversation history from the DB for that contact.
- Fetches any notes/context the user has stored about that contact.
- Calls GPT to generate 2–3 suggested replies, returned as a numbered list.
- Sends suggestions privately to the user (e.g. in a self-chat / note-to-self number).

### 5. Feature Handlers (`src/handlers/`)
- **Reminders** (`reminders.ts`): Parse natural-language time expressions, store in DB, fire via scheduler.
- **Notes** (`notes.ts`): Store and retrieve free-text notes, optionally tagged to a contact.
- **Tasks** (`tasks.ts`): Simple to-do list managed through chat commands.

### 6. Scheduler (`src/scheduler/`)
Runs a periodic job (every minute) to check for due reminders and send them via the Gateway.

### 7. OpenAI Client (`src/ai/`)
Singleton wrapper around the `openai` npm package. Exposes:
- `transcribe(audioBuffer)` → string
- `chat(messages, systemPrompt)` → string
- `classifyIntent(text)` → intent enum

### 8. Persistence Layer (`src/db/`)
SQLite via `better-sqlite3`. Schema defined in `src/db/schema.ts`, migrations in `src/db/migrations/`.

## Data Flow — Audio Message

```
User sends voice note
  → Baileys emits message event
  → Gateway emits IncomingMessage { type: 'audio', ... }
  → Router forwards to Audio Handler
  → Audio Handler downloads buffer, calls Whisper
  → Transcript saved to DB
  → Gateway sends transcript as reply in chat
  → Router also forwards to Suggestion Handler
  → Suggestion Handler builds context + calls GPT
  → Suggestions sent to self-chat
```

## Data Flow — Text Message (incoming from contact)

```
Contact sends text message
  → Gateway emits IncomingMessage { type: 'text', ... }
  → Router checks if it's a user command (starts with /)
    → No: forward to Suggestion Handler
  → Suggestion Handler: fetch history + notes, call GPT
  → Suggestions sent to self-chat
```

## Data Flow — User Command

```
User types: /remind call dentist tomorrow at 10am
  → Router detects command prefix
  → Routes to Reminder Handler
  → Handler parses date/time via GPT
  → Stores reminder in DB
  → Confirms: "Reminder set for tomorrow at 10:00"
```
