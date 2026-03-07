#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CREDENTIALS = {
  id: '1390',
  password: 'Reddoterra7*'
};

const DATA_DIR = path.join(__dirname, 'doterra-data');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');
const INTELLIGENCE_FILE = path.join(DATA_DIR, 'intelligence.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function loginAndGetSession(browser) {
  console.log('[doTERRA] Opening login page...');
  const page = await browser.newPage();
  
  await page.goto('https://login.doterra.com', { waitUntil: 'networkidle2' });
  
  // Try multiple selector strategies
  console.log('[doTERRA] Attempting login...');
  try {
    // Wait for any input
    await page.waitForSelector('input', { timeout: 5000 });
    const inputs = await page.$$('input');
    
    if (inputs.length >= 2) {
      // Fill ID
      await inputs[0].type(CREDENTIALS.id, { delay: 50 });
      await page.waitForTimeout(300);
      
      // Fill password
      await inputs[1].type(CREDENTIALS.password, { delay: 50 });
      await page.waitForTimeout(300);
      
      // Submit
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[0].click();
        await page.waitForTimeout(3000);
      }
    }
  } catch (error) {
    console.log('[doTERRA] Login form navigation: ' + error.message);
  }
  
  // Wait for dashboard to load
  await page.waitForTimeout(3000);
  
  // Extract all cookies
  const cookies = await page.cookies();
  console.log('[doTERRA] Captured ' + cookies.length + ' cookies');
  
  // Save session for future use
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  
  return { page, cookies };
}

async function scrapeIntelligence(page) {
  console.log('[doTERRA] Scraping intelligence data...');
  
  const data = {
    timestamp: new Date().toISOString(),
    metrics: {},
    analysis: {},
    alerts: [],
    recommendations: []
  };
  
  try {
    // Get page content
    const pageText = await page.evaluate(() => document.body.innerText);
    const pageHtml = await page.evaluate(() => document.body.innerHTML);
    
    // Extract metrics
    const revenueMatch = pageText.match(/\$[\d,]+(?:\.\d{2})?/);
    if (revenueMatch) {
      data.metrics.revenue = parseFloat(revenueMatch[0].replace(/[$,]/g, ''));
    }
    
    const userMatch = pageText.match(/(\d+)\s*(?:active|members?|users?)/i);
    if (userMatch) {
      data.metrics.activeUsers = parseInt(userMatch[1]);
    }
    
    // Load historical data
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    
    // Analyze trends
    if (history.length > 0) {
      const yesterday = history[history.length - 1];
      
      // Revenue trend
      if (yesterday.metrics.revenue && data.metrics.revenue) {
        const revenueDelta = data.metrics.revenue - yesterday.metrics.revenue;
        const revenuePercent = (revenueDelta / yesterday.metrics.revenue * 100).toFixed(1);
        
        data.analysis.revenueTrend = {
          delta: revenueDelta.toFixed(2),
          percent: revenuePercent,
          direction: revenueDelta > 0 ? 'UP' : 'DOWN'
        };
        
        if (revenueDelta < 0) {
          data.alerts.push('⚠️ REVENUE DOWN ' + Math.abs(revenuePercent) + '% vs yesterday');
        }
      }
      
      // User trend
      if (yesterday.metrics.activeUsers && data.metrics.activeUsers) {
        const userDelta = data.metrics.activeUsers - yesterday.metrics.activeUsers;
        const userPercent = (userDelta / yesterday.metrics.activeUsers * 100).toFixed(1);
        
        data.analysis.userTrend = {
          delta: userDelta,
          percent: userPercent,
          direction: userDelta > 0 ? 'UP' : 'DOWN'
        };
        
        if (userDelta < 0) {
          data.alerts.push('⚠️ ACTIVE USERS DOWN ' + Math.abs(userDelta) + ' (churn signal)');
        }
      }
    }
    
    // Generate recommendations
    if (data.metrics.revenue < 5000) {
      data.recommendations.push('🎯 Revenue < $5k: Focus on re-engagement campaigns');
    }
    
    if (data.metrics.activeUsers < 50) {
      data.recommendations.push('🎯 Low user count: Identify inactive members for outreach');
    }
    
    data.recommendations.push('✅ Run automated re-engagement email to 60+ day inactive members');
    data.recommendations.push('✅ Review top 10% revenue generators for success patterns');
    
    // Add to history
    history.push(data);
    if (history.length > 90) {
      history = history.slice(-90); // Keep last 90 days
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    
    data.status = 'success';
  } catch (error) {
    console.error('[doTERRA] Error during scrape:', error.message);
    data.status = 'error';
    data.error = error.message;
  }
  
  return data;
}

async function runHeadlessBot() {
  let browser;
  
  try {
    console.log('[doTERRA] Launching headless browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    // Check if we have existing session
    let page;
    if (fs.existsSync(SESSION_FILE)) {
      console.log('[doTERRA] Restoring existing session...');
      const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      page = await browser.newPage();
      await page.setCookie(...cookies);
      await page.goto('https://login.doterra.com/dashboard', { waitUntil: 'networkidle2', timeout: 10000 });
    } else {
      console.log('[doTERRA] Creating new session...');
      const result = await loginAndGetSession(browser);
      page = result.page;
    }
    
    // Scrape intelligence
    const intelligence = await scrapeIntelligence(page);
    
    // Save intelligence report
    fs.writeFileSync(INTELLIGENCE_FILE, JSON.stringify(intelligence, null, 2));
    
    console.log('\n═══════════════════════════════════════');
    console.log('📊 DOTERRA DAILY INTELLIGENCE REPORT');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('📈 METRICS:');
    console.log('   Revenue: $' + (intelligence.metrics.revenue || 0).toFixed(2));
    console.log('   Active Users: ' + (intelligence.metrics.activeUsers || 0));
    console.log('');
    
    if (Object.keys(intelligence.analysis).length > 0) {
      console.log('📊 ANALYSIS:');
      if (intelligence.analysis.revenueTrend) {
        console.log('   Revenue: ' + intelligence.analysis.revenueTrend.direction + ' ' + intelligence.analysis.revenueTrend.percent + '%');
      }
      if (intelligence.analysis.userTrend) {
        console.log('   Users: ' + intelligence.analysis.userTrend.direction + ' ' + intelligence.analysis.userTrend.delta);
      }
      console.log('');
    }
    
    if (intelligence.alerts.length > 0) {
      console.log('🚨 ALERTS:');
      intelligence.alerts.forEach(alert => console.log('   ' + alert));
      console.log('');
    }
    
    if (intelligence.recommendations.length > 0) {
      console.log('🎯 RECOMMENDATIONS:');
      intelligence.recommendations.forEach(rec => console.log('   ' + rec));
      console.log('');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('✅ Intelligence report saved to:');
    console.log('   ' + INTELLIGENCE_FILE);
    console.log('═══════════════════════════════════════\n');
    
    await page.close();
    
  } catch (error) {
    console.error('[doTERRA] Fatal error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the bot
runHeadlessBot().catch(console.error);
