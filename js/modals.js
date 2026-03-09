// ============================================
// modals.js - Master UI & Notification Controller
// ============================================

// ---- PREVIEW MODAL ----
function openModal(video) {
    window.currentVideo = video; // 'window.' makes it accessible to wallet.js!
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
                <video id="modalVideo" controls class="w-full h-full object-contain" autoplay loop muted playsinline>
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
