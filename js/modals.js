// ============================================
// modals.js - Master UI & Notification Controller
// ============================================

// ---- SEO / SHARE META (per-item, updated when a modal opens) ----
const _DEFAULT_META = { saved: false };
function _setMeta(kind, key, val) {
    if (val == null) return;
    const sel = kind === 'property' ? `meta[property="${key}"]` : `meta[name="${key}"]`;
    let el = document.querySelector(sel);
    if (!el) { el = document.createElement('meta'); el.setAttribute(kind, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
}
function _saveDefaultMeta() {
    if (_DEFAULT_META.saved) return;
    _DEFAULT_META.title = document.title;
    const can = document.querySelector('link[rel="canonical"]');
    _DEFAULT_META.canonical = can ? can.href : location.href;
    ['og:title', 'og:description', 'og:image', 'og:url'].forEach(p => {
        const el = document.querySelector(`meta[property="${p}"]`); _DEFAULT_META[p] = el ? el.content : '';
    });
    ['twitter:title', 'twitter:description', 'twitter:image', 'twitter:url'].forEach(n => {
        const el = document.querySelector(`meta[name="${n}"]`); _DEFAULT_META[n] = el ? el.content : '';
    });
    _DEFAULT_META.saved = true;
}
function updateMetaForVideo(v) {
    _saveDefaultMeta();
    const url = `${location.origin}${location.pathname}?v=${v.id}`;
    const img = v.thumbnail || v.preview || '';
    const desc = v.description || '';
    document.title = `${v.title} | Stockflow.media`;
    let can = document.querySelector('link[rel="canonical"]');
    if (!can) { can = document.createElement('link'); can.rel = 'canonical'; document.head.appendChild(can); }
    can.href = url;
    _setMeta('property', 'og:title', v.title);
    _setMeta('property', 'og:description', desc);
    _setMeta('property', 'og:image', img);
    _setMeta('property', 'og:url', url);
    _setMeta('name', 'twitter:title', v.title);
    _setMeta('name', 'twitter:description', desc);
    _setMeta('name', 'twitter:image', img);
    _setMeta('name', 'twitter:url', url);
    try { const u = new URL(location.href); u.searchParams.set('v', v.id); history.replaceState({}, '', u); } catch (e) {}
}
function resetMeta() {
    if (!_DEFAULT_META.saved) return;
    document.title = _DEFAULT_META.title;
    const can = document.querySelector('link[rel="canonical"]'); if (can) can.href = _DEFAULT_META.canonical;
    _setMeta('property', 'og:title', _DEFAULT_META['og:title']);
    _setMeta('property', 'og:description', _DEFAULT_META['og:description']);
    _setMeta('property', 'og:image', _DEFAULT_META['og:image']);
    _setMeta('property', 'og:url', _DEFAULT_META['og:url']);
    _setMeta('name', 'twitter:title', _DEFAULT_META['twitter:title']);
    _setMeta('name', 'twitter:description', _DEFAULT_META['twitter:description']);
    _setMeta('name', 'twitter:image', _DEFAULT_META['twitter:image']);
    _setMeta('name', 'twitter:url', _DEFAULT_META['twitter:url']);
    try { const u = new URL(location.href); u.searchParams.delete('v'); history.replaceState({}, '', u); } catch (e) {}
}

// ---- PREVIEW MODAL ----
function openModal(video) {
    window.currentVideo = video; // 'window.' makes it accessible to wallet.js!
    updateMetaForVideo(video);   // per-item title/OG/canonical + address-bar ?v=
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('modalMediaContainer');

    // Update Text Metadata
    document.getElementById('modalTitle').innerText       = video.title;
    document.getElementById('modalCategory').innerText    = video.category;
    document.getElementById('modalSubcategory').innerText = video.subcategory || 'N/A';
    document.getElementById('modalSub').innerText         = video.sub || 'N/A';
    document.getElementById('modalFormat').innerText      = video.format;
    document.getElementById('modalResolution').innerText  = video.resolution;
    document.getElementById('modalPrice').innerText       = video.price;
    document.getElementById('modalDescription').innerText = video.description;

    // --- Area 2 Mount: File Format Display (Raw String from Sheet) ---
    const fileFormatEl = document.getElementById('modalFileFormat');
    if (fileFormatEl) {
        if (video.fileFormat) {
            fileFormatEl.innerText = `.${video.fileFormat}`; 
            fileFormatEl.style.display = 'inline-block';
        } else {
            fileFormatEl.style.display = 'none';
        }
    }

    // Update Tags
    const tagsContainer = document.getElementById('modalTags');
    tagsContainer.innerHTML = '';
    if (video.tags) {
        video.tags.split(',').map(t => t.trim()).filter(t => t).forEach(tag => {
            const el = document.createElement('span');
            el.className = 'px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs';
            el.innerText = tag;
            tagsContainer.appendChild(el);
        });
    }

    // ⭐ SMART LOGIC FOR HANDLING FILE URL (MP4 vs WebP/Image) ⭐
    if (video.preview) {
        // Clean the URL to ignore things like "?alt=media" at the end of the link
        const cleanUrl = video.preview.split('?')[0].toLowerCase();
        
        if (cleanUrl.endsWith(".mp4") || cleanUrl.endsWith(".webm") || cleanUrl.endsWith(".mov")) {
            // Render Video
            container.innerHTML = `
                <video id="modalVideo" controls controlsList="nodownload" oncontextmenu="return false;" class="w-full h-full object-contain" autoplay loop muted playsinline>
                    <source src="${video.preview}">
                    Your browser does not support the video tag.
                </video>`;
        } else {
            // Render WebP, JPG, GIF, or PNG
            container.innerHTML = `
                <img src="${video.preview}" alt="${video.title}" class="w-full h-full object-contain" />`;
        }

        // Force the modal to display properly
        modal.classList.remove('modal-hidden');
        modal.classList.add('modal-visible');
        modal.style.display = 'flex'; 
    } else {
        alert('Preview not available for this asset.');
    }
}

function closeModal() {
    resetMeta();   // restore homepage title/OG/canonical + clear ?v= from the URL
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('modalMediaContainer');
    
    // Safety check: if a video is playing, stop it before clearing
    const videoPlayer = document.getElementById('modalVideo');
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src'); 
        videoPlayer.load();
    }

    container.innerHTML = '';
    modal.classList.remove('modal-visible');
    modal.classList.add('modal-hidden');
    modal.style.display = 'none'; // Force hide it completely
}


// ---------------------------------------------------

function scrollToSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const headerHeight = 125; 
    const elementPosition = searchInput.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - headerHeight - 20;

    window.scrollTo({ top: offsetPosition, behavior: "smooth" });

    setTimeout(() => {
        searchInput.focus();
        searchInput.classList.add('ring-4', 'ring-orange-500');
        setTimeout(() => searchInput.classList.remove('ring-4', 'ring-orange-500'), 1500);
    }, 800);
}

