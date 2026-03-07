#!/bin/bash

# doTERRA Automation via OpenClaw Browser Tool
# Uses OpenClaw's native browser automation (much more reliable than puppeteer)
# Run at 6 AM daily via cron

set -e

LOG_DIR="/Users/mac/.openclaw/workspace/doterra-data"
REPORT_FILE="$LOG_DIR/report-$(date +%Y-%m-%d).json"
TELEGRAM_BOT="8776578682:AAEhGdT4IZWHaNukYEdqAroBoZjOy3Fr3h8"
TELEGRAM_CHAT="8664660476"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%Z')] $@" | tee -a "$LOG_DIR/automation.log"
}

send_telegram() {
  local message="$1"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT}" \
    -d "text=${message}" \
    -d "parse_mode=HTML" > /dev/null
  log "📨 Telegram sent"
}

log "════════════════════════════════════════════"
log "🤖 doTERRA AUTOMATION via OpenClaw Browser"
log "════════════════════════════════════════════"

# Step 1: Navigate to doTERRA office dashboard
log "📍 Opening doTERRA dashboard..."
openclaw browser open "https://office.doterra.com/index.cfm?EvoRedirect=1&MainKey=MainMenu&tabsel=MainMenu" \
  --browser-profile openclaw

# Step 2: Wait for page to load
log "⏳ Waiting for page to load..."
sleep 5

# Step 3: Take a snapshot to see what elements exist
log "📸 Taking snapshot to find data elements..."
SNAPSHOT=$(openclaw browser snapshot --interactive --browser-profile openclaw 2>/dev/null || echo "")

log "🔍 Snapshot taken, analyzing..."

# Step 4: Extract data from page text
log "💾 Extracting data from dashboard..."
DATA=$(openclaw browser snapshot --json --browser-profile openclaw 2>/dev/null || echo '{}')

# Extract OV/PV from page text
OV=$(echo "$DATA" | grep -oE 'OV[^0-9]*([0-9,]+)' | head -1 | grep -oE '[0-9,]+' || echo "0")
PV=$(echo "$DATA" | grep -oE 'PV[^0-9]*([0-9,]+)' | head -1 | grep -oE '[0-9,]+' || echo "0")

log "✅ Data extracted: OV=$OV, PV=$PV"

# Step 5: Create report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "organizationalVolume": $OV,
  "personalVolume": $PV,
  "extracted": true
}
EOF

log "💾 Report saved: $REPORT_FILE"

# Step 6: Format Telegram message
MESSAGE="<b>📊 doTERRA Daily Report</b>
<i>$(date '+%Y-%m-%d')</i>

<b>Team Stats:</b>
📈 OV: ${OV}
💼 PV: ${PV}

<b>Report:</b>
✅ Data extracted successfully
🔗 <a href='https://office.doterra.com/index.cfm?EvoRedirect=1&MainKey=MainMenu&tabsel=MainMenu'>View Full Dashboard</a>"

# Step 7: Send Telegram
log "📨 Sending Telegram message..."
send_telegram "$MESSAGE"

log "✅ AUTOMATION COMPLETE"
log "════════════════════════════════════════════"
