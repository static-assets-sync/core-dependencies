#!/usr/bin/env node

/**
 * doTERRA FULL AUTOMATION AGENT
 * Logs in daily @ 6 AM, pulls ALL reports, analyzes ROI, sends Telegram summary
 * Prioritizes by financial impact + organizational impact
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ==================== CONFIG ====================
const CONFIG = {
  doterra: {
    id: '1390',
    password: 'Reddoterra7*',
    url: 'https://login.doterra.com',
    dashboardUrl: 'https://login.doterra.com/dashboard'
  },
  dataDir: path.join(__dirname, 'doterra-data'),
  telegramBot: process.env.TELEGRAM_BOT_TOKEN || null,
  telegramChat: process.env.TELEGRAM_CHAT_ID || null,
  headless: true,
  timeout: 30000
};

if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

// ==================== LOGGING ====================
function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}`;
  console.log(logMsg);
  fs.appendFileSync(path.join(CONFIG.dataDir, 'automation.log'), logMsg + '\n');
}

// ==================== TELEGRAM ====================
async function sendTelegram(message) {
  if (!CONFIG.telegramBot || !CONFIG.telegramChat) {
    log('⚠️  Telegram not configured');
    return false;
  }

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

// ==================== BROWSER OPERATIONS ====================
async function initBrowser() {
  return await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
}

async function login(page) {
  log('🔐 Logging into doTERRA...');
  
  try {
    await page.goto(CONFIG.doterra.url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].type(CONFIG.doterra.id, { delay: 30 });
      await sleep(300);
      await inputs[1].type(CONFIG.doterra.password, { delay: 30 });
      await sleep(300);

      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[0].click();
        await sleep(4000);
        log('✅ Login successful');
        return true;
      }
    }
    return false;
  } catch (e) {
    log(`❌ Login failed: ${e.message}`);
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== DATA EXTRACTION ====================
async function extractDashboard(page) {
  log('📊 Extracting dashboard data...');
  
  try {
    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      
      // Extract OV (Organizational Volume)
      const ovMatch = text.match(/OV[\s:]*(\d+[\d,]*\.?\d*)/i) || 
                     text.match(/(\d+[\d,]*\.?\d*)\s*OV/i);
      const ov = ovMatch ? parseFloat(ovMatch[1].replace(/,/g, '')) : 0;
      
      // Extract PV (Personal Volume)
      const pvMatch = text.match(/PV[\s:]*(\d+[\d,]*\.?\d*)/i) || 
                     text.match(/(\d+[\d,]*\.?\d*)\s*PV/i);
      const pv = pvMatch ? parseFloat(pvMatch[1].replace(/,/g, '')) : 0;
      
      // Extract rank
      const rankMatch = text.match(/(?:Rank|Consultant|Leader|Physician)[:\s]*/i);
      const rank = rankMatch ? text.substring(rankMatch.index, rankMatch.index + 50) : 'Unknown';
      
      return {
        organizationalVolume: ov,
        personalVolume: pv,
        rank: rank.trim(),
        fullText: text
      };
    });

    return data;
  } catch (e) {
    log(`⚠️  Dashboard extraction error: ${e.message}`);
    return { organizationalVolume: 0, personalVolume: 0, rank: 'Unknown' };
  }
}

async function extractMembers(page) {
  log('👥 Extracting member breakdown...');
  
  try {
    const members = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const memberList = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 2) {
          const name = cells[0]?.innerText?.trim();
          const lrp = cells[1]?.innerText?.trim();
          const pom = cells[2]?.innerText?.trim();
          const pv = cells[3]?.innerText?.trim();
          const ov = cells[4]?.innerText?.trim();
          
          if (name && name.length > 2 && !name.includes('Name')) {
            memberList.push({
              name,
              lrp: lrp || '0.00',
              pom: pom || '0.00',
              personalVolume: parseFloat(pv) || 0,
              organizationalVolume: parseFloat(ov) || 0
            });
          }
        }
      });
      
      return memberList;
    });

    log(`✅ Extracted ${members.length} members`);
    return members;
  } catch (e) {
    log(`⚠️  Member extraction error: ${e.message}`);
    return [];
  }
}

async function extractTopEnrollers(page) {
  log('🌟 Extracting top enrollers...');
  
  try {
    const enrollers = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const enrollList = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 3) {
          const id = cells[0]?.innerText?.trim();
          const name = cells[1]?.innerText?.trim();
          const enrolled = cells[2]?.innerText?.trim();
          
          if (name && !name.includes('Name') && enrolled) {
            enrollList.push({
              id: id || 'N/A',
              name,
              enrolledCount: parseInt(enrolled) || 0
            });
          }
        }
      });
      
      return enrollList.sort((a, b) => b.enrolledCount - a.enrolledCount);
    });

    return enrollers;
  } catch (e) {
    log(`⚠️  Enroller extraction error: ${e.message}`);
    return [];
  }
}

