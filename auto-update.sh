#!/bin/zsh

# MAAVIS TALENT HUB - Auto-Update Script
# This script checks GitHub every 60 seconds for changes and restarts the app if found.

# Ensure we are in the correct directory
APP_DIR="$HOME/server/app"
cd "$APP_DIR" || { echo "❌ Error: Could not find $APP_DIR"; exit 1; }

echo "🔄 Auto-Update Watcher Started in $APP_DIR..."

while true; do
    # Check if it's a git repo
    if [ ! -d ".git" ]; then
        echo "❌ Error: Not a git repository. Waiting..."
        sleep 60
        continue
    fi

    # Fetch the latest state from GitHub
    git fetch origin main &> /dev/null
    
    # Compare local version with remote version
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "✨ New update detected! Pulling changes..."
        git pull origin main
        
        echo "⚙️ Installing any new dependencies..."
        npm install
        
        echo "🚀 Restarting MAAVIS TALENT HUB..."
        pm2 restart maavis-hub
        
        echo "✅ Update applied successfully at $(date)"
    fi

    # Wait for 60 seconds before checking again
    sleep 60
done
