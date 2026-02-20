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

async function purchaseVideo(videoId, videoTitle, price) {
    if (!currentUser.isLoggedIn) {
        closeModal();
        showLoginModal();
        showNotification('Please sign in to purchase');
        return;
    }

    // ✅ CHECK FOR DUPLICATE PURCHASE
    const alreadyOwned = currentUser.purchases.find(p => p.videoId === videoId);
    if (alreadyOwned) {
        const purchaseDate = new Date(alreadyOwned.date).toLocaleDateString();
        const confirmRepurchase = confirm(
            `⚠️ You already purchased "${videoTitle}" on ${purchaseDate}.\n\n` +
            `According to our licensing terms, you should purchase again if using in a new project.\n\n` +
            `Do you want to purchase this video again?`
        );
        if (!confirmRepurchase) return;
    }

    if (currentUser.wallet < price) {
        const shortage = (price - currentUser.wallet).toFixed(2);
        showNotification(`Need $${shortage} more. Add funds?`, 'error');
        closeModal();
        showTopUpModal();
        return;
    }

    //if (!confirm(`Purchase "${videoTitle}"?`)) return;

    try {
        showNotification('Processing purchase...');
        const url = `${CONFIG.API_URL}?action=purchase&email=${encodeURIComponent(currentUser.email)}&videoId=${encodeURIComponent(videoId)}&videoTitle=${encodeURIComponent(videoTitle)}&amount=${price}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            currentUser.wallet = result.newBalance;
            await loadUserPurchases(currentUser.email); // Refresh purchase list
            updateWalletDisplay();
            closeModal();
            showNotification('✅ Purchase successful!', 'success');
            showDownloadModal(videoTitle, result.downloadLink);
        } else {
            showNotification('Error: ' + (result.message || 'Purchase failed'), 'error');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showNotification('Error processing purchase', 'error');
    }
}

function handlePurchase() {
    if (!currentVideo) return;
    purchaseVideo(currentVideo.id, currentVideo.title, parseFloat(currentVideo.price));
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
    document.getElementById('historyList').innerHTML = '<p style="color:#666;">Loading...</p>';
    
    await loadUserPurchases(currentUser.email);
    
    if (!currentUser.purchases || currentUser.purchases.length === 0) {
        document.getElementById('historyList').innerHTML = '<p style="color:#999;">No purchases yet.</p>';
        return;
    }
    
    let html = '<div style="margin-bottom:15px;padding:12px;background:#FEF3C7;border-radius:8px;">';
    html += '<p style="font-size:12px;color:#92400E;margin:0;">';
    html += '💡 <strong>License Reminder:</strong> Each purchase is licensed for one project. ';
    html += 'Using in multiple projects? Please purchase again. ';
    html += '<a href="#" onclick="showLicenseInfo();return false;" style="color:#0369A1;text-decoration:underline;">View full license terms</a>';
    html += '</p></div>';
    
    currentUser.purchases.forEach(function(p) {
        const dlUrl = (p.downloadLink || '').replace('export=view', 'export=download');
        html += '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin-bottom:10px;">';
        html += '<strong>' + p.title + '</strong>';
        html += '<span style="float:right;color:#F97316;">$' + p.amount + '</span><br>';
        html += '<small style="color:#999;">' + new Date(p.date).toLocaleDateString() + '</small>';
        html += '<a href="' + dlUrl + '" style="display:block;margin-top:8px;color:#F97316;">📥 Download</a>';
        html += '</div>';
    });
    
    document.getElementById('historyList').innerHTML = html;
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
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
                showNotification('✅ Payment successful! Wallet updated.', 'success');
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
