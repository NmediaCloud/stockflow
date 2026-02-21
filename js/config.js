// ============================================
// config.js - STOCKFLOW CONFIGURATION
// Stripe key injected via GitHub Actions
// ============================================

const CONFIG = {
  // Google Sheets Data Source
  REAL_SHEET_ID: '12eyXAI9-hT0TFSx2HhVDUWHXo4X9QVT-vSPmGQBx6c8',
  TAB_GID: '65282458',
  
  // Apps Script API Endpoint
  API_URL: 'https://script.google.com/macros/s/AKfycbzH0eSdqxNxAUFNw1BT9BsthQf4XJs54Q1Raiec40JptWxK846ra9iJPvwXNRY2NSUL/exec',
  
  // Stripe Publishable Key (injected by GitHub Actions)
  STRIPE_PUBLISHABLE_KEY: '__STRIPE_PUBLISHABLE_KEY__', // ⭐ Replaced during deployment
  
  // Top-up amounts
  TOPUP_AMOUNTS: [10, 20, 30],
  
  // Storage
  STORAGE_KEY: 'stockflow_user_email',
  
  // Video loading
  ITEMS_PER_LOAD: 80,
  
  // Site URL
  SITE_URL: 'https://stockflow.media'
};

// Validation
if (!CONFIG.STRIPE_PUBLISHABLE_KEY || CONFIG.STRIPE_PUBLISHABLE_KEY === '__STRIPE_PUBLISHABLE_KEY__') {
  console.warn('⚠️ STRIPE_PUBLISHABLE_KEY not injected! Check GitHub Actions deployment.');
}

console.log('✅ Config loaded');
console.log('📡 API URL:', CONFIG.API_URL);
console.log('🔑 Stripe key:', CONFIG.STRIPE_PUBLISHABLE_KEY && CONFIG.STRIPE_PUBLISHABLE_KEY !== '__STRIPE_PUBLISHABLE_KEY__' ? 'Set ✅' : 'Missing ❌');
