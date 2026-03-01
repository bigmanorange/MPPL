#!/bin/bash

# ================= CONFIG =================
REPO_DIR="/Users/macbookpro/server/app"
BRANCH="main"
PM2_PROCESS_NAME="all"
SLEEP_TIME=60   # seconds between updates
# =========================================

while true; do
    echo "🚀 Starting update at $(date)..."

    cd "$REPO_DIR" || {
        echo "❌ Failed to enter repo directory"
        sleep $SLEEP_TIME
        continue
    }

    echo "📥 Fetching latest code..."
    git fetch origin "$BRANCH"

    echo "🔄 Resetting to origin/$BRANCH..."
    git reset --hard "origin/$BRANCH"

    echo "🧹 Cleaning untracked files..."
    git clean -fd

    # Install npm dependencies if package.json exists
    if [ -f "package.json" ]; then
        echo "📦 Installing npm dependencies..."
        npm install
    fi

    # Install Python dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "🐍 Installing Python dependencies..."
        pip install -r requirements.txt
    fi

    echo "♻ Restarting website process..."
    pm2 restart "$PM2_PROCESS_NAME"

    echo "✅ Update applied at $(date)"
    echo "⏳ Sleeping for $SLEEP_TIME seconds..."
    sleep $SLEEP_TIME
done
