const CONFIG = {
    REAL_SHEET_ID: '12eyXAI9-hT0TFSx2HhVDUWHXo4X9QVT-vSPmGQBx6c8',
    TAB_GID: '65282458',
    API_URL: 'https://script.google.com/macros/s/AKfycbzH0eSdqxNxAUFNw1BT9BsthQf4XJs54Q1Raiec40JptWxK846ra9iJPvwXNRY2NSUL/exec',
    STRIPE_PUBLISHABLE_KEY: '__STRIPE_PUBLISHABLE_KEY__',
    TOPUP_AMOUNTS: [1, 5, 10, 20, 30],
    STORAGE_KEY: 'stockflow_user_email',
    ITEMS_PER_LOAD: 80,
    SITE_URL: 'https://stockflow.media'
};
CONFIG.SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.REAL_SHEET_ID}/export?format=csv&gid=${CONFIG.TAB_GID}`;
console.log('✅ Config loaded');
console.log('🔑 Stripe key:', CONFIG.STRIPE_PUBLISHABLE_KEY !== '__STRIPE_PUBLISHABLE_KEY__' ? 'Loaded ✅' : 'Missing ❌');
