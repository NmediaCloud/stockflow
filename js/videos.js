// ============================================
// videos.js - PERFORMANCE OPTIMIZED
// - Uniform 16:9 containers (same height)
// - Original aspect ratios preserved inside (object-contain)
// - NO video previews on hover (images only)
// - Fast loading with optimized thumbnails
// ============================================

let allVideos = [];
let filteredVideos = [];
let displayedVideos = [];
let currentVideo = null;
let currentLoadIndex = 0;

let categories = new Set();
let subcategories = {};
let subs = {};
let selectedCategory = null;
let selectedSubcategory = null;
let selectedSub = null;
let selectedFormat = 'all';

async function init() {
    console.log('🎬 Initializing Stockflow...');
    
    document.getElementById('status-text').innerHTML = 
        '<span class="inline-block w-2 h-2 bg-teal-500 rounded-full animate-pulse mr-2"></span>Loading content...';
    
    try {
        await loadVideosFromSheet();
        
        allVideos.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return a.id.localeCompare(b.id);
        });
        
        buildCategoryButtons();
        filterVideos();
        // --- ADD THIS BLOCK HERE ---
        // Check if the URL has a shared video ID (e.g., ?v=123)
       const urlParams = new URLSearchParams(window.location.search);
        const videoIdToOpen = urlParams.get('v');
        
        if (videoIdToOpen) {
            // Find the video in the master list
            const targetVideo = allVideos.find(v => v.id == videoIdToOpen);
            
            if (targetVideo) {
                console.log("🔗 Shared link detected. Auto-opening:", targetVideo.title);
                // We use a small timeout to let the grid finish rendering first
                setTimeout(() => {
                    openModal(targetVideo);
                }, 800); 
            }
        }
        // ---------------------------

        const featuredCount = allVideos.filter(v => v.featured).length;
        console.log(`✅ Loaded ${allVideos.length} videos (${featuredCount} featured)`);
        
    } catch (error) {
        console.error('❌ Init error:', error);
        document.getElementById('status-text').innerHTML = 
            '<span style="color: #EF4444;">⚠️ Error loading videos. Please refresh the page.</span>';
        document.getElementById('video-grid').innerHTML = `
            <div class="col-span-full bg-red-50 p-8 rounded-xl">
                <h3 class="text-red-800 font-bold text-xl mb-3">Error Loading Videos</h3>
                <p class="text-red-600 mb-3">${error.message}</p>
                <p class="text-sm text-gray-600">Check browser console (F12) for details.</p>
            </div>
        `;
    }
}

async function loadVideosFromSheet() {
    allVideos = []; // ⭐ THE FIX: Clear the array before loading new data
    const csvUrl = CONFIG.SHEET_CSV_URL;
    console.log('📡 Fetching from:', csvUrl);
    
    try {
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('Failed to fetch sheet: HTTP ' + response.status);
        
        const csvText = await response.text();
        console.log('📄 CSV received, length:', csvText.length);
        
        if (!csvText || csvText.trim().length === 0) {
            throw new Error('Sheet returned empty data');
        }
        
        const rows = parseCSV(csvText);
        console.log('📊 Parsed rows:', rows.length);
        
        if (rows.length < 2) {
            throw new Error('Sheet has no data rows');
        }
        
        console.log('📋 Column count:', rows[0].length);
        
        const hasFeaturedColumn = rows[0].length >= 15;
        console.log('⭐ Has Featured column:', hasFeaturedColumn);
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            const video = {
                id: (row[0] || '').toString().trim(),
                title: (row[1] || '').toString().trim(),
                category: (row[2] || '').toString().trim(),
                subcategory: (row[3] || '').toString().trim(),
                sub: (row[4] || '').toString().trim(),
                description: (row[5] || '').toString().trim(),
                thumbnail: (row[6] || '').toString().trim(),
                preview: (row[7] || '').toString().trim(),
                price: parseFloat(row[8]) || 1,
                format: (row[9] || '16:9').toString().trim(),
                resolution: (row[10] || '').toString().trim(),
                tags: (row[11] || '').toString().trim(),
                highResUrl: (row[13] || '').toString().trim(),
                featured: hasFeaturedColumn ? (row[14] === 'TRUE' || row[14] === 'true' || row[14] === true) : false
            };
            
            if (video.id && video.title && video.thumbnail && video.preview) {
                allVideos.push(video);
                
                if (video.category) {
                    categories.add(video.category);
                    
                    if (!subcategories[video.category]) {
                        subcategories[video.category] = new Set();
                    }
                    if (video.subcategory) {
                        subcategories[video.category].add(video.subcategory);
                    }
                    
                    const catSubKey = `${video.category}|${video.subcategory}`;
                    if (!subs[catSubKey]) {
                        subs[catSubKey] = new Set();
                    }
                    if (video.sub) {
                        subs[catSubKey].add(video.sub);
                    }
                }
            }
        }
        
        if (allVideos.length === 0) {
            throw new Error('No valid videos found in sheet');
        }
        
        console.log(`✅ Successfully loaded ${allVideos.length} videos`);
        
    } catch (error) {
        console.error('❌ Error loading videos:', error);
        throw error;
    }
}

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            }
        } else {
            currentCell += char;
        }
    }
    
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    
    return rows;
}

