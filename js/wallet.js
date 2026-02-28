// ============================================
// wallet.js - Updated with duplicate purchase check (no price in messages)
// ============================================

let currentUser = {
    email: null,
    wallet: 0,
    isLoggedIn: false,
    purchases: [] // Track user's purchased videos
};

// ---- DISPLAY ----

function updateWalletDisplay() {
    const loginButton = document.getElementById('loginButton');
    const walletDisplay = document.getElementById('walletDisplay');
    const walletAmount = document.getElementById('walletAmount');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    if (currentUser.isLoggedIn) {
        loginButton.style.display = 'none';
        walletDisplay.style.display = 'block';
        walletAmount.textContent = '$' + currentUser.wallet.toFixed(2);
        userEmailDisplay.textContent = currentUser.email;
    } else {
        loginButton.style.display = 'block';
        walletDisplay.style.display = 'none';
    }
}
// ---- MANUAL WALLET REFRESH ----
async function refreshWalletBalance() {
    // Only run if the user is actually logged in
    if (!currentUser.isLoggedIn || !currentUser.email) return;

    const walletAmountEl = document.getElementById('walletAmount');
    if (!walletAmountEl) return;

    // 1. Give immediate visual feedback that it's loading
    const originalText = walletAmountEl.textContent;
    walletAmountEl.textContent = '↻...';
    walletAmountEl.style.opacity = '0.7';

    try {
        // 2. Fetch the absolute latest data from Google Sheets
        await loadUserData(currentUser.email);
        
        // 3. Update the UI with the fresh data
        updateWalletDisplay();
        walletAmountEl.style.opacity = '1';
        
        if (typeof window.showNotification === 'function') {
            window.showNotification('Wallet balance synced', 'success');
        }
    } catch (error) {
        console.error('Error refreshing wallet:', error);
        // Revert the text if it fails
        walletAmountEl.textContent = originalText;
        walletAmountEl.style.opacity = '1';
        if (typeof window.showNotification === 'function') {
            window.showNotification('Failed to sync wallet', 'error');
        }
    }
}

// Ensure the HTML can see this new function
window.refreshWalletBalance = refreshWalletBalance;




// ---- LOGIN ----

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

async function loadUserData(email) {
    try {
        const url = `${CONFIG.API_URL}?action=getUser&email=${encodeURIComponent(email)}`;
        const response = await fetch(url);
        const user = await response.json();

        if (user && user.email) {
            currentUser.email = user.email;
            currentUser.wallet = user.wallet || 0;
            currentUser.isLoggedIn = true;
        } else {
            currentUser.email = email;
            currentUser.wallet = 0;
            currentUser.isLoggedIn = true;
        }
        
        // Load user's purchase history to check for duplicates
        await loadUserPurchases(email);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        currentUser = { email: email, wallet: 0, isLoggedIn: true, purchases: [] };
        showNotification('Signed in (offline mode)', 'info');
    }
}

async function loadUserPurchases(email) {
    try {
        const url = `${CONFIG.API_URL}?action=getPurchases&email=${encodeURIComponent(email)}`;
        const response = await fetch(url);
        const purchases = await response.json();
        currentUser.purchases = purchases || [];
    } catch (error) {
        console.error('Error loading purchases:', error);
        currentUser.purchases = [];
    }
}

function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    currentUser = { email: null, wallet: 0, isLoggedIn: false, purchases: [] };
    updateWalletDisplay();
    showNotification('Logged out successfully');
}

// ---- USER MENU ----

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function (event) {
    const menuButton = document.getElementById('userMenuButton');
    const menu = document.getElementById('userMenu');
    if (menu && menuButton && !menuButton.contains(event.target) && !menu.contains(event.target)) {
        menu.style.display = 'none';
    }
});

// ---- TOP-UP ----

function showTopUpModal() {
    if (!currentUser.isLoggedIn) { showLoginModal(); return; }
    document.getElementById('topUpModal').style.display = 'block';
}

function closeTopUpModal() {
    document.getElementById('topUpModal').style.display = 'none';
}