// ==================== DATA ANALYSIS ====================
function analyzeData(dashboard, members, enrollers, history) {
  log('📈 Analyzing data and calculating impact...');
  
  const analysis = {
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    dashboard,
    memberCount: members.length,
    inactiveMembers: [],
    churnRiskMembers: [],
    topPerformers: [],
    newEnrollers: [],
    recommendations: [],
    financialImpact: {}
  };

  // Segment members
  members.forEach(member => {
    const pv = parseFloat(member.personalVolume) || 0;
    const ov = parseFloat(member.organizationalVolume) || 0;
    
    // Inactive: Zero volume
    if (pv === 0 && ov === 0) {
      analysis.inactiveMembers.push({
        ...member,
        estimatedRecoveryValue: 150, // Average re-engagement value
        priority: 'MEDIUM'
      });
    }
    
    // Churn risk: Had volume last month, none this month
    if (history.length > 0) {
      const lastMonth = history[history.length - 1];
      const wasActive = lastMonth.members?.some(m => m.name === member.name && m.personalVolume > 0);
      if (wasActive && pv === 0) {
        analysis.churnRiskMembers.push({
          ...member,
          estimatedRecoveryValue: 300,
          priority: 'URGENT'
        });
      }
    }
    
    // Top performers: High OV
    if (ov > 1000) {
      analysis.topPerformers.push({
        ...member,
        protectionValue: 500, // Cost of losing them
        priority: 'CRITICAL'
      });
    }
  });

  // New enrollers
  enrollers.forEach(enroller => {
    if (enroller.enrolledCount >= 1) {
      analysis.newEnrollers.push({
        ...enroller,
        estimatedTeamValue: enroller.enrolledCount * 200,
        priority: 'HIGH'
      });
    }
  });

  // Calculate financial impact scores
  analysis.financialImpact = {
    inactiveRecovery: analysis.inactiveMembers.reduce((sum, m) => sum + m.estimatedRecoveryValue, 0),
    churnPrevention: analysis.churnRiskMembers.reduce((sum, m) => sum + m.estimatedRecoveryValue, 0),
    topPerformerProtection: analysis.topPerformers.reduce((sum, m) => sum + m.protectionValue, 0),
    newEnrollerSupport: analysis.newEnrollers.reduce((sum, m) => sum + m.estimatedTeamValue, 0)
  };

  analysis.financialImpact.total = 
    analysis.financialImpact.inactiveRecovery +
    analysis.financialImpact.churnPrevention +
    analysis.financialImpact.topPerformerProtection +
    analysis.financialImpact.newEnrollerSupport;

  // Generate prioritized recommendations
  analysis.recommendations = generateRecommendations(analysis);

  return analysis;
}

function generateRecommendations(analysis) {
  const recommendations = [];
  let order = 1;

  // CRITICAL: Top performers (protect them)
  analysis.topPerformers.forEach(member => {
    recommendations.push({
      order: order++,
      priority: 'CRITICAL',
      action: 'PERSONAL_CALL',
      member: member.name,
      reason: `Top performer (OV: ${member.organizationalVolume})`,
      estimatedValue: member.protectionValue,
      message: `Hi ${member.name}, I wanted to personally check in. Your leadership in the organization is invaluable.`
    });
  });

  // URGENT: Churn risk (re-engagement)
  analysis.churnRiskMembers.sort((a, b) => b.organizationalVolume - a.organizationalVolume);
  analysis.churnRiskMembers.forEach(member => {
    recommendations.push({
      order: order++,
      priority: 'URGENT',
      action: 'EMAIL_THEN_CALL',
      member: member.name,
      reason: `Was active, now inactive (previous OV: ${member.organizationalVolume})`,
      estimatedValue: member.estimatedRecoveryValue,
      message: `Hi ${member.name}, we noticed you've been less active. Your team is counting on you. Let's talk about what support you need.`
    });
  });

  // HIGH: New enrollers (nurture growth)
  analysis.newEnrollers.sort((a, b) => b.enrolledCount - a.enrolledCount);
  analysis.newEnrollers.slice(0, 5).forEach(enroller => {
    recommendations.push({
      order: order++,
      priority: 'HIGH',
      action: 'MENTOR_CALL',
      member: enroller.name,
      reason: `New enroller (${enroller.enrolledCount} recruited) - nurture potential`,
      estimatedValue: enroller.estimatedTeamValue,
      message: `Hi ${enroller.name}, amazing work recruiting! Let's strategize to help your team succeed.`
    });
  });

  // MEDIUM: Inactive (re-engagement)
  analysis.inactiveMembers.slice(0, 10).forEach(member => {
    recommendations.push({
      order: order++,
      priority: 'MEDIUM',
      action: 'EMAIL',
      member: member.name,
      reason: `Inactive member`,
      estimatedValue: member.estimatedRecoveryValue,
      message: `Hi ${member.name}, we want to help you succeed. Can we discuss your goals?`
    });
  });

  return recommendations;
}

