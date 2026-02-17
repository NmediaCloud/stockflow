// ============================================
// wallet.js - Wallet, login, and payment functions
// ============================================

let currentUser = {
    email: null,
    wallet: 0,
    isLoggedIn: false
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
            currentUser = { email: user.email, wallet: user.wallet || 0, isLoggedIn: true };
        } else {
            currentUser = { email: email, wallet: 0, isLoggedIn: true };
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        // Still log them in locally even if API fails
        currentUser = { email: email, wallet: 0, isLoggedIn: true };
        showNotification('Signed in (offline mode)', 'info');
    }
}

function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    currentUser = { email: null, wallet: 0, isLoggedIn: false };
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

    if (currentUser.wallet < price) {
        const shortage = (price - currentUser.wallet).toFixed(2);
        showNotification(`Need $${shortage} more. Add funds?`, 'error');
        closeModal();
        showTopUpModal();
        return;
    }

    if (!confirm(`Purchase "${videoTitle}" for $${price.toFixed(2)}?`)) return;

    try {
        showNotification('Processing purchase...');
        const url = `${CONFIG.API_URL}?action=purchase&email=${encodeURIComponent(currentUser.email)}&videoId=${encodeURIComponent(videoId)}&videoTitle=${encodeURIComponent(videoTitle)}&amount=${price}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            currentUser.wallet = result.newBalance;
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
    // ADD THESE DEBUG LINES
    console.log('=== PURCHASE DEBUG ===');
    console.log('currentVideo:', currentVideo);
    console.log('currentVideo.id:', currentVideo ? currentVideo.id : 'null');
    console.log('currentVideo.title:', currentVideo ? currentVideo.title : 'null');
    console.log('currentVideo.price:', currentVideo ? currentVideo.price : 'null');
    console.log('======================'); 
 
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
// EXPOSE FUNCTIONS TO WINDOW (for HTML onclick)
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