function buildCategoryButtons() {
    const container = document.getElementById('categoryButtons');
    container.innerHTML = '';
    
    const featuredCount = allVideos.filter(v => v.featured).length;
    
    if (featuredCount > 0) {
        const featuredBtn = document.createElement('button');
        featuredBtn.className = 'category-btn active px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm';
        featuredBtn.innerHTML = '⭐ Featured';
        // Passing 'e' ensures the neon ring logic works
        featuredBtn.onclick = (e) => selectCategory(null, e); 
        container.appendChild(featuredBtn);
    } else {
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm';
        allBtn.textContent = 'All Videos';
        allBtn.onclick = (e) => selectCategory(null, e);
        container.appendChild(allBtn);
    }
    
    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm';
        btn.textContent = cat;
        // Corrected function name to selectCategory and passed 'e'
        btn.onclick = (e) => selectCategory(cat, e);
        
        container.appendChild(btn);
    });
}
    // ============================================


// Add 'e' here to capture the event object
function selectCategory(category, e) {
    selectedCategory = category;
    selectedSubcategory = null;
    selectedSub = null;

    // 1. Clear active states
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. The Fix: Use the passed event or the window event
    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }
    
    // 3. Visibility logic
    const subSection = document.getElementById('subcategorySection');
    const subSubSection = document.getElementById('subSection');
    
    if (category === null) {
        subSection.classList.add('hidden');
        subSubSection.classList.add('hidden');
    } else if (subcategories[category] && subcategories[category].size > 0) {
        buildSubcategoryButtons(category);
        subSection.classList.remove('hidden');
    } else {
        subSection.classList.add('hidden');
    }
    
    subSubSection.classList.add('hidden');
    filterVideos();
}

function buildSubcategoryButtons(category) {
    const container = document.getElementById('subcategoryButtons');
    const title = document.getElementById('subcategoryTitle');
    
    container.innerHTML = '';
    title.textContent = `${category} Types`;
    
    const sortedSubs = Array.from(subcategories[category]).sort();
    sortedSubs.forEach(sub => {
        const count = allVideos.filter(v => v.category === category && v.subcategory === sub).length;
        
        const btn = document.createElement('button');
        
        // CLEANED CLASSNAME: Removed bg-white and teal colors
        btn.className = 'subcategory-btn px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm';
        
        btn.textContent = `${sub} (${count})`;
        
        // Passing 'e' ensures the neon ring logic works
        btn.onclick = (e) => selectSubcategory(sub, e);
        
        container.appendChild(btn);
    });
}

function selectSubcategory(subcategory, e) {
    selectedSubcategory = subcategory;
    selectedSub = null;

    // 1. Clear active states from this specific row
    document.querySelectorAll('.subcategory-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. Apply the Neon Ring
    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }
    
    // 3. Logic for the next row (Types)
    const catSubKey = `${selectedCategory}|${subcategory}`;
    const subSection = document.getElementById('subSection');
    
    if (subs[catSubKey] && subs[catSubKey].size > 0) {
        buildSubButtons(catSubKey);
        subSection.classList.remove('hidden');
    } else {
        subSection.classList.add('hidden');
    }
    
    filterVideos();
}




function buildSubButtons(catSubKey) {
    const container = document.getElementById('subButtons');
    container.innerHTML = '';
    
    const sortedSubs = Array.from(subs[catSubKey]).sort();
    sortedSubs.forEach(sub => {
        const btn = document.createElement('button');
        // CLEANED: Removed old bg-white/teal classes
        btn.className = 'sub-btn px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm';
        btn.textContent = sub;
        
        // Corrected: Passing 'e'
        btn.onclick = (e) => selectSub(sub, e);
        
        container.appendChild(btn);
    });
}

function selectSub(sub, e) {
    selectedSub = sub;
    
    // 1. Clear 'active' from all Type buttons in this row
    document.querySelectorAll('.sub-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 2. Apply neon ring using the passed event
    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }
    
    filterVideos();
}