// ==================== MAIN EXECUTION ====================
async function main() {
  let browser;
  
  try {
    log('════════════════════════════════════════════');
    log('🤖 doTERRA FULL AUTOMATION AGENT');
    log(`📅 ${new Date().toLocaleString()}`);
    log('════════════════════════════════════════════');

    browser = await initBrowser();
    const page = await browser.newPage();
    
    // Login
    const loggedIn = await login(page);
    if (!loggedIn) {
      throw new Error('Login failed');
    }

    // Extract all data
    const dashboard = await extractDashboard(page);
    const members = await extractMembers(page);
    const enrollers = await extractTopEnrollers(page);

    // Load history
    let history = [];
    const historyFile = path.join(CONFIG.dataDir, 'history-full.json');
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }

    // Analyze
    const analysis = analyzeData(dashboard, members, enrollers, history);

    // Save data
    const reportFile = path.join(CONFIG.dataDir, `report-${analysis.date}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(analysis, null, 2));
    log(`💾 Report saved: ${reportFile}`);

    // Update history
    history.push({
      date: analysis.date,
      ov: dashboard.organizationalVolume,
      pv: dashboard.personalVolume,
      memberCount: members.length,
      inactiveCount: analysis.inactiveMembers.length,
      financialImpact: analysis.financialImpact
    });

    if (history.length > 90) {
      history = history.slice(-90);
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

    // Format Telegram message
    const telegramMsg = formatTelegramMessage(analysis);
    
    // Send Telegram
    log('📨 Sending Telegram summary...');
    const sent = await sendTelegram(telegramMsg);
    if (sent) {
      log('✅ Telegram sent');
    }

    // Save pending approvals
    fs.writeFileSync(
      path.join(CONFIG.dataDir, 'pending-actions.json'),
      JSON.stringify(analysis.recommendations, null, 2)
    );

    log('✅ AUTOMATION COMPLETE');
    log('════════════════════════════════════════════');

  } catch (error) {
    log(`❌ FATAL ERROR: ${error.message}`);
    await sendTelegram(`❌ doTERRA automation failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
      log('🛑 Browser closed');
    }
  }
}

// ==================== TELEGRAM FORMATTING ====================
function formatTelegramMessage(analysis) {
  const rec = analysis.recommendations;
  
  return `
<b>📊 doTERRA DAILY AUTOMATION REPORT</b>
<i>${new Date().toLocaleDateString()}</i>

<b>📈 FINANCIALS:</b>
💰 Current OV: $${analysis.dashboard.organizationalVolume.toLocaleString()}
💵 Current PV: $${analysis.dashboard.personalVolume.toLocaleString()}
👥 Team Size: ${analysis.memberCount} members

<b>💵 IMPACT ANALYSIS (Total: $${analysis.financialImpact.total.toLocaleString()}):</b>
🔴 Churn Prevention: $${analysis.financialImpact.churnPrevention.toLocaleString()}
🟡 Inactive Recovery: $${analysis.financialImpact.inactiveRecovery.toLocaleString()}
🟢 New Enroller Support: $${analysis.financialImpact.newEnrollerSupport.toLocaleString()}
🔵 Top Performer Protect: $${analysis.financialImpact.topPerformerProtection.toLocaleString()}

<b>🎯 PRIORITY ACTIONS (Top 10):</b>
${rec.slice(0, 10).map((r, i) => `
${i+1}. <b>${r.member}</b>
   Priority: ${r.priority} | Value: $${r.estimatedValue}
   Action: ${r.action}
   Reason: ${r.reason}
`).join('')}

<b>NEXT:</b>
Reply with numbers to approve (e.g. "1 2 3 4") to execute emails/calls
  `;
}

// ==================== RUN ====================
main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
