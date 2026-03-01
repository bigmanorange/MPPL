#!/usr/bin/env bash
# setup-server.sh
# Portable one-command setup for MAAVIS TALENT HUB
# Run from inside the project directory (where package.json, main-bot.py, etc. live)
# Features: interactive secrets prompt, two separate PM2 instances, no hard-coded paths

set -e

echo "========================================"
echo "MAAVIS TALENT HUB - Setup & Deployment"
echo "========================================"
echo ""

PROJECT_DIR="$(pwd)"
echo "Working directory: $PROJECT_DIR"

# ────────────────────────────────────────────────
# 1. Detect OS & install missing system tools
# ────────────────────────────────────────────────

if [[ "$OSTYPE" == "darwin"* ]]; then
    PKG_MGR="brew"
    INSTALL_CMD="brew install"
else
    PKG_MGR="apt"
    INSTALL_CMD="sudo apt update && sudo apt install -y"
fi

command -v node >/dev/null 2>&1 || {
    echo "Node.js not found → installing..."
    if [ "$PKG_MGR" = "brew" ]; then
        $INSTALL_CMD node
    else
        $INSTALL_CMD nodejs npm
    fi
}

command -v pm2 >/dev/null 2>&1 || {
    echo "PM2 not found → installing globally..."
    sudo npm install -g pm2
}

command -v cloudflared >/dev/null 2>&1 || {
    echo "cloudflared not found → installing..."
    if [ "$PKG_MGR" = "brew" ]; then
        $INSTALL_CMD cloudflared
    else
        $INSTALL_CMD cloudflared || {
            echo "cloudflared install failed. Install manually:"
            echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/install-and-setup/tunnel-guide/local/"
            exit 1
        }
    fi
}

# ────────────────────────────────────────────────
# 2. Install Node dependencies
# ────────────────────────────────────────────────

echo "Installing npm dependencies..."
npm install

# ────────────────────────────────────────────────
# 3. Python virtual environment for Discord bots
# ────────────────────────────────────────────────

echo "Setting up Python virtual environment..."
python3 -m venv venv-discord-bot 2>/dev/null || python -m venv venv-discord-bot || {
    echo "Python venv creation failed. Make sure python3 is installed."
    exit 1
}

source venv-discord-bot/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "No requirements.txt found → installing basic deps"
    pip install discord.py python-dotenv
fi
deactivate

# ────────────────────────────────────────────────
# 4. Interactive secrets configuration (.env)
# ────────────────────────────────────────────────

echo ""
echo "=== Configure secrets (required for bots) ==="
echo "Press Enter to keep existing / skip value"

if [ -f ".env" ]; then
    source .env
    echo "(Existing .env found — you can keep current values)"
else
    touch .env
fi

prompt_and_set() {
    local var="$1"
    local msg="$2"
    local current="${!var:-empty}"

    read -p "$msg [current: $current]: " input
    if [ -n "$input" ]; then
        sed -i.bak "/^$var=/d" .env 2>/dev/null || true
        echo "$var=$input" >> .env
        rm -f .env.bak
        export "$var=$input"
    fi
}

prompt_and_set "DISCORD_TOKEN_MAIN"    "DISCORD_TOKEN_MAIN (main bot token)"
prompt_and_set "DISCORD_GUILD_ID"      "DISCORD_GUILD_ID (your server ID)"
prompt_and_set "DISCORD_OWNER_ID"      "DISCORD_OWNER_ID (your Discord user ID)"
prompt_and_set "BACKUP_TOKEN"          "BACKUP_TOKEN (backup bot — optional)"
prompt_and_set "SMTP_HOST"             "SMTP_HOST (e.g. smtp.gmail.com)"
prompt_and_set "SMTP_PORT"             "SMTP_PORT (e.g. 587)"
prompt_and_set "SMTP_USER"             "SMTP_USER (your email)"
prompt_and_set "SMTP_PASS"             "SMTP_PASS (app password)"

echo ""
echo ".env updated!"

# ────────────────────────────────────────────────
# 5. Generate ecosystem-maavis.config.js (second PM2)
# ────────────────────────────────────────────────

echo "Generating ecosystem-maavis.config.js (dynamic paths)..."
cat > ecosystem-maavis.config.js << 'EOL'
module.exports = {
  apps: [
    {
      name: 'maavis-website',
      script: 'npm',
      args: 'run dev',  // ← change to 'run build && node dist/server.js' for production
      cwd: process.cwd(),
      env: { NODE_ENV: 'development', PORT: 3000 },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'maavis-cf-tunnel',
      script: 'cloudflared',
      args: 'tunnel --url http://localhost:3000',
      cwd: process.cwd(),
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 1000
    },
    {
      name: 'maavis-updater',
      script: './auto-update.sh',
      interpreter: '/bin/bash',
      cwd: process.cwd(),
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 60000
    }
  ]
};
EOL

# Make helper scripts executable
chmod +x auto-update.sh send-tunnel-url.sh 2>/dev/null || true

# ────────────────────────────────────────────────
# 6. Start Discord bots in default PM2
# ────────────────────────────────────────────────

echo "Starting Discord bots in default PM2..."
pm2 delete main-bot 2>/dev/null || true
pm2 delete backup-bot 2>/dev/null || true

pm2 start venv-discord-bot/bin/python --name main-bot -- main-bot.py
pm2 start venv-discord-bot/bin/python --name backup-bot -- backup-bot.py

pm2 save

echo ""
echo "========================================"
echo "Setup finished!"
echo "========================================"
echo ""
echo "What to do next:"
echo "  1. Use Discord command:   /maavis_start    → starts website + tunnel + updater"
echo "  2. Check everything:      /maavis_status   → shows status + tunnel URL"
echo "  3. View bot logs:         pm2 logs main-bot"
echo "  4. View website logs:     pm2-maavis logs maavis-cf-tunnel"
echo ""
echo "Useful alias (add to ~/.zshrc or ~/.bashrc):"
echo "  alias pm2-maavis='PM2_HOME=~/.pm2-maavis pm2'"
echo ""
echo "To re-run setup or re-configure secrets:"
echo "  ./setup-server.sh"
echo ""
echo "Enjoy MAAVIS TALENT HUB!"