function filterVideos() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    
    filteredVideos = allVideos.filter(video => {
        if (selectedCategory === null) {
            const hasFeatured = allVideos.some(v => v.featured);
            if (hasFeatured && !video.featured) return false;
        }
        
        if (selectedCategory !== null && video.category !== selectedCategory) return false;
        if (selectedSubcategory && video.subcategory !== selectedSubcategory) return false;
        if (selectedSub && video.sub !== selectedSub) return false;
        if (selectedFormat !== 'all' && video.format !== selectedFormat) return false;
        
        if (searchTerm) {
            const searchableText = `${video.title} ${video.description} ${video.tags} ${video.category} ${video.subcategory} ${video.sub}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    currentLoadIndex = 0;
    displayedVideos = [];
    document.getElementById('video-grid').innerHTML = '';
    
    loadMore();
    
    document.getElementById('resultCount').textContent = `${filteredVideos.length} videos`;
    
    const statusEl = document.getElementById('status-text');
    if (filteredVideos.length === 0) {
        statusEl.innerHTML = '<span style="color: #9CA3AF;">No videos match your filters</span>';
    } else {
        statusEl.innerHTML = `<span class="inline-block w-2 h-2 bg-teal-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} videos loaded`;
    }
}

function filterByFormat(format, e) {
    selectedFormat = format;
    
    // 1. Clear active state from all format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 2. Add active class to the clicked button
    // Note: If called from HTML with onclick="filterByFormat('all', event)"
    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }
    
    filterVideos();
}

function loadMore() {
    const grid = document.getElementById('video-grid');
    const loadMoreBtn = document.getElementById('loadMoreSection');
    
    const endIndex = Math.min(currentLoadIndex + CONFIG.ITEMS_PER_LOAD, filteredVideos.length);
    const videosToLoad = filteredVideos.slice(currentLoadIndex, endIndex);
    
    videosToLoad.forEach(video => {
        const card = createVideoCard(video);
        grid.appendChild(card);
        displayedVideos.push(video);
    });
    
    currentLoadIndex = endIndex;
    
    if (currentLoadIndex < filteredVideos.length) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
    
    document.getElementById('status-text').innerHTML = 
        `<span class="inline-block w-2 h-2 bg-teal-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} videos loaded`;
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl rounded-xl overflow-hidden bg-white border border-gray-200';
    //card.setAttribute('onclick', "openModal(" + JSON.stringify(video).replace(/"/g, '&quot;') + ")");
    card.onclick = () => openModal(video);
      //  card.onclick = () => {
      //       if (typeof window.openModal === 'function') {
      //          window.openModal(video);
      //          } else {
                //console.error("openModal function not found!");
      //      }
      //      };
   
    const formatBadge = {
        '9:16': '📱 9:16',
        '1:1': '⬜ 1:1',
        '16:9': '🖥️ 16:9'
    }[video.format] || video.format;
    
    // ============================================
    // PERFORMANCE OPTIMIZED:
    // - Container: aspect-video (uniform 16:9 height)
    // - Image: object-contain (preserves original aspect ratio)
    // - NO video preview (removed for performance)
    // - Play icon overlay (indicates video available)
    // ============================================
    
    card.innerHTML = `
        <div class="relative overflow-hidden aspect-video bg-gray-900">
            <span class="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium">${formatBadge}</span>
            <img src="${video.thumbnail}" 
                 alt="${video.title}" 
                 class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110" 
                 loading="lazy">
            <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div class="bg-white/95 p-4 rounded-full shadow-xl">
                    <svg class="w-8 h-8 text-teal-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                    </svg>
                </div>
            </div>
        </div>
        <div class="p-4">
            <h3 class="font-bold text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-teal-600 transition">${video.title}</h3>
            <p class="text-xs text-gray-500 mb-2">${video.category} • ${video.subcategory || ''}</p>
            <div class="flex items-center justify-between">
                <span class="text-teal-600 font-bold text-lg">$${video.price}</span>
                <span class="text-xs text-gray-400">${video.resolution || 'HD'}</span>
            </div>
        </div>
    `;
    
    return card;
}

window.init = init;
window.filterVideos = filterVideos;
window.filterByFormat = filterByFormat;
window.loadMore = loadMore;


// --- MODAL TRIGGER ---
function openModal(video) {
    // 1. Set the global variable for wallet.js to use
    window.currentVideo = video;
    
    // 2. Call the modal display function (in your HTML/modals.js)
    if (typeof window.showPreviewModal === 'function') {
        window.showPreviewModal(video);
    } else {
        // Fallback if modals.js isn't separate
        console.log("Opening modal for:", video.title);
    }
}

// Expose to window so the HTML cards can click it
window.openModal = openModal;

// ---- NOTIFICATION SYSTEM ----
function showNotification(message, type = 'success') {
    const toast = document.getElementById('notification');
    const msgEl = document.getElementById('notificationMessage');
    
    if (!toast || !msgEl) {
        console.log(`Notification (${type}): ${message}`);
        return;
    }

    // Update content and styling
    msgEl.textContent = message;
    
    // Styling based on type
    if (type === 'error') {
        toast.style.backgroundColor = '#EF4444'; // Red
    } else if (type === 'info') {
        toast.style.backgroundColor = '#3B82F6'; // Blue
    } else {
        toast.style.backgroundColor = '#F97316'; // Your signature Orange
    }

    // Show the toast
    toast.style.display = 'block';
    toast.classList.remove('hidden');

    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.add('hidden');
    }, 4000);
}

// Expose globally
window.showNotification = showNotification;

