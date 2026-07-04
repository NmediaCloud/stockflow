// ============================================
// gallery/shop.js — purchase layer for the static gallery pages (v2)
//
// Gallery pages carry the SAME <nav> as the storefront (inlined at build
// time), so this script loads the storefront's own JS stack EAGERLY:
//   config.js -> modals.js -> wallet.js -> auth.js (Firebase)
// That restores the signed-in session + wallet immediately on page load
// (no race), and "License this image" opens the storefront's own
// preview/purchase modal INSTANTLY — closing it keeps you on this page.
// ============================================
(function () {
    'use strict';

    // fallback toast until modals.js takes over window.showNotification
    if (!window.showNotification) {
        window.showNotification = function (message) { console.log('[stockflow]', message); };
    }

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

    let hydrating = null;
    function hydrate() {
        if (hydrating) return hydrating;
        hydrating = (async () => {
            const r = await fetch('/gallery/shop-ui.html');
            if (r.ok) document.body.insertAdjacentHTML('beforeend', await r.text());
            await loadScript('/js/config.js');
            await loadScript('/js/modals.js?v=7');
            await loadScript('/js/wallet.js?v=10');
            await loadScript('/js/auth.js', true);   // Firebase — restores session + wallet chips in the nav

            // topup buttons (the SPA builds these with an inline script we strip out)
            const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : window.CONFIG;
            const tc = document.getElementById('topupAmounts');
            if (tc && CFG && !tc.childElementCount) {
                CFG.TOPUP_AMOUNTS.forEach(amt => {
                    tc.innerHTML += `<button onclick="addFunds(${amt})" class="topup-button"><span style="font-size:24px;font-weight:bold;">$${amt}</span></button>`;
                });
            }
            // help modal helpers (also inline-script in the SPA, stripped here)
            window.showHelpModal = function () { const m = document.getElementById('helpModal'); if (m) m.style.display = 'flex'; };
            window.closeHelpModal = function () {
                const m = document.getElementById('helpModal'); if (!m) return;
                m.style.display = 'none';
                const f = document.getElementById('helpVideo');
                if (f) { const u = f.src; f.src = ''; f.src = u; }
            };
            // this page's asset — SPA-shaped, ready for openModal()/handlePurchase()
            const d = document.getElementById('assetData');
            if (d) { try { window.currentVideo = JSON.parse(d.textContent); } catch (e) {} }
        })();
        return hydrating;
    }

    // footer / misc entry points
    window.shopOpen = async function (what) {
        try { await hydrate(); } catch (e) { return; }
        const map = {
            login:   () => window.showLoginModal(),
            topup:   () => window.showTopUpModal(),
            history: () => window.showPurchaseHistory(),
            help:    () => window.showHelpModal(),
            about:   () => window.showAboutModal(),
            license: () => window.showLicenseInfo(),
        };
        if (map[what]) map[what]();
    };

    document.addEventListener('DOMContentLoaded', () => {
        // EAGER: start restoring the session right now, so by the time the
        // visitor clicks anything, wallet + auth are already live.
        hydrate().catch(() => {});

        // License button -> the storefront's own purchase modal, instantly.
        const buy = document.getElementById('buyBtn');
        if (buy) {
            buy.addEventListener('click', async (e) => {
                e.preventDefault();
                try { await hydrate(); } catch (err) { window.location.href = buy.href; return; }
                if (window.currentVideo && typeof window.openModal === 'function') {
                    window.openModal(window.currentVideo);
                } else {
                    window.location.href = buy.href;   // last-resort fallback
                }
            });
        }
    });
})();
