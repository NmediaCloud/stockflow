// ============================================
// config.js - WORKING VERSION
// ============================================
const CONFIG = {
    // Google Sheet published ID
    SHEET_ID: '2PACX-1vSP5OJpICPPpGYxgeuVcpJdx8nR7LKqLTpDAWBlhLKUgZDafXqZ_tTpa8_1fM1bVHdBYGlorZxfiW8_',
    
    // Apps Script Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbzH0eSdqxNxAUFNw1BT9BsthQf4XJs54Q1Raiec40JptWxK846ra9iJPvwXNRY2NSUL/exec',
    
    // Wallet top-up amounts
    TOPUP_AMOUNTS: [10, 20, 30],
    
    // LocalStorage key
    STORAGE_KEY: 'stockflow_user_email',
    
    // Items per page
    ITEMS_PER_LOAD: 80,
    
    // Site URL
    SITE_URL: 'https://stockflow.media'
};

// ============================================
// IMPORTANT: For published sheets, you need to specify which TAB
// Your tab is "NMedia_Stockflow" which should be gid=0 (first tab)
// ============================================

// Build the CSV URL - use the TAB-SPECIFIC format
CONFIG.SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?gid=0&single=true&output=csv`;

console.log('✅ Config loaded');
console.log('📊 Using tab: NMedia_Stockflow (gid=0)');
console.log('🔗 CSV URL:', CONFIG.SHEET_CSV_URL);
