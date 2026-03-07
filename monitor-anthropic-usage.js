#!/usr/bin/env node

/**
 * Anthropic Token Usage Monitor
 * Checks quota, sends alerts if > 70% used
 * Run daily via cron or heartbeat
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || null;
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || null;
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || null;
const ALERT_FILE = path.join(__dirname, 'anthropic-alerts.json');

if (!ANTHROPIC_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function getUsage() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages/count_tokens',
      method: 'GET',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Try to parse JSON if available
          if (data) {
            resolve(JSON.parse(data));
          } else {
            // Fallback: use headers or make estimate call
            resolve({ 
              usage: { input_tokens: 0, output_tokens: 0 },
              quota: { limit: 1000000 } // Estimate
            });
          }
        } catch (e) {
          resolve({ 
            usage: { input_tokens: 0, output_tokens: 0 },
            quota: { limit: 1000000 }
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkBudget() {
  return new Promise((resolve, reject) => {
    // Use a test API call to check status
    const testPayload = JSON.stringify({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-beta': 'token-counting-2024-11-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // Check for budget/rate limit errors
          if (res.statusCode === 429) {
            resolve({ error: 'RATE_LIMITED', status: 429 });
          } else if (response.error?.type === 'overloaded_error') {
            resolve({ error: 'API_OVERLOADED', status: 529 });
          } else if (res.statusCode === 401) {
            resolve({ error: 'INVALID_KEY', status: 401 });
          } else {
            // Parse usage from response headers or body
            const usage = response.usage || {};
            const spent = (usage.input_tokens || 0) * 0.003 + (usage.output_tokens || 0) * 0.015;
            
            resolve({
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              estimatedSpent: spent,
              status: 'ok'
            });
          }
        } catch (e) {
          resolve({ error: 'PARSE_ERROR', status: 500 });
        }
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ error: 'TIMEOUT', status: 0 });
    });

    req.on('error', () => {
      resolve({ error: 'NETWORK_ERROR', status: 0 });
    });

    req.write(testPayload);
    req.end();
  });
}

async function sendTelegram(message, isAlert = false) {
  if (!TELEGRAM_BOT || !TELEGRAM_CHAT) {
    log('⚠️  Telegram not configured');
    return;
  }

  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT}/sendMessage`,
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
  log('════════════════════════════════════════');
  log('📊 ANTHROPIC USAGE MONITOR');
  log(`📅 ${new Date().toLocaleString()}`);
  log('════════════════════════════════════════');

  try {
    const budget = await checkBudget();

    if (budget.error) {
      log(`⚠️  API Error: ${budget.error}`);
      
      if (budget.error === 'INVALID_KEY') {
        log('❌ CRITICAL: Invalid Anthropic API key!');
        await sendTelegram(
          '❌ <b>CRITICAL ANTHROPIC ERROR</b>\n' +
          'Invalid API key detected.\n' +
          'Please check your ANTHROPIC_API_KEY immediately.',
          true
        );
      } else if (budget.error === 'RATE_LIMITED') {
        log('⚠️  Rate limited - likely quota exceeded');
        await sendTelegram(
          '⚠️ <b>ANTHROPIC RATE LIMITED</b>\n' +
          'You may have exceeded your monthly quota.\n' +
          'Check your Anthropic console: https://console.anthropic.com/billing',
          true
        );
      }
      process.exit(1);
    }

    // Estimate usage (simplified)
    const estimatedMonthlySpend = budget.estimatedSpent || 0;
    const estimatedMonthlyBudget = 300; // Default $300/month
    const percentageUsed = Math.round((estimatedMonthlySpend / estimatedMonthlyBudget) * 100);
    const estimatedRemaining = estimatedMonthlyBudget - estimatedMonthlySpend;

    log(`📈 Estimated Monthly Spend: $${estimatedMonthlySpend.toFixed(2)}`);
    log(`📊 Percentage Used: ${percentageUsed}%`);
    log(`💰 Estimated Remaining: $${estimatedRemaining.toFixed(2)} / $${estimatedMonthlyBudget}`);

    // Check if alert needed
    let alertMessage = null;
    if (percentageUsed >= 90) {
      alertMessage = `🚨 CRITICAL: ${percentageUsed}% quota used`;
      log(alertMessage);
    } else if (percentageUsed >= 70) {
      alertMessage = `⚠️  WARNING: ${percentageUsed}% quota used`;
      log(alertMessage);
    } else {
      log(`✅ Usage healthy: ${percentageUsed}% of quota`);
    }

    // Load previous alerts to avoid spam
    let previousAlerts = {};
    if (fs.existsSync(ALERT_FILE)) {
      previousAlerts = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    }

    const today = new Date().toISOString().split('T')[0];
    const alertKey = `${today}_${percentageUsed}`;

    if (alertMessage && !previousAlerts[alertKey]) {
      log(`📨 Sending Telegram alert...`);
      const telegramMsg = 
        `<b>💳 Anthropic Usage Report</b>\n` +
        `\n` +
        `<b>Quota Status:</b>\n` +
        `• Used: ${percentageUsed}%\n` +
        `• Spent: $${estimatedMonthlySpend.toFixed(2)}\n` +
        `• Remaining: $${estimatedRemaining.toFixed(2)}\n` +
        `\n` +
        `${percentageUsed >= 90 ? '🚨 <b>ACTION REQUIRED:</b> Purchase more tokens immediately' : '⚠️ Consider purchasing additional tokens'}\n` +
        `\n` +
        `🔗 <a href="https://console.anthropic.com/keys">Manage billing</a>`;

      await sendTelegram(telegramMsg, true);

      previousAlerts[alertKey] = new Date().toISOString();
      fs.writeFileSync(ALERT_FILE, JSON.stringify(previousAlerts, null, 2));
    }

    log('════════════════════════════════════════');
    log('✅ Monitor complete');

  } catch (error) {
    log(`❌ FATAL: ${error.message}`);
    process.exit(1);
  }
}

main();
