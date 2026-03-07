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
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function login(browser) {
  console.log('[doTERRA] Opening login page...');
  const page = await browser.newPage();
  
  await page.goto('https://login.doterra.com', { waitUntil: 'networkidle2' });
  
  // Wait for form and fill credentials
  console.log('[doTERRA] Waiting for login form...');
  
  // Try multiple selectors for ID field
  let idInput;
  try {
    await page.waitForSelector('input', { timeout: 10000 });
    const inputs = await page.$$('input');
    
    if (inputs.length >= 2) {
      console.log('[doTERRA] Found input fields, filling credentials...');
      
      // First input is usually ID
      await inputs[0].type(CREDENTIALS.id);
      await page.waitForTimeout(500);
      
      // Second input is usually password
      await inputs[1].type(CREDENTIALS.password);
      await page.waitForTimeout(500);
      
      // Click submit button
      console.log('[doTERRA] Submitting login form...');
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[0].click();
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('[doTERRA] Could not find login form fields');
      throw new Error('Login form fields not found');
    }
  } catch (error) {
    console.log('[doTERRA] Login form error, page may be loaded directly:', error.message);
  }
  
  console.log('[doTERRA] Login successful!');
  
  // Save cookies for session persistence
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  
  return page;
}

async function scrapeMetrics(page) {
  console.log('[doTERRA] Scraping dashboard metrics...');
  
  const metrics = {
    timestamp: new Date().toISOString(),
    activeUsers: 0,
    payingUsers: 0,
    monthlyRevenue: 0,
    teamSize: 0,
    status: 'unknown'
  };
  
  try {
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Try to extract metrics from visible text
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    // Look for common doTERRA metrics patterns
    const revenueMatch = bodyText.match(/\$[\d,]+(?:\.\d{2})?/);
    if (revenueMatch) {
      metrics.monthlyRevenue = parseFloat(revenueMatch[0].replace(/[$,]/g, ''));
    }
    
    // Look for user counts
    const userMatch = bodyText.match(/(\d+)\s*(?:active|total|members?)/i);
    if (userMatch) {
      metrics.activeUsers = parseInt(userMatch[1]);
    }
    
    metrics.status = 'success';
  } catch (error) {
    console.error('[doTERRA] Error scraping metrics:', error.message);
    metrics.status = 'error';
    metrics.error = error.message;
  }
  
  return metrics;
}

async function scrapeTeam(page) {
  console.log('[doTERRA] Scraping team/downline...');
  
  const team = {
    timestamp: new Date().toISOString(),
    members: [],
    totalDownline: 0
  };
  
  try {
    // Navigate to team section if available
    // This will vary based on doTERRA's actual URL structure
    const teamText = await page.evaluate(() => document.body.innerText);
    
    // Extract any member-related information
    const memberMatches = teamText.match(/(\w+\s+\w+)/g) || [];
    team.totalDownline = memberMatches.length;
    team.members = memberMatches.slice(0, 10); // First 10 unique names
    
  } catch (error) {
    console.error('[doTERRA] Error scraping team:', error.message);
  }
  
  return team;
}

async function runScraper() {
  let browser;
  
  try {
    console.log('[doTERRA] Starting browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await login(browser);
    
    // Scrape all data
    const metrics = await scrapeMetrics(page);
    const team = await scrapeTeam(page);
    
    // Combine and save
    const allData = {
      lastRun: new Date().toISOString(),
      metrics,
      team
    };
    
    fs.writeFileSync(METRICS_FILE, JSON.stringify(allData, null, 2));
    console.log('[doTERRA] Data saved to:', METRICS_FILE);
    
    // Print summary
    console.log('\n=== doTERRA Metrics ===');
    console.log('Active Users:', metrics.activeUsers);
    console.log('Monthly Revenue:', '$' + metrics.monthlyRevenue.toFixed(2));
    console.log('Team Size:', team.totalDownline);
    console.log('Status:', metrics.status);
    console.log('======================\n');
    
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

// Run the scraper
runScraper().catch(console.error);
