// ============================================
// config.js - Edit this file to change settings
// ============================================

const CONFIG = {
    // Google Sheet published CSV URL
    // To update: File → Share → Publish to web → CSV → Copy URL
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
    SITE_URL: 'https://nmediacloud.github.io/stockflow'
};

// Derived values (don't edit these)
CONFIG.SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?output=csv`;
