#!/usr/bin/env node

/**
 * doTERRA Full Automation - FIXED VERSION
 * Connects to Brave debugging port and extracts actual dashboard data
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  doterra: {
    id: '1390',
    password: 'Reddoterra7*',
    loginUrl: 'https://login.doterra.com',
    dashboardUrl: 'https://office.doterra.com/index.cfm?EvoRedirect=1&MainKey=MainMenu&tabsel=MainMenu'
  },
  dataDir: '/Users/mac/.openclaw/workspace/doterra-data',
  telegramBot: '8776578682:AAEhGdT4IZWHaNukYEdqAroBoZjOy3Fr3h8',
  telegramChat: '8664660476'
};

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

async function connectToBrave() {
  try {
    log('🔗 Connecting to Brave debugging port 9222...');
    const browser = await puppeteer.connect({
      browserWSEndpoint: 'ws://127.0.0.1:9222',
      defaultViewport: null
    });
    log('✅ Connected to Brave');
    return browser;
  } catch (e) {
    log(`❌ Could not connect: ${e.message}`);
    log('🚀 Start Brave with: /Applications/Brave\\ Browser.app/Contents/MacOS/Brave\\ Browser --remote-debugging-port=9222');
    throw e;
  }
}

async function login(page) {
  log('🔐 Navigating to login page...');
  
  await page.goto(CONFIG.doterra.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  log('📝 Filling login form...');
  
  // Find and fill email/ID field
  const idInput = await page.$('input[type="text"], input[type="email"]');
  if (idInput) {
    await idInput.type(CONFIG.doterra.id, { delay: 50 });
    log('✅ Entered ID');
  } else {
    log('⚠️  Could not find ID input, assuming already logged in');
    return true;
  }
  
  // Find and fill password field
  await new Promise(r => setTimeout(r, 500));
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    await passwordInput.type(CONFIG.doterra.password, { delay: 50 });
    log('✅ Entered password');
  }
  
  // Click login button
  await new Promise(r => setTimeout(r, 500));
  const buttons = await page.$$('button');
  let clicked = false;
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.innerText);
    if (text.toLowerCase().includes('login') || text.toLowerCase().includes('sign')) {
      await btn.click();
      clicked = true;
      log('✅ Clicked login button');
      break;
    }
  }
  
  if (!clicked && buttons.length > 0) {
    await buttons[0].click();
    log('✅ Clicked first button');
  }
  
  // Wait for redirect
  await new Promise(r => setTimeout(r, 5000));
  log('✅ Login attempt complete');
  return true;
}

async function navigateToDashboard(page) {
  log('📍 Navigating to dashboard...');
  
  try {
    await page.goto(CONFIG.doterra.dashboardUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    log('✅ Dashboard loaded');
    return true;
  } catch (e) {
    log(`⚠️  Navigation error: ${e.message}`);
    return false;
  }
}

async function extractData(page) {
  log('🔍 Extracting dashboard data...');
  
  const data = await page.evaluate(() => {
    const text = document.body.innerText;
    
    // Extract OV/PV
    const ovMatch = text.match(/OV[\s:]*(\d+[\d,]*\.?\d*)/i) || 
                   text.match(/(\d+[\d,]*\.?\d*)\s*OV/i) ||
                   text.match(/Organizational\s*Volume[\s:]*(\d+[\d,]*\.?\d*)/i);
    
    const pvMatch = text.match(/PV[\s:]*(\d+[\d,]*\.?\d*)/i) ||
                   text.match(/(\d+[\d,]*\.?\d*)\s*PV/i) ||
                   text.match(/Personal\s*Volume[\s:]*(\d+[\d,]*\.?\d*)/i);
    
    // Extract members from any visible list
    const members = [];
    const rows = document.querySelectorAll('tr, li, div[class*="member"], div[class*="downline"]');
    
    rows.forEach(row => {
      const text = row.innerText || row.textContent;
      if (text && text.length > 5) {
        const cells = row.querySelectorAll('td, span, div');
        if (cells.length > 0) {
          members.push({
            name: cells[0]?.innerText?.trim() || text.substring(0, 50),
            fullText: text.substring(0, 200)
          });
        }
      }
    });
    
    return {
      organizationalVolume: ovMatch ? parseFloat(ovMatch[1].replace(/,/g, '')) : 0,
      personalVolume: pvMatch ? parseFloat(pvMatch[1].replace(/,/g, '')) : 0,
      memberCount: members.length,
      members: members.slice(0, 20),
      pageText: text.substring(0, 1000)
    };
  });
  
  log(`✅ Extracted: OV=${data.organizationalVolume}, PV=${data.personalVolume}, Members=${data.memberCount}`);
  return data;
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
  let browser;
  
  try {
    log('════════════════════════════════════════════');
    log('🤖 doTERRA AUTOMATION - FIXED VERSION');
    log('════════════════════════════════════════════');
    
    // Connect to Brave
    browser = await connectToBrave();
    
    // Create new page or use existing
    const pages = await browser.pages();
    let page = pages.length > 0 ? pages[pages.length - 1] : await browser.newPage();
    
    // Login
    await login(page);
    
    // Navigate to dashboard
    await navigateToDashboard(page);
    
    // Extract data
    const data = await extractData(page);
    
    // Format message
    const message = `
<b>📊 doTERRA Daily Report</b>
<i>${new Date().toLocaleDateString()}</i>

<b>Stats:</b>
📈 OV: ${data.organizationalVolume}
💼 PV: ${data.personalVolume}
👥 Members: ${data.memberCount}

<b>Data extracted successfully!</b>
    `;
    
    // Send Telegram
    log('📨 Sending Telegram message...');
    const sent = await sendTelegram(message);
    if (sent) {
      log('✅ Telegram sent');
    } else {
      log('⚠️  Telegram send failed');
    }
    
    // Save data
    fs.writeFileSync(
      path.join(CONFIG.dataDir, `report-${new Date().toISOString().split('T')[0]}.json`),
      JSON.stringify(data, null, 2)
    );
    
    log('✅ AUTOMATION COMPLETE');
    log('════════════════════════════════════════════');
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
  } finally {
    if (browser) {
      try {
        // Don't close browser - keep it open for next run
        log('🔄 Keeping Brave open for next run');
      } catch (e) {
        // Ignore
      }
    }
  }
}

main();
