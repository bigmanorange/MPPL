#!/usr/bin/env bash
# setup-server.sh
# MAAVIS TALENT HUB — Portable Setup (NGROK VERSION)

set -e

echo "========================================"
echo "MAAVIS TALENT HUB - Setup & Deployment"
echo "========================================"
echo ""

PROJECT_DIR="$(pwd)"
echo "Initial working directory: $PROJECT_DIR"

# ────────────────────────────────────────────────
# 0. Create folder structure
# ────────────────────────────────────────────────
if [ ! -d "server/app" ]; then
    echo "Creating nested structure: server/app and server/data"
    mkdir -p server/app server/data
fi

shopt -s extglob dotglob nullglob
mv !(setup-server.sh) server/app/ 2>/dev/null || true

cd server/app
PROJECT_DIR="$(pwd)"
echo "Now working inside: $PROJECT_DIR"

# ────────────────────────────────────────────────
# 1. Detect OS & install tools
# ────────────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
    INSTALL_CMD="brew install"
else
    INSTALL_CMD="sudo apt update && sudo apt install -y"
fi

command -v node >/dev/null || {
    echo "Installing Node..."
    $INSTALL_CMD node
}

command -v pm2 >/dev/null || {
    echo "Installing PM2..."
    sudo npm install -g pm2
}

# ✅ INSTALL NGROK (replaces cloudflared)
command -v ngrok >/dev/null || {
    echo "Installing ngrok..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ngrok/ngrok/ngrok
    else
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
          | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
          | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update
        sudo apt install ngrok
    fi
}

# ────────────────────────────────────────────────
# 2. Install Node deps
# ────────────────────────────────────────────────
echo "Installing npm dependencies..."
npm install

# ────────────────────────────────────────────────
# 3. Python venv
# ────────────────────────────────────────────────
echo "Setting up Python virtual environment..."

python3 -m venv venv-discord-bot 2>/dev/null || python -m venv venv-discord-bot

source venv-discord-bot/bin/activate
pip install --upgrade pip

if [ -f requirements.txt ]; then
    pip install -r requirements.txt
else
    pip install discord.py python-dotenv requests
fi

deactivate

# ────────────────────────────────────────────────
# 4. Interactive .env setup
# ────────────────────────────────────────────────
echo ""
echo "=== Configure secrets ==="

[ -f ".env" ] || touch .env
source .env || true

prompt_and_set () {
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

prompt_and_set "DISCORD_TOKEN_MAIN" "DISCORD_TOKEN_MAIN"
prompt_and_set "DISCORD_GUILD_ID"   "DISCORD_GUILD_ID"
prompt_and_set "DISCORD_OWNER_ID"   "DISCORD_OWNER_ID"
prompt_and_set "BACKUP_TOKEN"       "BACKUP_TOKEN (optional)"

# ✅ NEW ENV FOR NGROK
prompt_and_set "NGROK_AUTHTOKEN" "NGROK_AUTHTOKEN (from dashboard.ngrok.com)"
prompt_and_set "NGROK_PORT"      "NGROK_PORT (default 3000)"

# Configure ngrok auth automatically
if grep -q NGROK_AUTHTOKEN .env; then
    source .env
    ngrok config add-authtoken "$NGROK_AUTHTOKEN"
fi

echo ".env updated!"

# ────────────────────────────────────────────────
# 5. Generate ecosystem (NGROK)
# ────────────────────────────────────────────────
echo "Generating ecosystem-maavis.config.cjs..."

cat > ecosystem-maavis.config.cjs << 'EOL'
module.exports = {
  apps: [
    {
      name: "maavis-website",
      script: "npm",
      args: "run dev",
      cwd: __dirname,

      autorestart: true,
      restart_delay: 5000,     // wait 5s before restart
      max_restarts: 20,
      min_uptime: "10s",

      env: {
        NODE_ENV: "development",
        PORT: 3000
      }
    },

    {
      name: "maavis-ngrok",
      script: "ngrok",
      args: "http 3000",
      cwd: __dirname,

      autorestart: true,
      restart_delay: 8000,     // ngrok needs longer cooldown
      max_restarts: 15,
      min_uptime: "15s"
    },

    {
      name: "maavis-updater",
      script: "./auto-update.sh",
      interpreter: "/bin/bash",
      cwd: __dirname,

      autorestart: true,
      restart_delay: 15000,    // updater should NEVER spam restarts
      max_restarts: 10,
      min_uptime: "20s"
    }
  ]
};
EOL

# ────────────────────────────────────────────────
# 6. Start Discord bots (default PM2)
# ────────────────────────────────────────────────
echo "Starting Discord bots..."

pm2 delete main-bot 2>/dev/null || true
pm2 delete backup-bot 2>/dev/null || true

pm2 start venv-discord-bot/bin/python --name main-bot -- main-bot.py
pm2 start venv-discord-bot/bin/python --name backup-bot -- backup-bot.py

pm2 save

echo ""
echo "========================================"
echo "SETUP COMPLETE"
echo "========================================"
echo ""
echo "Run in Discord:"
echo "  /maavis_start"
echo "  /maavis_status"
echo ""
echo "View logs:"
echo "  pm2 logs main-bot"
echo ""
