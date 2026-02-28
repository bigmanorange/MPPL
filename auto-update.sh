#!/bin/zsh

# MAAVIS TALENT HUB - Auto-Update Script
# This script checks GitHub every 60 seconds for changes and restarts the app if found.

# Ensure we are in the correct directory
APP_DIR="$HOME/server/app"
cd "$APP_DIR" || { echo "❌ Error: Could not find $APP_DIR"; exit 1; }

echo "🔄 Auto-Update Watcher Started in $APP_DIR..."

PING_COUNT=0
LAST_IP=""

# Function to get public IP
get_public_ip() {
    curl -s https://ifconfig.me
}

# Attempt to detect the Cloudflare Quick Tunnel URL if not provided
# You can also manually set SITE_URL="https://your-site.trycloudflare.com"
SITE_URL=""

while true; do
    # Check for Public IP changes
    CURRENT_IP=$(get_public_ip)
    if [ "$CURRENT_IP" != "$LAST_IP" ]; then
        echo "🌐 Public IP Detected: $CURRENT_IP"
        LAST_IP="$CURRENT_IP"
    fi

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

    # Health Check Ping (Every 5 minutes / 5 loops)
    ((PING_COUNT++))
    if [ "$PING_COUNT" -ge 5 ]; then
        # Try to auto-detect URL from PM2 logs if SITE_URL is empty
        if [ -z "$SITE_URL" ]; then
            SITE_URL=$(pm2 logs cf-tunnel --lines 50 --no-colors | grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' | tail -n 1)
        fi

        if [ -n "$SITE_URL" ]; then
            echo "🔍 Performing health check ping to $SITE_URL..."
            if ! curl -s --head "$SITE_URL" | grep "200 OK" > /dev/null; then
                echo "⚠️ Website is not responding at $SITE_URL! Restarting tunnel and app..."
                pm2 restart cf-tunnel
                pm2 restart maavis-hub
                # Reset SITE_URL as it might change on tunnel restart
                SITE_URL=""
                echo "✅ Services restarted at $(date)"
            else
                echo "✅ Health check passed."
            fi
        else
            echo "⚠️ Could not detect Cloudflare URL. Checking local status instead..."
            if ! curl -s --head http://localhost:3000 | grep "200 OK" > /dev/null; then
                pm2 restart cf-tunnel
                pm2 restart maavis-hub
            fi
        fi
        PING_COUNT=0
    fi

    sleep 60
done
