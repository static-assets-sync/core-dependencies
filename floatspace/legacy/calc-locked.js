/**
 * calc.js - LOCKED VERSION
 * 
 * This is the verified "Single Line" logic frozen in place.
 * It ONLY reads the Warehouse URL from delivery.json.
 * NO other changes are allowed (OpenClaw cannot modify this file).
 * 
 * Binary behavior: Works or doesn't. No middle ground.
 */

// ============================================
// CONFIG: Load from delivery.json (Only Dynamic Part)
// ============================================

let WAREHOUSE_URL = null;
let CONFIG_LOADED = false;

async function loadConfig() {
  try {
    const response = await fetch('delivery.json', { mode: 'cors' });
    const config = await response.json();
    WAREHOUSE_URL = config.warehouses.find(w => w.active === true)?.url;
    CONFIG_LOADED = true;
    
    if (!WAREHOUSE_URL) {
      console.error('❌ No active warehouse URL in delivery.json');
      showError('System configuration error. Contact support.');
      return false;
    }
    
    console.log('✅ Warehouse loaded:', WAREHOUSE_URL.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.error('❌ Config load failed:', error);
    showError('Could not load system configuration.');
    return false;
  }
}

// ============================================
// THE VERIFIED "SINGLE LINE" (FROZEN)
// ============================================

async function sendMessage(data) {
  if (!CONFIG_LOADED || !WAREHOUSE_URL) {
    console.error('❌ Config not loaded. Cannot send message.');
    return false;
  }

  try {
    // The verified fetch logic - DO NOT MODIFY
    const response = await fetch(WAREHOUSE_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        userId: getUserId(),
        sessionId: getSessionId(),
      }),
    });

    // Note: mode: 'no-cors' means we can't read response status
    // Trust that it worked if no error thrown
    console.log('✅ Message sent to warehouse');
    return true;
  } catch (error) {
    console.error('❌ Send failed:', error);
    showError('Failed to send message. Check your connection.');
    return false;
  }
}

// ============================================
// UI HELPERS (FROZEN)
// ============================================

function showError(message) {
  const errorDiv = document.getElementById('error-message') || document.createElement('div');
  errorDiv.id = 'error-message';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff4444;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  `;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function getUserId() {
  // Generate or retrieve persistent user ID
  let userId = localStorage.getItem('floatspace-userid');
  if (!userId) {
    userId = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('floatspace-userid', userId);
  }
  return userId;
}

function getSessionId() {
  // Session ID per browser tab
  if (!window.floatspaceSessionId) {
    window.floatspaceSessionId = 'session-' + Math.random().toString(36).substr(2, 9);
  }
  return window.floatspaceSessionId;
}

// ============================================
// INITIALIZATION (FROZEN)
// ============================================

async function init() {
  console.log('🚀 FloatSpace calc.js initializing...');
  
  const loaded = await loadConfig();
  if (!loaded) {
    console.error('❌ Failed to load configuration');
    return false;
  }

  // Hookup message sending to whatever UI layer calls this
  window.floatspaceSend = sendMessage;
  
  console.log('✅ FloatSpace ready');
  return true;
}

// Auto-init when page loads
document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================
// IMMUTABLE MARKER
// ============================================
// This file is LOCKED for OpenClaw.
// Only delivery.json should be modified.
// If you need to change this logic, do it manually.
// OpenClaw must never write to this file.
