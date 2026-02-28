#!/bin/bash

# Path to your PM2 logs (adjust if needed)
LOG_FILE="$HOME/.pm2/logs/cf-tunnel-out.log"

# Find the most recent tunnel URL
URL=$(grep -A 5 "Your quick Tunnel has been created" "$LOG_FILE" | grep -o 'https://[-a-z0-9]\+\.trycloudflare\.com' | tail -n 1)

if [ -z "$URL" ]; then
  MESSAGE="⚠️ No active tunnel URL found in logs. Restart cf-tunnel or check pm2 logs."
else
  MESSAGE="🌐 Current public tunnel URL:\n**$URL**\n\n(quick tunnels change on restart – refresh if needed)"
fi

# Replace with your webhook URL
WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"

curl -H "Content-Type: application/json" \
     -d "{\"content\": \"$MESSAGE\"}" \
     "$WEBHOOK_URL"
