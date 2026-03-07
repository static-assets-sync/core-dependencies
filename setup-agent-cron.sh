#!/bin/bash

# Setup doTERRA agent to run daily at 6 AM

echo "🤖 Setting up doTERRA Autonomous Agent"
echo "======================================"

# Make script executable
chmod +x /Users/mac/.openclaw/workspace/doterra-agent.js

# Create plist for macOS LaunchAgent
cat > ~/Library/LaunchAgents/com.doterra.agent.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.doterra.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/mac/.openclaw/workspace/doterra-agent.js</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/mac/.openclaw/workspace/doterra-data/agent-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/mac/.openclaw/workspace/doterra-data/agent-stderr.log</string>
    
    <key>WorkingDirectory</key>
    <string>/Users/mac/.openclaw/workspace</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>/Users/mac</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>TELEGRAM_BOT_TOKEN</key>
        <string>YOUR_BOT_TOKEN_HERE</string>
        <key>TELEGRAM_CHAT_ID</key>
        <string>YOUR_CHAT_ID_HERE</string>
    </dict>
</dict>
</plist>
EOF

echo "✅ LaunchAgent created"
echo ""
echo "📋 SETUP COMPLETE"
echo "======================================"
echo ""
echo "⚠️  NEXT STEPS:"
echo ""
echo "1. Set your Telegram bot token:"
echo "   sed -i '' 's/YOUR_BOT_TOKEN_HERE/your_actual_token/' ~/Library/LaunchAgents/com.doterra.agent.plist"
echo ""
echo "2. Set your Telegram chat ID:"
echo "   sed -i '' 's/YOUR_CHAT_ID_HERE/your_chat_id/' ~/Library/LaunchAgents/com.doterra.agent.plist"
echo ""
echo "3. Load the agent:"
echo "   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.doterra.agent.plist"
echo ""
echo "4. Verify it's running:"
echo "   launchctl list | grep doterra"
echo ""
echo "5. Check logs:"
echo "   tail -f /Users/mac/.openclaw/workspace/doterra-data/agent.log"
echo ""
