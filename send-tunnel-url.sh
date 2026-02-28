#!/bin/bash

WEBHOOK_URL="https://discord.com/api/webhooks/1477247087254179872/x4YOjhTgouRlxtC-3cGpOtIZQeLSiCbWjLgNnwCFkyE-DWFS_59PM5Tho0ILaH7hnkWE"

LOG_FILE="$HOME/server/app/cloudflared.log"

# Get the MOST RECENT URL from the dedicated log file
TUNNEL_URL=$(grep -o 'https://[-a-z0-9]\+\.trycloudflare\.com' "$LOG_FILE" | tail -n 1)

if [ -z "$TUNNEL_URL" ]; then
  MESSAGE="⚠️ No tunnel URL found in $LOG_FILE.\n\nQuick fix:\n1. pm2 restart cf-tunnel\n2. Wait 10–30s\n3. Run script again\n\nManual check: cat $LOG_FILE | grep 'Your quick Tunnel'"
else
  MESSAGE="🌐 **Current public tunnel URL:**\n$TUNNEL_URL\n\n(If it doesn't load, wait 30–60s or run: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder)"
fi

curl -H "Content-Type: application/json" \
     -d "{\"content\": \"$MESSAGE\"}" \
     "$WEBHOOK_URL"