// --- SHARE SYSTEM ---
function copyShareLink() {
    const activeVideo = window.currentVideo;
    if (!activeVideo) {
        console.error("No active video found to share.");
        return;
    }
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${activeVideo.id}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        if (typeof window.showNotification === 'function') {
            window.showNotification('🔗 URL copied to clipboard! You can now share it.', 'success');
        }

        const btnText = document.getElementById('shareBtnText');
        if (btnText) {
            btnText.innerText = 'Copied!';
            setTimeout(() => { btnText.innerText = 'Share'; }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        if (typeof window.showNotification === 'function') {
            window.showNotification('❌ Failed to copy link.', 'error');
        }
    });
}

// --- NOTIFICATION SYSTEM ---
function showNotification(message, type = 'success') {
    const toast = document.getElementById('notification');
    const msgEl = document.getElementById('notificationMessage');
    
    if (!toast || !msgEl) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    msgEl.textContent = message;
    
    const colors = {
        'error': '#EF4444', 
        'info': '#3B82F6',  
        'success': '#F97316' 
    };
    
    toast.style.backgroundColor = colors[type] || colors.success;
    toast.style.display = 'block';
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.add('hidden');
    }, 4000);
}

// --- GLOBAL EXPORTS ---
window.openModal = openModal;
window.closeModal = closeModal;
window.copyShareLink = copyShareLink;
window.showNotification = showNotification;
