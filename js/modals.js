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

    // Logic for handling File URL (MP4 vs Image)
    if (video.preview) {
        const fileUrl = video.preview.toLowerCase();
        
        if (fileUrl.endsWith(".mp4") || fileUrl.endsWith(".webm") || fileUrl.endsWith(".mov")) {
            container.innerHTML = `
                <video id="modalVideo" controls class="w-full h-full object-contain" autoplay>
                    <source src="${video.preview}">
                </video>`;
        } else {
            container.innerHTML = `
                <img src="${video.preview}" alt="Preview" class="w-full h-full object-contain" />`;
        }

        modal.classList.remove('modal-hidden');
        modal.classList.add('modal-visible');
    } else {
        alert('Preview not available for this footage.');
    }
}

function closeModal() {
    const modal = document.getElementById('previewModal');
    const container = document.getElementById('modalMediaContainer');
    
    // Safety check: if a video is playing, stop it before clearing
    const videoPlayer = document.getElementById('modalVideo');
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = "";
    }

    container.innerHTML = '';
    modal.classList.remove('modal-visible');
    modal.classList.add('modal-hidden');
}

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
