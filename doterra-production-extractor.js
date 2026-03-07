#!/usr/bin/env node

/**
 * doTERRA PRODUCTION INTELLIGENCE EXTRACTOR
 * FINAL VERSION - Direct URL navigation + table extraction
 * Generates: "WHO TO CALL & WHY" recommendations
 * 
 * Reports included:
 * 1. Inactive (6+ months)
 * 2. Qry33 (No orders 3 months)
 * 3. NoOrd4Months (No orders 4 months)
 * 4. Qry4 (Top Volume Growth)
 * 5. New Members
 * 6. EliteStriking (Elite Striking Distance)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  baseUrl: 'https://office.doterra.com',
  dataDir: '/Users/mac/.openclaw/workspace/doterra-data',
  telegramBot: '8776578682:AAEhGdT4IZWHaNukYEdqAroBoZjOy3Fr3h8',
  telegramChat: '8664660476',
  
  // EXACT URLs from user
  reports: [
    {
      name: '6+ Months Inactive',
      priority: 'CRITICAL',
      action: 'CALL TODAY',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.QueryReport&QryID=Inactive&tabsel=MainMenu&QueryType=Custom&FILTERS=%28wrk57%3D6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2B%7Cwrk57%3E%3D13%26level%3C%3D7%29&Ajaxwrapped=1'
    },
    {
      name: 'No orders in 3 months',
      priority: 'URGENT',
      action: 'CALL THIS WEEK',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.QueryReport&QryID=Qry33&QueryType=Custom'
    },
    {
      name: 'No orders in 4 months',
      priority: 'CRITICAL',
      action: 'CALL IMMEDIATELY',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.QueryReport&QryID=NoOrd4Months&QueryType=Custom'
    },
    {
      name: 'Top Volume % Growth',
      priority: 'MEDIUM',
      action: 'CELEBRATE & MENTOR',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.QueryReport&QryID=Qry4&tabsel=MainMenu&QueryType=TopQueries'
    },
    {
      name: 'New Members',
      priority: 'MEDIUM',
      action: 'ONBOARD & SUPPORT',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.Snapshot&details=Sponsor&tabsel=MainMenu&Full=1&type=new_members'
    },
    {
      name: 'Elite Striking Distance',
      priority: 'HIGH',
      action: 'ANALYZE & MENTOR',
      url: 'https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.QueryReport&QryID=EliteStriking&QueryType=StrikingDistance&SORTFIELD=amt5&SORTTYPE=A&SORTDIRECTION=D'
    }
  ]
};

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  fs.appendFileSync(path.join(CONFIG.dataDir, 'production-extractor.log'), `[${timestamp}] ${msg}\n`);
}

function sendTelegram(message) {
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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response.ok === true);
        } catch (e) {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function extractReportTable(reportUrl) {
  try {
    log(`  🌐 Navigating to report...`);
    execSync(`openclaw browser navigate "${reportUrl}" --browser-profile openclaw 2>/dev/null || true`, { stdio: 'pipe' });
    
    await sleep(3000);

    log(`  📸 Taking snapshot...`);
    const snapshot = execSync('openclaw browser snapshot --interactive --json --browser-profile openclaw 2>/dev/null || echo "{}"', 
      { encoding: 'utf8' });

    let data = {};
    try {
      data = JSON.parse(snapshot);
    } catch (e) {
      log(`  ⚠️  Snapshot parse failed`);
      return [];
    }

    // Extract table data
    const members = [];
    if (data.tree) {
      const treeStr = JSON.stringify(data.tree);
      
      // Look for table rows with member patterns
      const lines = treeStr.split('|');
      
      lines.forEach((line, idx) => {
        // Pattern: Name, ID number, metrics
        if (line.match(/[A-Z][a-z]+,\s*[A-Z]/) && line.match(/\d+/)) {
          const cleaned = line.trim().substring(0, 150);
          if (cleaned.length > 10) {
            members.push(cleaned);
          }
        }
      });
    }

    // Fallback: extract all text nodes that look like member data
    if (members.length === 0 && data.tree) {
      const fullText = JSON.stringify(data.tree);
      const nameMatches = fullText.match(/[A-Z][a-z]+,\s*[A-Z][a-z]+/g) || [];
      members.push(...nameMatches.slice(0, 20));
    }

    log(`  ✅ Found ${members.length} members`);
    return members;
  } catch (e) {
    log(`  ❌ Error: ${e.message.substring(0, 50)}`);
    return [];
  }
}

async function main() {
  try {
    log('════════════════════════════════════════════');
    log('🎯 doTERRA PRODUCTION INTELLIGENCE EXTRACTOR');
    log('Extract Reports → Generate WHO TO CALL');
    log('════════════════════════════════════════════');

    const allRecommendations = [];

    // Extract each report
    for (const report of CONFIG.reports) {
      log(`\n📄 ${report.name}`);
      log(`   Priority: ${report.priority}`);
      log(`   Action: ${report.action}`);
      
      const members = await extractReportTable(report.url);

      allRecommendations.push({
        name: report.name,
        priority: report.priority,
        action: report.action,
        members: members,
        count: members.length
      });
    }

    // Generate final recommendations
    log('\n\n🎯 GENERATING FINAL RECOMMENDATIONS...\n');

    let recommendationText = '';
    let totalPeople = 0;

    allRecommendations.forEach((rec, idx) => {
      recommendationText += `\n<b>${idx+1}. [${rec.priority}] ${rec.action}</b>\n`;
      recommendationText += `   📋 ${rec.name}\n`;
      recommendationText += `   👥 ${rec.count} people\n`;
      
      if (rec.members.length > 0) {
        const names = rec.members.slice(0, 5).map(m => m.split(',')[0]).join(', ');
        recommendationText += `   📝 Top contacts: ${names}${rec.members.length > 5 ? '...' : ''}\n`;
      }
      
      totalPeople += rec.count;
    });

    // Create Telegram message
    const finalMessage = `
<b>🎯 doTERRA WHO TO CALL INTELLIGENCE REPORT</b>
<i>${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</i>

<b>EXECUTIVE SUMMARY:</b>
Total people to contact: <b>${totalPeople}</b>
Reports analyzed: <b>${CONFIG.reports.length}</b>
Priority distribution: CRITICAL, URGENT, HIGH, MEDIUM

<b>ACTIONABLE RECOMMENDATIONS:</b>
${recommendationText}

<b>IMPLEMENTATION PLAN:</b>
1️⃣ <b>TODAY:</b> Call all CRITICAL/URGENT people (likely ${allRecommendations.filter(r => r.priority === 'CRITICAL' || r.priority === 'URGENT').reduce((sum, r) => sum + r.count, 0)} people)
2️⃣ <b>THIS WEEK:</b> Follow up HIGH priority contacts
3️⃣ <b>NEXT WEEK:</b> Support new members & celebrate top performers
4️⃣ <b>ONGOING:</b> Mentor elite striking distance members

<b>Expected Impact:</b>
✅ Retain inactive members
✅ Prevent churn
✅ Scale top performers
✅ Onboard new talent
✅ Build leadership pipeline

Generated by: doTERRA Production Intelligence Extractor
`;

    // Save intelligence
    const reportFile = path.join(CONFIG.dataDir, `production-intelligence-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(allRecommendations, null, 2));
    log(`💾 Intelligence saved: ${reportFile}`);

    // Send Telegram
    log(`📨 Sending intelligence to Telegram...`);
    const sent = await sendTelegram(finalMessage);
    
    if (sent) {
      log('✅ WHO TO CALL intelligence sent successfully');
    } else {
      log('⚠️  Telegram delivery had issues (non-critical)');
    }

    log('\n✅ PRODUCTION EXTRACTION COMPLETE');
    log('════════════════════════════════════════════\n');

  } catch (error) {
    log(`❌ FATAL: ${error.message}`);
    process.exit(1);
  }
}

main();
