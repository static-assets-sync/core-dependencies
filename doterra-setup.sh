#!/bin/bash

# doTERRA Bot Setup Script

echo "🤖 doTERRA Bot Setup"
echo "==================="
echo ""

# 1. Install puppeteer if not already installed
echo "📦 Installing Puppeteer..."
cd /Users/mac/.openclaw/workspace
npm install puppeteer --save 2>/dev/null || echo "Puppeteer may already be installed"

# 2. Make scraper executable
echo "🔧 Making scraper executable..."
chmod +x doterra-scraper.js

# 3. Install LaunchAgent (macOS scheduler)
echo "⏰ Setting up daily cron job (6 AM)..."
cp doterra-cron.plist ~/Library/LaunchAgents/ai.openclaw.doterra-scraper.plist 2>/dev/null

# Load the job
launchctl load ~/Library/LaunchAgents/ai.openclaw.doterra-scraper.plist 2>/dev/null || \
launchctl unload ~/Library/LaunchAgents/ai.openclaw.doterra-scraper.plist 2>/dev/null && \
launchctl load ~/Library/LaunchAgents/ai.openclaw.doterra-scraper.plist

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 What's Ready:"
echo "  ✓ Scraper (doterra-scraper.js)"
echo "  ✓ Dashboard (doterra-dashboard.html)"
echo "  ✓ Daily cron job (6 AM every day)"
echo ""
echo "🚀 To test the scraper now:"
echo "   node /Users/mac/.openclaw/workspace/doterra-scraper.js"
echo ""
echo "📊 To view the dashboard:"
echo "   open /Users/mac/.openclaw/workspace/doterra-dashboard.html"
echo ""
echo "📅 Schedule:"
echo "   Runs every day at 6 AM automatically"
echo "   Logs: /Users/mac/.openclaw/workspace/doterra-cron.log"
echo ""
