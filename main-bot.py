#!/usr/bin/env bash
# setup-server.sh - Portable installer for MAAVIS TALENT HUB
# Works on macOS / Linux - runs in current directory or nested server/app
# Features: interactive secrets, two PM2 instances, .cjs ecosystem file

set -e

echo "========================================"
echo "MAAVIS TALENT HUB - Setup & Deployment"
echo "========================================"
echo ""

# ────────────────────────────────────────────────
# Detect and move to the correct working directory
# ────────────────────────────────────────────────

ORIGINAL_DIR="$(pwd)"

# If we're in a nested structure (server/app), cd inside
if [ -d "server/app" ]; then
    cd server/app
    echo "Detected nested structure → moved into server/app"
elif [ -f "main-bot.py" ] && [ -f "server.ts" ]; then
    echo "Running in flat project root"
else
    echo "Warning: No main-bot.py or server.ts found here."
    echo "Make sure you run this from the repo root or server/app folder."
fi

PROJECT_DIR="$(pwd)"
echo "Working directory: $PROJECT_DIR"

# ────────────────────────────────────────────────
# 1. Install system dependencies if missing
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
    $INSTALL_CMD node || { echo "Node install failed - install manually"; exit 1; }
}

command -v pm2 >/dev/null 2>&1 || {
    echo "PM2 not found → installing globally..."
    sudo npm install -g pm2
}

command -v cloudflared >/dev/null 2>&1 || {
    echo "cloudflared not found → installing..."
    $INSTALL_CMD cloudflared || {
        echo "cloudflared install failed. Install manually:"
        echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/install-and-setup/tunnel-guide/local/"
        exit 1
    }
}

# ────────────────────────────────────────────────
# 2. Node dependencies
# ────────────────────────────────────────────────

echo "Installing npm dependencies..."
npm install || { echo "npm install failed - check package.json"; exit 1; }

# ────────────────────────────────────────────────
# 3. Python venv for Discord bots
# ────────────────────────────────────────────────

echo "Setting up Python virtual environment..."
python3 -m venv venv-discord-bot 2>/dev/null || python -m venv venv-discord-bot || {
    echo "Failed to create venv. Ensure python3 is installed."
    exit 1
}

source venv-discord-bot/bin/activate
pip install --upgrade pip
if [ -f "../requirements.txt" ] || [ -f "requirements.txt" ]; then
    pip install -r ../requirements.txt 2>/dev/null || pip install -r requirements.txt
else
    echo "No requirements.txt → installing minimal deps"
    pip install discord.py python-dotenv
fi
deactivate

# ────────────────────────────────────────────────
# 4. Interactive secrets (.env)
# ────────────────────────────────────────────────

echo ""
echo "=== Configure secrets (required for bots & features) ==="
echo "Press Enter to keep existing value or skip"

if [ -f ".env" ]; then
    source .env
    echo "(Existing .env detected)"
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
prompt_and_set "DISCORD_OWNER_ID"      "DISCORD_OWNER_ID (your user ID - restricts commands)"
prompt_and_set "BACKUP_TOKEN"          "BACKUP_TOKEN (backup bot - optional)"
prompt_and_set "SMTP_HOST"             "SMTP_HOST (e.g. smtp.gmail.com)"
prompt_and_set "SMTP_PORT"             "SMTP_PORT (e.g. 587)"
prompt_and_set "SMTP_USER"             "SMTP_USER (your email)"
prompt_and_set "SMTP_PASS"             "SMTP_PASS (Gmail app password)"

echo ""
echo ".env updated!"

# ────────────────────────────────────────────────
# 5. Generate ecosystem file (CommonJS .cjs extension)
# ────────────────────────────────────────────────

echo "Generating ecosystem-maavis.config.cjs..."
cat > ecosystem-maavis.config.cjs << 'EOL'
module.exports = {
  apps: [
    {
      name: 'maavis-website',
      script: 'npm',
      args: 'run dev',
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

chmod +x auto-update.sh send-tunnel-url.sh 2>/dev/null || true

# ────────────────────────────────────────────────
# 6. Start Discord bots in default PM2
# ────────────────────────────────────────────────

echo "Starting Discord bots..."
pm2 delete main-bot 2>/dev/null || true
pm2 delete backup-bot 2>/dev/null || true

pm2 start venv-discord-bot/bin/python --name main-bot -- main-bot.py
pm2 start venv-discord-bot/bin/python --name backup-bot -- backup-bot.py

pm2 save

# ────────────────────────────────────────────────
# Final instructions
# ────────────────────────────────────────────────

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. In Discord → /maavis_start    (starts website + tunnel + updater)"
echo "  2. Check status → /maavis_status (shows processes + tunnel URL)"
echo ""
echo "Useful commands:"
echo "  pm2 list                      → default PM2 (bots)"
echo "  pm2-maavis list               → second PM2 (website stack)"
echo "  pm2-maavis logs maavis-cf-tunnel  → tunnel URL"
echo ""
echo "Add alias (run once):"
echo "  echo \"alias pm2-maavis='PM2_HOME=~/.pm2-maavis pm2'\" >> ~/.zshrc"
echo "  source ~/.zshrc"
echo ""
echo "To reconfigure secrets:"
echo "  ./setup-server.sh"
echo ""
echo "Enjoy!"
