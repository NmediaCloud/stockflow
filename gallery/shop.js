// ============================================
// gallery/shop.js — purchase layer for the static gallery pages
//
// The static pages paint instantly with zero dependencies. This script then:
//   1. mounts the account bar (Sign In / Wallet / Purchases / Add Funds / info)
//   2. lazily "hydrates" the full shop: injects shop-ui.html (the SAME modal
//      markup as browse.html, extracted at build time), then loads
//      js/config.js -> js/wallet.js -> js/auth.js (Firebase session restore)
//   3. binds the asset page's License button to the in-page purchase flow
//      (wallet check -> purchase -> download modal) — no round-trip to the app
// ============================================
(function () {
    'use strict';

    // ---------- toast (wallet.js calls window.showNotification) ----------
    window.showNotification = function (message, type) {
        let toast = document.getElementById('notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'notification';
            toast.style.cssText = 'display:none;position:fixed;top:90px;right:20px;background:#F97316;color:#fff;padding:15px 20px;border-radius:8px;box-shadow:0 10px 15px rgba(0,0,0,0.3);z-index:99999;max-width:300px;font-weight:600;';
            toast.innerHTML = '<p id="notificationMessage" style="margin:0;"></p>';
            document.body.appendChild(toast);
        }
        const msgEl = document.getElementById('notificationMessage');
        if (msgEl) msgEl.textContent = message;
        toast.style.backgroundColor = { error: '#EF4444', info: '#3B82F6' }[type] || '#F97316';
        toast.style.display = 'block';
        clearTimeout(toast._t);
        toast._t = setTimeout(() => { toast.style.display = 'none'; }, 4000);
    };

    // ---------- account bar (ids match what js/wallet.js expects) ----------
    function mountAccountBar() {
        const bar = document.getElementById('accountBar');
        if (!bar) return;
        bar.innerHTML = `
        <a class="chip" href="#" onclick="shopOpen('help');return false;" title="How Stockflow works" style="padding:7px 9px;">ℹ️</a>
        <button id="loginButton" class="chip solid" onclick="shopOpen('login')">Sign In</button>
        <div id="walletDisplay" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;">
                <div class="chip" onclick="shopOpen('refresh')" title="Click to refresh balance">
                    <span class="lbl">Wallet</span><span id="walletAmount" class="amt">$0.00</span>
                </div>
                <button class="chip" onclick="shopOpen('history')">My Purchases</button>
                <button class="chip solid" onclick="shopOpen('topup')">Add Funds</button>
                <div style="position:relative;">
                    <button id="userMenuButton" class="chip" onclick="toggleUserMenu()" style="max-width:180px;min-width:70px;">
                        <span id="userEmailDisplay" class="email"></span> ▼
                    </button>
                    <div id="userMenu"
                         style="display:none;position:absolute;right:0;top:100%;margin-top:5px;background:#1F2933;border:1px solid #3A3F46;border-radius:6px;box-shadow:0 6px 14px rgba(0,0,0,0.4);min-width:170px;z-index:100;">
                        <a href="#" onclick="logout();return false;"
                           style="display:block;padding:10px 15px;color:#EF4444;text-decoration:none;font-size:13px;">Logout</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ---------- lazy hydration ----------
    let hydrating = null;
    function loadScript(src, asModule) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            if (asModule) s.type = 'module';
            s.src = src;
            s.onload = res;
            s.onerror = () => rej(new Error('failed: ' + src));
            document.head.appendChild(s);
        });
    }
    function hydrate() {
        if (hydrating) return hydrating;
        hydrating = (async () => {
            const r = await fetch('/gallery/shop-ui.html');
            if (r.ok) document.body.insertAdjacentHTML('beforeend', await r.text());
            // hydrate() is single-flight, so each script loads exactly once.
            // NB: config.js uses top-level `const CONFIG` — a global lexical
            // binding, NOT window.CONFIG — so test with typeof, not window.*
            await loadScript('/js/config.js');
            await loadScript('/js/wallet.js');
            await loadScript('/js/auth.js', true);   // Firebase — restores the session, lights up the wallet

            // topup buttons (the SPA builds these with an inline script we strip out)
            const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : window.CONFIG;
            const tc = document.getElementById('topupAmounts');
            if (tc && CFG && !tc.childElementCount) {
                CFG.TOPUP_AMOUNTS.forEach(amt => {
                    tc.innerHTML += `<button onclick="addFunds(${amt})" class="topup-button"><span style="font-size:24px;font-weight:bold;">$${amt}</span></button>`;
                });
            }
            // help modal helpers (also defined inline in the SPA)
            window.showHelpModal = function () { const m = document.getElementById('helpModal'); if (m) m.style.display = 'flex'; };
            window.closeHelpModal = function () {
                const m = document.getElementById('helpModal'); if (!m) return;
                m.style.display = 'none';
                const f = document.getElementById('helpVideo');
                if (f) { const u = f.src; f.src = ''; f.src = u; }
            };
            // current asset for handlePurchase()
            const d = document.getElementById('assetData');
            if (d) { try { window.currentVideo = JSON.parse(d.textContent); } catch (e) {} }
        })();
        return hydrating;
    }

    // ---------- one entry point for every shop control ----------
    window.shopOpen = async function (what) {
        try { await hydrate(); } catch (e) { window.showNotification('Shop failed to load — please refresh', 'error'); return; }
        const map = {
            login:   () => window.showLoginModal(),
            topup:   () => window.showTopUpModal(),
            history: () => window.showPurchaseHistory(),
            help:    () => window.showHelpModal(),
            about:   () => window.showAboutModal(),
            license: () => window.showLicenseInfo(),
            refresh: () => window.refreshWalletBalance()
        };
        if (map[what]) map[what]();
    };

    // ---------- boot ----------
    document.addEventListener('DOMContentLoaded', () => {
        mountAccountBar();

        // License button on asset pages: purchase right here (href stays as a
        // crawler/no-JS fallback to the browse app)
        const buy = document.getElementById('buyBtn');
        if (buy) {
            buy.addEventListener('click', async (e) => {
                e.preventDefault();
                const orig = buy.textContent;
                buy.textContent = '⏳ Preparing…';
                try { await hydrate(); } catch (err) { window.location.href = buy.href; return; }
                buy.textContent = orig;
                window.handlePurchase();
            });
        }

        // hydrate in idle time so signed-in visitors see their wallet without clicking
        setTimeout(() => { hydrate().catch(() => {}); }, 1500);
    });
})();
