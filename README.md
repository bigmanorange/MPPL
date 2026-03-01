# MAAVIS TALENT HUB

Modern platform connecting talents with job opportunities.  
Features interactive UI, real-time updates, Discord bot integration, Cloudflare quick tunnel, auto-updater, and remote control via Discord.

## Key Features
- **Website**: Vite + TypeScript frontend + Node/TS backend (`server.ts`)
- **Discord Bots**:
  - `main-bot.py`: full control over website, tunnel & updater
  - `backup-bot.py`: restarts / checks main bot
- **Cloudflare Quick Tunnel** → public URL without port forwarding
- **Auto-updater** (`auto-update.sh`) – keeps code fresh
- **Two isolated PM2 instances**:
  - Default PM2 → Discord bots only
  - Second PM2 (`~/.pm2-maavis`) → website + tunnel + updater (lazy start via Discord)
- **Secure setup**: interactive prompts for all secrets (no hard-coded tokens)

## One-Command Install (macOS / Linux)

```bash
# Recommended: clean clone
git clone https://github.com/maahirvirsingh123-ctrl/MPPLtesting.git
cd MPPLtesting
chmod +x setup-server.sh
./setup-server.sh
