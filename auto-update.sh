#!/bin/bash

# ================= CONFIG =================
# Use environment variables, fallback to defaults
REPO_DIR="${REPO_DIR:-$HOME/MPPLtesting/server/app}"
BRANCH="${BRANCH:-main}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-all}"

# Log file
LOG_FILE="${LOG_FILE:-$HOME/.pm2-maavis/logs/auto-update.log}"

# ================= START =================
echo "[$(date)] 🚀 Starting auto-update check..." | tee -a "$LOG_FILE"

# Ensure repo directory exists
if [ ! -d "$REPO_DIR" ]; then
    echo "❌ Repo directory $REPO_DIR not found!" | tee -a "$LOG_FILE"
    exit 1
fi

cd "$REPO_DIR" || exit 1

# Fetch latest commits
git fetch origin "$BRANCH"

# Compare local HEAD with remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/"$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ No updates found. Exiting." | tee -a "$LOG_FILE"
    exit 0
fi

echo "🚨 Update found! Pulling latest code..." | tee -a "$LOG_FILE"

# Reset local repo to remote
git reset --hard origin/"$BRANCH"
git clean -fd

# ================= DEPENDENCIES =================
echo "📦 Installing npm dependencies..." | tee -a "$LOG_FILE"
npm install 2>&1 | tee -a "$LOG_FILE"

echo "🐍 Installing Python dependencies..." | tee -a "$LOG_FILE"
pip install -r requirements.txt 2>&1 | tee -a "$LOG_FILE"

# ================= RESTART PROCESSES =================
echo "♻ Restarting PM2 processes: $PM2_PROCESS_NAME" | tee -a "$LOG_FILE"
pm2 restart "$PM2_PROCESS_NAME" --update-env

echo "✅ Auto-update completed at $(date)" | tee -a "$LOG_FILE"
