// ============================================
// modals.js - Updated with Image/Video Logic
// ============================================

// ---- PREVIEW MODAL ----

function openModal(video) {
    currentVideo = video;
    const modal = document.getElementById('previewModal');
    // Identify the container where we will inject the media
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
            // Inject Video Player
            container.innerHTML = `
                <video id="modalVideo" controls class="w-full h-full object-contain" autoplay>
                    <source src="${video.preview}">
                </video>`;
        } else {
            // Inject Image (WebP, JPG, etc.)
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

    // Clear the container content
    container.innerHTML = '';
    
    modal.classList.remove('modal-visible');
    modal.classList.add('modal-hidden');
}
