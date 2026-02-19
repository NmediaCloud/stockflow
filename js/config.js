// ============================================
// config.js - FIXED VERSION
// ============================================
const CONFIG = {
    // Google Sheet published CSV URL
    SHEET_ID: '2PACX-1vSP5OJpICPPpGYxgeuVcpJdx8nR7LKqLTpDAWBlhLKUgZDafXqZ_tTpa8_1fM1bVHdBYGlorZxfiW8_',
    
    // Apps Script Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbzH0eSdqxNxAUFNw1BT9BsthQf4XJs54Q1Raiec40JptWxK846ra9iJPvwXNRY2NSUL/exec',
    
    // Wallet top-up amounts
    TOPUP_AMOUNTS: [10, 20, 30],
    
    // LocalStorage key for user session
    STORAGE_KEY: 'stockflow_user_email',
    
    // How many videos to load at once
    ITEMS_PER_LOAD: 80,
    
    // Site URL (for Stripe redirects)
    SITE_URL: 'https://stockflow.media'
};

// ============================================
// FIXED: Use /pub?gid=0&single=true&output=csv
// This format is more reliable than /pubhtml
// ============================================
CONFIG.SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?gid=0&single=true&output=csv`;

console.log('✅ Config loaded');
console.log('📊 Sheet URL:', CONFIG.SHEET_CSV_URL);