async function addFunds(amount) {
    if (!currentUser.isLoggedIn) { showLoginModal(); return; }

    try {
        showNotification('Creating checkout session...');
        const url = `${CONFIG.API_URL}?action=createCheckout&email=${encodeURIComponent(currentUser.email)}&amount=${amount}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.url) {
            window.location.href = result.url;
        } else {
            showNotification('Error: ' + (result.error || 'Failed to create checkout'), 'error');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showNotification('Error creating checkout session', 'error');
    }
}

// ---- PURCHASE ----
// ---- PURCHASE ----
// ---- CUSTOM DUPLICATE WARNING MODAL ----
// Dynamically creates a 5-second auto-proceeding warning modal
// ---- CUSTOM DUPLICATE WARNING MODAL (Softer UI) ----
// Dynamically creates a 5-second auto-proceeding warning modal
function promptDuplicateWarning(videoTitle, purchaseDate) {
    return new Promise((resolve) => {
        // 1. Create the modal if it doesn't exist yet
        let modal = document.getElementById('duplicateWarningModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'duplicateWarningModal';
            modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
            modal.innerHTML = `
                <div style="background:white; padding:30px; border-radius:12px; max-width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.15); font-family:sans-serif; margin: 20px;">
                    <h3 style="color:#F97316; font-size:1.4rem; font-weight:800; margin-top:0; margin-bottom:15px;">💡You already own a Lisence! </h3>
                    
                    <p style="margin-bottom:10px; font-size:1rem; color:#374151; line-height:1.5;">If its for a new project thats all Good! <br><strong id="dupVideoTitle" style="color:#000;"></strong> <br><span style="font-size:0.85rem; color:#6B7280;">(Purchased on <span id="dupVideoDate"></span>)</span></p>
                    
                    <div style="background:#FFF7ED; border:1px solid #FFEDD5; padding:15px; border-radius:8px; margin-bottom:20px;">
                        <p style="margin:0; font-size:0.85rem; color:#C2410C;">Download will begin <b>NEW</b>, no action is needed. Your new license will process automatically in:</p>
                        <p id="dupCountdown" style="margin:10px 0 0 0; color:#F97316; font-size:2rem; font-weight:900; line-height:1;">5</p>
                    </div>
                    
                    <button id="dupCancelBtn" style="background:#F3F4F6; color:#4B5563; padding:12px 20px; border-radius:8px; font-weight:bold; font-size:1rem; width:100%; cursor:pointer; border:1px solid #D1D5DB; transition:background 0.2s;">Wait, Cancel Purchase</button>
                </div>
            `;
            
            // Add hover effect for the cancel button
            const style = document.createElement('style');
            style.innerHTML = `#dupCancelBtn:hover { background: #E5E7EB !important; color: #1F2937 !important; }`;
            document.head.appendChild(style);
            
            document.body.appendChild(modal);
        }

        // 2. Populate the text
        document.getElementById('dupVideoTitle').innerText = `"${videoTitle}"`;
        document.getElementById('dupVideoDate').innerText = purchaseDate;
        
        const countdownEl = document.getElementById('dupCountdown');
        const cancelBtn = document.getElementById('dupCancelBtn');
        const warningModal = document.getElementById('duplicateWarningModal');
        
        warningModal.style.display = 'flex'; // Show modal

        let timeLeft = 10; // 5-second grace period
        countdownEl.innerText = timeLeft;

        // 3. Start the timer logic
        const timer = setInterval(() => {
            timeLeft--;
            countdownEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timer);
                warningModal.style.display = 'none';
                resolve(true); // Timer finished! Auto-proceed with purchase
            }
        }, 1000);

        // 4. Cancel button logic
        cancelBtn.onclick = () => {
            clearInterval(timer);
            warningModal.style.display = 'none';
            resolve(false); // User clicked cancel, abort purchase
        };
    });
}

// ---- PURCHASE ----

