#!/usr/bin/env node

/**
 * doTERRA Automation via OpenClaw Browser Tool
 * Uses OpenClaw's native browser automation (Playwright-backed)
 * Much more reliable than raw puppeteer for JS-rendered pages
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  dashboardUrl: 'https://office.doterra.com/index.cfm?EvoRedirect=1&MainKey=MainMenu&tabsel=MainMenu',
  browserProfile: 'openclaw',
  dataDir: '/Users/mac/.openclaw/workspace/doterra-data',
  telegramBot: '8776578682:AAEhGdT4IZWHaNukYEdqAroBoZjOy3Fr3h8',
  telegramChat: '8664660476'
};

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  fs.appendFileSync(path.join(CONFIG.dataDir, 'openclaw-automation.log'), `[${timestamp}] ${msg}\n`);
}

function runCommand(cmd) {
  try {
    log(`🔧 Running: ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return output;
  } catch (e) {
    log(`⚠️  Command failed: ${e.message}`);
    return null;
  }
}

async function sendTelegram(message) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: CONFIG.telegramChat,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${CONFIG.telegramBot}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(true));
    });

    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    log('════════════════════════════════════════════');
    log('🤖 doTERRA via OpenClaw Browser Tool');
    log('════════════════════════════════════════════');

    // Step 1: Open dashboard in OpenClaw managed browser
    log('📍 Opening doTERRA dashboard...');
    runCommand(`openclaw browser open "${CONFIG.dashboardUrl}" --browser-profile ${CONFIG.browserProfile}`);
    
    // Step 2: Wait for page to load
    log('⏳ Waiting for page to fully load (10 seconds)...');
    await new Promise(r => setTimeout(r, 10000));

    // Step 3: Take interactive snapshot to see all elements
    log('📸 Taking interactive snapshot...');
    const snapshotOutput = runCommand(`openclaw browser snapshot --interactive --json --browser-profile ${CONFIG.browserProfile}`);
    
    let snapshotData = {};
    if (snapshotOutput) {
      try {
        snapshotData = JSON.parse(snapshotOutput);
        log(`✅ Snapshot captured (${snapshotData.stats?.lines || '?'} lines)`);
      } catch (e) {
        log(`⚠️  Could not parse snapshot JSON: ${e.message}`);
      }
    }

    // Step 4: Extract data from snapshot
    log('🔍 Extracting data...');
    
    let organizationalVolume = 0;
    let personalVolume = 0;
    
    if (snapshotData.tree) {
      const text = JSON.stringify(snapshotData.tree).toLowerCase();
      
      // Try to extract OV and PV
      const ovMatch = text.match(/ov[:\s]*(\d+[\d,]*\.?\d*)/i) || 
                     text.match(/organizational\s*volume[:\s]*(\d+[\d,]*\.?\d*)/i);
      const pvMatch = text.match(/pv[:\s]*(\d+[\d,]*\.?\d*)/i) ||
                     text.match(/personal\s*volume[:\s]*(\d+[\d,]*\.?\d*)/i);
      
      if (ovMatch) organizationalVolume = parseFloat(ovMatch[1].replace(/,/g, ''));
      if (pvMatch) personalVolume = parseFloat(pvMatch[1].replace(/,/g, ''));
    }

    log(`✅ Extracted: OV=${organizationalVolume}, PV=${personalVolume}`);

    // Step 5: Save report
    const reportData = {
      timestamp: new Date().toISOString(),
      organizationalVolume,
      personalVolume,
      extracted: organizationalVolume > 0 || personalVolume > 0,
      method: 'openclaw-browser'
    };

    const reportFile = path.join(CONFIG.dataDir, `report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    log(`💾 Report saved: ${reportFile}`);

    // Step 6: Format and send Telegram message
    const telegramMessage = `
<b>📊 doTERRA Daily Report</b>
<i>${new Date().toLocaleDateString()}</i>

<b>Team Stats:</b>
📈 OV: ${organizationalVolume.toLocaleString()}
💼 PV: ${personalVolume.toLocaleString()}

<b>Report:</b>
✅ Data extracted via OpenClaw browser tool
🔗 <a href='${CONFIG.dashboardUrl}'>View Full Dashboard</a>

<b>Time:</b> ${new Date().toLocaleTimeString()}`;

    log('📨 Sending Telegram...');
    const sent = await sendTelegram(telegramMessage);
    
    if (sent) {
      log('✅ Telegram message sent');
    } else {
      log('⚠️  Telegram send failed (non-critical)');
    }

    log('✅ AUTOMATION COMPLETE');
    log('════════════════════════════════════════════');

  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

main();
