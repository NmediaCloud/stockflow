// ============================================
// config.js - FINAL WORKING VERSION
// ============================================
const CONFIG = {
    // Real Sheet ID from your edit URL
    REAL_SHEET_ID: '12eyXAI9-hT0TFSx2HhVDUWHXo4X9QVT-vSPmGQBx6c8',
    
    // NMedia_Stockflow tab GID
    TAB_GID: '65282458',
    
    // Apps Script Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbzH0eSdqxNxAUFNw1BT9BsthQf4XJs54Q1Raiec40JptWxK846ra9iJPvwXNRY2NSUL/exec',
    
    // Wallet settings
    TOPUP_AMOUNTS: [10, 20, 30],
    STORAGE_KEY: 'stockflow_user_email',
    ITEMS_PER_LOAD: 80,
    SITE_URL: 'https://stockflow.media'
};

// Use EXPORT format with the specific tab GID
CONFIG.SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.REAL_SHEET_ID}/export?format=csv&gid=${CONFIG.TAB_GID}`;

console.log('✅ Config loaded');
console.log('📊 Sheet ID:', CONFIG.REAL_SHEET_ID);
console.log('📋 Tab GID:', CONFIG.TAB_GID);
console.log('🔗 CSV URL:', CONFIG.SHEET_CSV_URL);