async function purchaseVideo(videoId, videoTitle, price, purchaseBtn, originalBtnText) {
    const numPrice = parseFloat(price);

    const unlockButton = () => {
        if (purchaseBtn) {
            purchaseBtn.disabled = false;
            purchaseBtn.innerText = originalBtnText;
            purchaseBtn.style.opacity = "1";
            purchaseBtn.style.cursor = "pointer";
        }
    };

    if (!currentUser.isLoggedIn) {
        unlockButton();
        if (typeof window.closeModal === 'function') window.closeModal(); 
        showLoginModal();
        window.showNotification('Please sign in to purchase', 'info');
        return;
    }

    try {
        window.showNotification('Checking license & wallet...', 'info');
        
        // 1. DUPLICATE CHECK
        await loadUserPurchases(currentUser.email);
        const alreadyOwned = currentUser.purchases.find(p => p.videoId == videoId);
        
        if (alreadyOwned) {
            const purchaseDate = new Date(alreadyOwned.date).toLocaleDateString();
            
            // Trigger our new auto-proceeding countdown modal!
            const proceed = await promptDuplicateWarning(videoTitle, purchaseDate);
            
            if (!proceed) {
                unlockButton(); // Restore button
                window.showNotification('Purchase cancelled.', 'info');
                return; // Stop the code here
            }
            // If they didn't cancel, the code automatically continues down to check the wallet!
        }

        // 2. WALLET CHECK
        await loadUserData(currentUser.email);
        
        if (currentUser.wallet < numPrice) {
            unlockButton(); 
            const shortage = (numPrice - currentUser.wallet).toFixed(2);
            window.showNotification(`Insufficient funds. You need $${shortage} more.`, 'error');
            
            if (typeof window.closeModal === 'function') window.closeModal();
            showTopUpModal();
            return;
        }

        // 3. EXECUTION: PROCESSING STATE
        window.showNotification('🔄 Processing transaction...', 'info');
        const url = `${CONFIG.API_URL}?action=purchase&email=${encodeURIComponent(currentUser.email)}&videoId=${encodeURIComponent(videoId)}&videoTitle=${encodeURIComponent(videoTitle)}&amount=${numPrice}`;
        
        const response = await fetch(url);
        const result = await response.json();

        unlockButton();

        if (result.success) {
            currentUser.wallet = result.newBalance;
            await loadUserPurchases(currentUser.email); 
            updateWalletDisplay();
            
            if (typeof window.closeModal === 'function') window.closeModal();
            window.showNotification('✔️ Purchase successful!', 'success');
            showDownloadModal(videoTitle, result.downloadLink);
        } else {
            window.showNotification('Error: ' + (result.message || 'Purchase failed'), 'error');
        }

    } catch (error) {
        console.error('Fulfillment Pipeline Error:', error);
        unlockButton(); 
        window.showNotification('Error connecting to wallet system', 'error');
    }
}

// ---- Updated handle purchase DOWNLOAD MODAL ----
function handlePurchase() {
    const purchaseBtn = document.querySelector('[onclick*="handlePurchase"]');
    const originalText = purchaseBtn ? purchaseBtn.innerText : "Download Now";

    if (purchaseBtn) {
        purchaseBtn.disabled = true;
        purchaseBtn.innerText = "⏳ Processing...";
        purchaseBtn.style.opacity = "0.6";
        purchaseBtn.style.cursor = "wait"; 
    }

    if (!window.currentVideo) {
        console.error("❌ No video selected.");
        window.showNotification("Error: No video selected.", "error");
        if (purchaseBtn) {
            purchaseBtn.disabled = false;
            purchaseBtn.innerText = originalText;
            purchaseBtn.style.opacity = "1";
            purchaseBtn.style.cursor = "pointer";
        }
        return;
    }
    
    const videoId = window.currentVideo.id;
    const videoTitle = window.currentVideo.title;
    const priceValue = parseFloat(window.currentVideo.price);

    purchaseVideo(videoId, videoTitle, priceValue, purchaseBtn, originalText);
}



// ---- DOWNLOAD MODAL ----

function showDownloadModal(videoTitle, downloadUrl) {
    document.getElementById('downloadVideoTitle').textContent = videoTitle;
    document.getElementById('downloadLink').href = downloadUrl;
    document.getElementById('downloadModal').style.display = 'block';
}

function closeDownloadModal() {
    document.getElementById('downloadModal').style.display = 'none';
}

