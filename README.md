# zap-bud

Personal WhatsApp assistant. Two features:

1. **Auto-transcribes voice notes** you receive → transcript delivered to your self-chat.
2. **Per-contact memory brain** — react 🤖 to any message to add it to that contact's memory pool, then talk to the brain from your self-chat.

Full plan: see [`plan/README.md`](./plan/README.md).

---

## Setup

### 1. Prerequisites
- Node.js 20+
- `ffmpeg` installed and on PATH
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`

### 2. Install dependencies
```bash
npm install
```

### 3. API keys

You need **two** keys:

**A — Anthropic (the brain, required)**
1. Go to https://console.anthropic.com/settings/keys
2. Create an account (separate from Claude Pro — different billing)
3. Add ~$5 of credit
4. Create a key, copy it

**B — Groq (transcription, free)**
1. Go to https://console.groq.com/keys
2. Create a free account — no credit card needed
3. Create a key, copy it

Then in your terminal, inside the `zap-bud` folder:
```bash
cp .env.example .env
```
Open the `.env` file in any text editor (TextEdit on Mac, Notepad on Windows), paste your two keys where it says `PLACEHOLDER`, and save.

### 4. Run
```bash
npm start
```

First run: a QR code appears in the terminal. On your phone, open WhatsApp → Settings → Linked Devices → Link a device → scan it.

After that, the session is saved in `./auth/` and you won't need to scan again unless you stay offline for ~14+ days.

---

## How to use

### Adding messages to a contact's memory
1. Open any chat (1:1 or group).
2. Long-press a message or voice note → react with **🤖**.
3. The bot silently saves it to that contact's memory pool (max 15 per contact).
4. **Unreact** to hide the emoji from the other person — the bot already captured it.

Voice notes reacted with 🤖 are automatically transcribed when you first ask a question about that contact.

### Talking to a contact's brain

Go to your *Saved Messages* (self-chat). The bot only responds to `/` commands — anything else is ignored.

**Start here:**
```
/bud        → opens the command menu
```

**Finding a contact:**
```
/find               ask for a name (step by step)
/find arthur        search directly — tolerant of typos and accents
```
If multiple contacts match, the bot lists them numbered. Reply with the number to pick.

**Once inside a contact's brain:**
```
/ask                bot asks for your question (step by step)
/ask what did she say about friday?    ask directly
/who                show active contact and memory count
/memory             list everything in the memory pool
/find               switch to a different contact
/back               go up one level
```

**Navigation:**
- `/back` always goes up one level (brain → menu → silent)
- `/bud` or `/help` always returns to the main menu from anywhere

---

## Project structure

```
zap-bud/
├── plan/                  # Planning docs
├── src/
│   ├── index.js           # Entry point, wires everything
│   ├── config.js          # Env config
│   ├── logger.js          # Pino logger
│   ├── gateway/
│   │   └── whatsapp.js    # Baileys wrapper
│   ├── ai/
│   │   ├── claude.js      # Anthropic Claude — the brain
│   │   └── whisper.js     # OpenAI Whisper — transcription
│   ├── audio/
│   │   └── convert.js     # ffmpeg ogg → mp3
│   ├── db/
│   │   ├── index.js       # SQLite client
│   │   └── schema.js      # Tables
│   ├── util/
│   │   ├── match.js       # normalize, levenshtein, tokens
│   │   └── fsm.js         # FSM state constants
│   └── handlers/
│       ├── messages.js    # Record every incoming message
│       ├── contacts.js    # Sync Baileys contacts → DB
│       ├── reactions.js   # 🤖 reaction handler + lazy audio transcription
│       ├── audio.js       # Cache audio on receive, transcribe on demand
│       └── selfchat.js    # /bud wizard — FSM brain interface
├── data/                  # SQLite file (gitignored)
└── auth/                  # Baileys session files (gitignored)
```

---

## Known limits

- Runs on your laptop initially — bot is offline when laptop sleeps. Move to a VPS later if useful.
- Baileys is unofficial — low ban risk at personal volume, but real.
- Phone must come online occasionally to keep the linked-device session alive.
- ffmpeg is required for audio conversion.

---

## License

MIT.
