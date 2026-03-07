#!/usr/bin/env node

/**
 * doTERRA Autonomous Agent
 * Logs in, extracts data, sends daily recommendations
 * Runs via cron at 6 AM daily
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CONFIG = {
  doterra: {
    id: '1390',
    password: 'Reddoterra7*',
    url: 'https://login.doterra.com'
  },
  dataDir: path.join(__dirname, 'doterra-data'),
  telegramBot: process.env.TELEGRAM_BOT_TOKEN || null,
  telegramChat: process.env.TELEGRAM_CHAT_ID || null,
  headless: true
};

// Ensure data directory
if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

// ==================== LOGGING ====================
function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  fs.appendFileSync(
    path.join(CONFIG.dataDir, 'agent.log'),
    `[${timestamp}] ${msg}\n`
  );
}

// ==================== TELEGRAM NOTIFICATIONS ====================
async function sendTelegram(message) {
  if (!CONFIG.telegramBot || !CONFIG.telegramChat) {
    log('⚠️ Telegram not configured, skipping notification');
    return;
  }

  return new Promise((resolve, reject) => {
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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ==================== LOGIN & SCRAPE ====================
async function loginAndScrape() {
  let browser;
  try {
    log('🚀 Starting doTERRA agent...');
    
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    log('📄 Opening doTERRA login...');
    
    await page.goto(CONFIG.doterra.url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Try to login
    log('🔐 Attempting login...');
    try {
      const inputs = await page.$$('input');
      if (inputs.length >= 2) {
        await inputs[0].type(CONFIG.doterra.id, { delay: 30 });
        await new Promise(r => setTimeout(r, 300));
        await inputs[1].type(CONFIG.doterra.password, { delay: 30 });
        await new Promise(r => setTimeout(r, 300));

        const buttons = await page.$$('button');
        if (buttons.length > 0) {
          await buttons[0].click();
          log('✅ Login submitted');
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    } catch (e) {
      log(`⚠️ Login error: ${e.message}`);
    }

    // Extract dashboard data
    log('📊 Extracting dashboard metrics...');
    const dashboardData = await page.evaluate(() => {
      const text = document.body.innerText;
      
      // Look for revenue patterns
      const revenueMatch = text.match(/(\d+[\d,]*\.?\d*)/);
      const volumeMatch = text.match(/OV[\s:]*(\d+[\d,]*\.?\d*)/i);
      
      return {
        rawText: text.substring(0, 1000),
        pageTitle: document.title,
        url: window.location.href
      };
    });

    log(`✅ Dashboard extracted: ${dashboardData.pageTitle}`);

    // Navigate to 6+ Months Inactive report
    log('🔄 Navigating to 6+ Months Inactive report...');
    try {
      // Look for links/buttons containing "inactive" or similar
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        const inactive = links.find(el => 
          el.textContent.toLowerCase().includes('inactive') ||
          el.textContent.toLowerCase().includes('6') ||
          el.href?.includes('inactive')
        );
        if (inactive) inactive.click();
      });
      
      await new Promise(r => setTimeout(r, 2000));
      log('✅ Navigated to reports section');
    } catch (e) {
      log(`⚠️ Could not navigate to inactive report: ${e.message}`);
    }

    // Extract member data
    log('👥 Extracting member data...');
    const memberData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const members = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length > 0) {
          members.push({
            name: cells[0]?.innerText || 'Unknown',
            status: cells[1]?.innerText || '',
            volume: cells[2]?.innerText || '0',
            lastActivity: cells[3]?.innerText || 'Unknown'
          });
        }
      });
      
      return members.filter(m => m.name !== 'Unknown' && m.name.trim());
    });

    log(`✅ Extracted ${memberData.length} members`);

    // Load historical data for comparison
    let history = [];
    const historyFile = path.join(CONFIG.dataDir, 'history.json');
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }

    // Analyze data
    log('📈 Analyzing member data...');
    const analysis = analyzeMembers(memberData, history);

    // Save data
    const reportData = {
      timestamp: new Date().toISOString(),
      members: memberData,
      analysis: analysis,
      dashboard: dashboardData
    };

    fs.writeFileSync(
      path.join(CONFIG.dataDir, 'report-' + new Date().toISOString().split('T')[0] + '.json'),
      JSON.stringify(reportData, null, 2)
    );

    history.push({
      date: new Date().toISOString().split('T')[0],
      memberCount: memberData.length,
      analysis: analysis
    });

    if (history.length > 90) {
      history = history.slice(-90);
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

    // Generate recommendations
    const recommendations = generateRecommendations(analysis, memberData);

    log('✅ Agent complete');

    return {
      success: true,
      memberCount: memberData.length,
      inactiveCount: analysis.inactiveMembers.length,
      recommendations: recommendations,
      reportData: reportData
    };

  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
      log('🛑 Browser closed');
    }
  }
}

// ==================== ANALYSIS ====================
function analyzeMembers(members, history) {
  const analysis = {
    totalMembers: members.length,
    inactiveMembers: [],
    activeMembers: [],
    newMembers: [],
    churnRisk: []
  };

  members.forEach(member => {
    const isInactive = member.lastActivity?.includes('6') || 
                      member.status?.toLowerCase().includes('inactive');
    
    if (isInactive) {
      analysis.inactiveMembers.push(member);
    } else {
      analysis.activeMembers.push(member);
    }

    // Check volume for churn signals
    const volume = parseFloat(member.volume) || 0;
    if (volume === 0 && member.name) {
      analysis.churnRisk.push(member);
    }
  });

  return analysis;
}

// ==================== RECOMMENDATIONS ====================
function generateRecommendations(analysis, members) {
  const recommendations = [];

  // High priority: 6+ months inactive with previous volume
  analysis.inactiveMembers.slice(0, 10).forEach((member, idx) => {
    recommendations.push({
      priority: 'URGENT',
      action: 'CALL_OR_EMAIL',
      member: member.name,
      reason: '6+ months inactive',
      estimatedValue: '$100-500',
      message: `Hi ${member.name}, we've missed you! Your team has grown. Let's talk about getting you re-engaged.`,
      order: idx + 1
    });
  });

  // Medium priority: Churn risk (zero volume)
  analysis.churnRisk.slice(0, 5).forEach((member, idx) => {
    recommendations.push({
      priority: 'HIGH',
      action: 'EMAIL',
      member: member.name,
      reason: 'Zero volume - likely inactive',
      estimatedValue: '$50-200',
      message: `Hi ${member.name}, we want to help you succeed. Can we schedule a quick call?`,
      order: analysis.inactiveMembers.length + idx + 1
    });
  });

  return recommendations;
}

// ==================== MAIN ====================
async function main() {
  log('════════════════════════════════════════');
  log('doTERRA AUTONOMOUS AGENT');
  log('════════════════════════════════════════');

  const result = await loginAndScrape();

  if (result.success) {
    // Format Telegram message
    const message = `
<b>📊 doTERRA Daily Report</b>
<i>${new Date().toLocaleDateString()}</i>

<b>Team Stats:</b>
👥 Total Members: ${result.memberCount}
⚠️  Inactive (6+mo): ${result.inactiveCount}

<b>Top Recommendations:</b>
${result.recommendations.slice(0, 5).map((r, i) => 
  `${i+1}. <b>${r.member}</b> - ${r.reason}\n   💬 "${r.message.substring(0, 50)}..."`
).join('\n')}

<b>Next Step:</b>
Approve emails: Reply with numbers (e.g. "1 2 3") to send
    `;

    log('📨 Sending Telegram summary...');
    await sendTelegram(message);

    // Save recommendations for manual approval
    fs.writeFileSync(
      path.join(CONFIG.dataDir, 'pending-approvals.json'),
      JSON.stringify(result.recommendations, null, 2)
    );

    log('✅ Report saved and sent');
  } else {
    log(`❌ Agent failed: ${result.error}`);
    await sendTelegram(`❌ doTERRA agent error: ${result.error}`);
  }

  log('════════════════════════════════════════');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
