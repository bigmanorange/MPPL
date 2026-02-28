#!/bin/zsh
APP_DIR="$HOME/server/app"
cd "$APP_DIR" || { echo "❌ Could not cd to $APP_DIR"; exit 1; }

echo "✅ Auto-Update Watcher Started in $APP_DIR"

while true; do
  # Ensure git repo
  if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Re-cloning..."
    cd ~
    rm -rf "$APP_DIR"
    git clone https://github.com/maahirvirsingh123-ctrl/MPPLtesting.git "$APP_DIR"
    cd "$APP_DIR"
  fi

  git fetch origin main &> /dev/null
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)

  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "🚀 New update! Pulling..."
    git pull origin main
    npm install
    pm2 restart maavis-hub
    echo "✅ Update applied at $(date)"
  fi

  sleep 60
done
