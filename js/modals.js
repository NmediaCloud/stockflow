// ============================================
// modals.js - Preview modal and UI utilities
// ============================================

// ---- PREVIEW MODAL ----

function openModal(video) {
    currentVideo = video;
    const modal = document.getElementById('previewModal');
    const videoPlayer = document.getElementById('modalVideo');

    document.getElementById('modalTitle').innerText       = video.title;
    document.getElementById('modalCategory').innerText    = video.category;
    document.getElementById('modalSubcategory').innerText = video.subcategory || 'N/A';
    document.getElementById('modalSub').innerText         = video.sub || 'N/A';
    document.getElementById('modalFormat').innerText      = video.format;
    document.getElementById('modalResolution').innerText  = video.resolution;
    document.getElementById('modalPrice').innerText       = video.price;
    document.getElementById('modalDescription').innerText = video.description;

    // Tags
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

    if (video.preview) {
        videoPlayer.style.display = 'block';
        videoPlayer.src = video.preview;
        videoPlayer.play().catch(() => {});
        modal.classList.remove('modal-hidden');
        modal.classList.add('modal-visible');
    } else {
        alert('Preview not available for this footage.');
    }
}

function closeModal() {
    const modal = document.getElementById('previewModal');
    const videoPlayer = document.getElementById('modalVideo');
    videoPlayer.pause();
    videoPlayer.src = '';
    modal.classList.remove('modal-visible');
    modal.classList.add('modal-hidden');
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ---- NOTIFICATION TOAST ----

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notificationMessage');

    messageEl.textContent = message;

    const colors = { error: '#EF4444', success: '#10B981', info: '#14B8A6' };
    notification.style.background = colors[type] || colors.info;
    notification.style.display = 'block';

    setTimeout(() => { notification.style.display = 'none'; }, 3000);
}