// ---- PURCHASE HISTORY ----
async function showPurchaseHistory() {
    if (!currentUser.isLoggedIn) { showLoginModal(); return; }
    
    document.getElementById('historyModal').style.display = 'block';
    document.getElementById('historyList').innerHTML = '<p style="color:#9CA3AF; text-align:center;">Loading...</p>';
    
    await loadUserPurchases(currentUser.email);
    
    if (!currentUser.purchases || currentUser.purchases.length === 0) {
        document.getElementById('historyList').innerHTML = `
            <div class="text-center py-8 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-gray-600 mb-3 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                <p class="text-gray-500 mb-4 font-medium">You haven't purchased anything yet.</p>
                <button onclick="closeHistoryModal()" class="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">Browse Assets</button>
            </div>
        `;
        return;
    }
    
    // Upgraded Dark-Theme License Reminder
    let html = `
        <div style="background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.2); border-left: 3px solid #F97316; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 10px; align-items: flex-start;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px; color: #F97316; flex-shrink: 0; margin-top: 1px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div style="font-size: 13px; color: #9CA3AF; line-height: 1.5; padding-right: 20px;">
                <strong style="color: #F3F4F6;">License Reminder:</strong> Each purchase is licensed for one project. Using in multiple projects? Please purchase again. <a href="#" onclick="showLicenseInfo(); return false;" style="color: #F97316; text-decoration: none; font-weight: 500;">View full license terms</a>
            </div>
        </div>
    `;
    
    // Upgraded Dark-Theme Purchase Cards + SVG Download Button
    currentUser.purchases.forEach(function(p) {
        const dlUrl = (p.downloadLink || '').replace('export=view', 'export=download');
        html += `
            <div style="background: #2A2F36; border: 1px solid #3A3F46; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                <strong style="color: #F3F4F6;">${p.title}</strong>
                <span style="float:right; color:#F97316; font-weight: bold;">$${p.amount}</span><br>
                <small style="color:#9CA3AF;">${new Date(p.date).toLocaleDateString()}</small>
                
                <a href="${dlUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; margin-top:12px; color:#F97316; text-decoration:none; font-size: 14px; font-weight: 600; transition: color 0.2s;" onmouseover="this.style.color='#FB923C'" onmouseout="this.style.color='#F97316'">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download
                </a>
            </div>
        `;
    });
    
    document.getElementById('historyList').innerHTML = html;
}


// ---- LICENSE INFO ----

function showLicenseInfo() {
    document.getElementById('licenseModal').style.display = 'block';
}

function closeLicenseModal() {
    document.getElementById('licenseModal').style.display = 'none';
}

// ---- PAYMENT SUCCESS HANDLER ----

window.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('success') === 'true') {
        setTimeout(async () => {
            if (currentUser.email) {
                await loadUserData(currentUser.email);
                updateWalletDisplay();
                showNotification('✔️ Payment successful! Wallet updated.', 'success');
            }
        }, 1000);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (urlParams.get('canceled') === 'true') {
        showNotification('Payment canceled', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.showTopUpModal = showTopUpModal;
window.closeTopUpModal = closeTopUpModal;
window.addFunds = addFunds;
window.handlePurchase = handlePurchase;
window.toggleUserMenu = toggleUserMenu;
window.closeDownloadModal = closeDownloadModal;
window.loadUserData = loadUserData;
window.updateWalletDisplay = updateWalletDisplay;
window.logout = logout;
window.showPurchaseHistory = showPurchaseHistory;
window.closeHistoryModal = closeHistoryModal;
window.showLicenseInfo = showLicenseInfo;
window.closeLicenseModal = closeLicenseModal;


// ============================================
// MODAL & UI BRIDGE
// ============================================

/**
 * Acts as the bridge between videos.js (the grid) and the UI.
 * This is triggered whenever a user clicks a video card.
 */
// ============================================
// FINAL CORRECTED BRIDGE
// ============================================


// Add this to the bottom of js/wallet.js
function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.style.display = 'flex'; 
    }
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.style.display = 'none';
    }
}


// Function to close the My Purchases modal
function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Ensure the browser can see it
// Make sure the browser can see them

window.closeHistoryModal = closeHistoryModal;
window.showAboutModal = showAboutModal;
window.closeAboutModal = closeAboutModal;


