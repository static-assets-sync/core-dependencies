#!/usr/bin/env node

/**
 * doTERRA HTML Debug Script
 * Extracts and dumps actual DOM structure to find correct selectors
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  dashboardUrl: 'https://office.doterra.com/index.cfm?EvoRedirect=1&MainKey=MainMenu&tabsel=MainMenu'
};

async function debugHTML() {
  let browser;
  
  try {
    console.log('🔍 doTERRA HTML Debug Script');
    console.log('====================================');
    
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    
    console.log('📍 Navigating to dashboard...');
    await page.goto(CONFIG.dashboardUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('⏳ Waiting for content to load (10 seconds)...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('📸 Taking screenshot for manual inspection...');
    await page.screenshot({ path: '/Users/mac/.openclaw/workspace/doterra-debug-screenshot.png' });
    console.log('✅ Screenshot saved: /Users/mac/.openclaw/workspace/doterra-debug-screenshot.png');
    
    console.log('\n🔎 Extracting HTML structure...');
    
    const analysis = await page.evaluate(() => {
      return {
        // All text content
        pageText: document.body.innerText,
        
        // Look for member-related content
        allDivs: document.querySelectorAll('div').length,
        allTables: document.querySelectorAll('table').length,
        allSpans: document.querySelectorAll('span').length,
        
        // Find divs with numbers (OV/PV)
        divsWithNumbers: Array.from(document.querySelectorAll('div')).filter(d => {
          const text = d.innerText;
          return text && /\d+[\d,]*\.?\d*/.test(text);
        }).slice(0, 10).map(d => ({
          text: d.innerText.substring(0, 100),
          classes: d.className,
          id: d.id
        })),
        
        // Find all elements with "member" or "enroll" in text
        memberElements: Array.from(document.querySelectorAll('*')).filter(el => {
          const text = (el.innerText || el.textContent || '').toLowerCase();
          return text.includes('member') || text.includes('enroll') || text.includes('volume');
        }).slice(0, 15).map(el => ({
          tag: el.tagName,
          text: (el.innerText || el.textContent).substring(0, 100),
          classes: el.className,
          id: el.id
        })),
        
        // Get page structure (first 20 divs with IDs or classes)
        mainStructure: Array.from(document.querySelectorAll('div[id], div[class]')).slice(0, 20).map(d => ({
          tag: d.tagName,
          id: d.id,
          className: d.className,
          childCount: d.children.length,
          textLength: (d.innerText || '').length
        }))
      };
    });
    
    // Save analysis to file
    const analysisPath = '/Users/mac/.openclaw/workspace/doterra-debug-analysis.json';
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`✅ Analysis saved: ${analysisPath}`);
    
    // Print key findings
    console.log('\n📊 KEY FINDINGS:');
    console.log(`   Total divs: ${analysis.allDivs}`);
    console.log(`   Total tables: ${analysis.allTables}`);
    console.log(`   Total spans: ${analysis.allSpans}`);
    
    console.log('\n🔢 Divs with numbers:');
    analysis.divsWithNumbers.forEach((d, i) => {
      console.log(`   ${i+1}. "${d.text.substring(0, 50)}" | class="${d.classes}" | id="${d.id}"`);
    });
    
    console.log('\n📍 Elements with "member/enroll/volume":');
    analysis.memberElements.forEach((el, i) => {
      console.log(`   ${i+1}. <${el.tag}> "${el.text.substring(0, 50)}" | class="${el.classes}"`);
    });
    
    console.log('\n🏗️ Main structure:');
    analysis.mainStructure.forEach((d, i) => {
      console.log(`   ${i+1}. <${d.tag}> id="${d.id}" class="${d.className}" (${d.childCount} children)`);
    });
    
    // Get raw HTML of key sections
    console.log('\n💾 Dumping full HTML...');
    const fullHTML = await page.content();
    fs.writeFileSync('/Users/mac/.openclaw/workspace/doterra-debug-full.html', fullHTML);
    console.log('✅ Full HTML saved: /Users/mac/.openclaw/workspace/doterra-debug-full.html');
    
    console.log('\n====================================');
    console.log('✅ Debug complete!');
    console.log('📁 Files saved:');
    console.log('   - doterra-debug-screenshot.png (visual inspection)');
    console.log('   - doterra-debug-analysis.json (structure analysis)');
    console.log('   - doterra-debug-full.html (raw HTML)');
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugHTML();
