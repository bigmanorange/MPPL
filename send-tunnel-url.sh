#!/bin/bash

# Your Discord webhook URL (replace!)
WEBHOOK_URL="https://discord.com/api/webhooks/1477247087254179872/x4YOjhTgouRlxtC-3cGpOtIZQeLSiCbWjLgNnwCFkyE-DWFS_59PM5Tho0ILaH7hnkWE"

# Get more log lines + force refresh logs
pm2 flush cf-tunnel >/dev/null 2>&1  # optional: clear old junk if needed

# Search deeper in logs (last 500 lines, ignore colors/timestamps)
TUNNEL_URL=$(pm2 logs cf-tunnel --lines 500 --no-colors 2>/dev/null | \
  grep -o 'https://[-a-z0-9]\{1,\}\.trycloudflare\.com' | tail -n 1)

if [ -z "$TUNNEL_URL" ]; then
  MESSAGE="⚠️ No tunnel URL detected in the last 500 lines of cf-tunnel logs.\n\n**Fix steps:**\n1. pm2 restart cf-tunnel\n2. Wait 10–30 seconds\n3. Run this script again (or !tunnel if using bot)\n\nCheck manually: pm2 logs cf-tunnel | grep 'Your quick Tunnel'"
else
  MESSAGE="🌐 **Current public tunnel URL:**\n$TUNNEL_URL\n\n(Quick tunnels change every restart. If it doesn't load, wait 30–60s or flush DNS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder)"
fi

# Send to Discord
curl -H "Content-Type: application/json" \
     -d "{\"content\": \"$MESSAGE\"}" \
     "$WEBHOOK_URL"
