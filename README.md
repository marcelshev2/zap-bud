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
Get the two keys you need:
- **Anthropic** (Claude — the brain): https://console.anthropic.com/settings/keys
- **OpenAI** (Whisper — transcription only): https://platform.openai.com/api-keys

Then:
```bash
cp .env.example .env
# edit .env and paste your two keys
```

> Your Claude Pro subscription does NOT include API access — the Anthropic console above is a separate, pay-per-use billing account. Add ~$5 of credit and you're good for months.

### 4. Run
```bash
npm start
```

First run: a QR code appears in the terminal. On your phone, open WhatsApp → Settings → Linked Devices → Link a device → scan it.

After that, the session is saved in `./auth/` and you won't need to scan again unless you stay offline for ~14+ days.

---

## How to use

### Voice note transcription
Just receive any voice note normally. A few seconds later, the transcript shows up in your *Saved Messages* (self-chat) tagged with the sender's name. The other person sees nothing.

### Adding messages to a contact's memory
1. Open any chat (1:1 or group).
2. Long-press a message → react with **🤖**.
3. The bot saves it to that contact's memory pool.
4. **Unreact** to hide the bot emoji from the other person — the bot already captured it.
5. You also get an instant suggestion reply (3 options) in your self-chat for the message you just reacted to.

Pool auto-prunes to the **15 most recent** reacted messages per contact.

### Talking to a contact's brain
Go to your *Saved Messages* (self-chat) and type:

| You type | What happens |
|---|---|
| `ana` or `@ana` | Enter Ana's brain. Bot confirms: *"Falando sobre Ana. Pode perguntar."* |
| `o que ela disse sobre sexta?` | Bot answers using Ana's memory pool |
| `me sugere uma resposta` | Bot generates 3 options based on the memory |
| `/quem` | Shows current active contact |
| `/lembrar` | Lists everything currently in Ana's memory |
| `/sair` | Exits Ana's context |
| `/ajuda` | Help |

The active contact resets after 30 minutes of inactivity (configurable in `.env`).

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
│   ├── state/
│   │   └── session.js     # Stateful "active contact" tracking
│   └── handlers/
│       ├── messages.js    # Record every incoming message
│       ├── reactions.js   # 🤖 reaction handler
│       ├── audio.js       # Voice note transcription handler
│       └── selfchat.js    # Brain conversation handler
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
