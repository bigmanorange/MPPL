#!/usr/bin/env bash
# setup-server.sh
# Portable one-command setup for MAAVIS TALENT HUB
# Features: interactive secrets prompt, two separate PM2 instances, no hard-coded paths

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

# Move all project files (except setup script) into server/app
shopt -s extglob dotglob nullglob
mv !(setup-server.sh) server/app/ 2>/dev/null || true

# Ensure auto-update.sh exists
if [ ! -f "server/app/auto-update.sh" ]; then
    echo "Creating placeholder auto-update.sh..."
    cat > server/app/auto-update.sh << 'EOL'
#!/usr/bin/env bash
echo "Auto-update placeholder — implement your updater here"
EOL
fi

# Ensure send-tunnel-url.sh exists
if [ ! -f "server/app/send-tunnel-url.sh" ]; then
    echo "Creating placeholder send-tunnel-url.sh..."
    cat > server/app/send-tunnel-url.sh << 'EOL'
#!/usr/bin/env bash
echo "Send tunnel URL placeholder"
EOL
fi

chmod +x server/app/auto-update.sh server/app/send-tunnel-url.sh

# Move into app folder for the rest of the setup
cd server/app
PROJECT_DIR="$(pwd)"
echo "Now working inside: $PROJECT_DIR"

# ────────────────────────────────────────────────
# 1. Detect OS & install missing tools
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
prompt_and_set "AUTO_UPDATE_SCRIPT"    "Path to auto-update.sh (optional, default: ./auto-update.sh)"

echo ""
echo ".env updated!"

# ────────────────────────────────────────────────
# 5. Generate ecosystem-maavis.config.cjs (second PM2)
# ────────────────────────────────────────────────
echo "Generating ecosystem-maavis.config.cjs..."
cat > ecosystem-maavis.config.cjs << EOL
module.exports = {
  apps: [
    {
      name: 'maavis-website',
      script: 'npm',
      args: 'run dev',
      cwd: __dirname,
      env: { NODE_ENV: 'development', PORT: 3000 },
      autorestart: true,
      watch: false
    },
    {
      name: 'maavis-cf-tunnel',
      script: 'cloudflared',
      args: 'tunnel --url http://localhost:3000',
      cwd: __dirname,
      autorestart: true,
      maxrestart:1,
      watch: false
    },
    {
      name: 'maavis-updater',
      script: './auto-update.sh',
      interpreter: '/bin/bash',
      cwd: __dirname,
      autorestart: true,
      watch: false
    }
  ]
};
EOL

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

# ────────────────────────────────────────────────
# 7. Summary / Next Steps
# ────────────────────────────────────────────────
echo ""
echo "========================================"
echo "Setup finished!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Discord: /maavis_start → starts website + tunnel + updater"
echo "  2. Discord: /maavis_status → shows status + tunnel URL"
echo "  3. View bot logs: pm2 logs main-bot"
echo "  4. View website logs: pm2-maavis logs maavis-cf-tunnel"
echo ""
echo "Useful alias:"
echo "  alias pm2-maavis='PM2_HOME=~/.pm2-maavis pm2'"
echo ""
echo "Re-run setup or re-configure secrets:"
echo "  ./setup-server.sh"
echo ""
echo "Enjoy MAAVIS TALENT HUB!"
