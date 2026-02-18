// ============================================
// videos.js - Featured videos with clean UI
// ============================================

let allVideos = [];
let filteredVideos = [];
let displayedVideos = [];
let currentVideo = null;
let currentLoadIndex = 0;

// Track categories and filters
let categories = new Set();
let subcategories = {};
let subs = {};
let selectedCategory = null;
let selectedSubcategory = null;
let selectedSub = null;
let selectedFormat = 'all';

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    console.log('🎬 Initializing Stockflow...');
    
    // Show loading state
    document.getElementById('status-text').innerHTML = 
        '<span class="inline-block w-2 h-2 bg-teal-500 rounded-full animate-pulse mr-2"></span>Loading featured content...';
    
    try {
        await loadVideosFromSheet();
        
        // Sort videos: Featured first, then by File_ID
        allVideos.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return a.id.localeCompare(b.id);
        });
        
        buildCategoryButtons();
        filterVideos();
        
        console.log(`✅ Loaded ${allVideos.length} videos (${allVideos.filter(v => v.featured).length} featured)`);
        
    } catch (error) {
        console.error('❌ Init error:', error);
        document.getElementById('status-text').innerHTML = 
            '<span style="color: #EF4444;">⚠️ Error loading videos. Please refresh the page.</span>';
    }
}

// ============================================
// LOAD DATA FROM GOOGLE SHEETS
// ============================================

async function loadVideosFromSheet() {
    const csvUrl = CONFIG.SHEET_CSV_URL;
    
    try {
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('Failed to fetch sheet');
        
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 12) continue;
            
            const video = {
                id: row[0] || '',
                title: row[1] || '',
                category: row[2] || '',
                subcategory: row[3] || '',
                sub: row[4] || '',
                description: row[5] || '',
                thumbnail: row[6] || '',
                preview: row[7] || '',
                price: parseFloat(row[8]) || 25,
                format: row[9] || '16:9',
                resolution: row[10] || '',
                tags: row[11] || '',
                highResUrl: row[13] || '',
                featured: row[14] === 'TRUE'
            };
            
            if (video.id && video.title && video.thumbnail && video.preview) {
                allVideos.push(video);
                
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
        
        console.log(`📊 Parsed ${allVideos.length} videos from sheet`);
        console.log(`⭐ Featured videos: ${allVideos.filter(v => v.featured).length}`);
        
    } catch (error) {
        console.error('Error loading videos:', error);
        throw error;
    }
}

// ============================================
// CSV PARSING
// ============================================

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

// ============================================
// CATEGORY BUTTONS
// ============================================

function buildCategoryButtons() {
    const container = document.getElementById('categoryButtons');
    container.innerHTML = '';
    
    // Featured count
    const featuredCount = allVideos.filter(v => v.featured).length;
    
    // Featured button (only special button)
    const featuredBtn = document.createElement('button');
    featuredBtn.className = 'category-btn active px-4 py-2 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition shadow-sm';
    featuredBtn.innerHTML = '⭐ Featured';
    featuredBtn.onclick = () => selectCategory(null);
    container.appendChild(featuredBtn);
    
    // Regular category buttons (no special styling)
    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
        const count = allVideos.filter(v => v.category === cat).length;
        
        const btn = document.createElement('button');
        btn.className = 'category-btn px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-teal-500 hover:text-white border border-gray-200 transition shadow-sm';
        btn.textContent = cat;
        btn.onclick = () => selectCategory(cat);
        
        container.appendChild(btn);
    });
}

function selectCategory(category) {
    selectedCategory = category;
    selectedSubcategory = null;
    selectedSub = null;
    
    // Update button states
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-teal-500', 'text-white');
        btn.classList.add('bg-white', 'text-gray-700');
    });
    
    event.target.classList.remove('bg-white', 'text-gray-700');
    event.target.classList.add('active', 'bg-teal-500', 'text-white');
    
    const subSection = document.getElementById('subcategorySection');
    const subSubSection = document.getElementById('subSection');
    
    if (category === null) {
        // Featured view - hide subcategories
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
        btn.className = 'subcategory-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700 hover:bg-teal-500 hover:text-white border border-gray-200 transition';
        btn.textContent = `${sub} (${count})`;
        btn.onclick = () => selectSubcategory(sub);
        
        container.appendChild(btn);
    });
}

function selectSubcategory(subcategory) {
    selectedSubcategory = subcategory;
    selectedSub = null;
    
    document.querySelectorAll('.subcategory-btn').forEach(btn => {
        btn.classList.remove('bg-teal-500', 'text-white');
        btn.classList.add('bg-white', 'text-gray-700');
    });
    
    event.target.classList.remove('bg-white', 'text-gray-700');
    event.target.classList.add('bg-teal-500', 'text-white');
    
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
        btn.className = 'sub-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700 hover:bg-purple-500 hover:text-white border border-gray-200 transition';
        btn.textContent = sub;
        btn.onclick = () => selectSub(sub);
        
        container.appendChild(btn);
    });
}

function selectSub(sub) {
    selectedSub = sub;
    
    document.querySelectorAll('.sub-btn').forEach(btn => {
        btn.classList.remove('bg-purple-500', 'text-white');
        btn.classList.add('bg-white', 'text-gray-700');
    });
    
    event.target.classList.remove('bg-white', 'text-gray-700');
    event.target.classList.add('bg-purple-500', 'text-white');
    
    filterVideos();
}

// ============================================
// FILTERING
// ============================================

function filterVideos() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    
    filteredVideos = allVideos.filter(video => {
        // Featured filter: only show featured videos when Featured is selected
        if (selectedCategory === null && !video.featured) return false;
        
        // Category filter
        if (selectedCategory !== null && video.category !== selectedCategory) return false;
        
        // Subcategory filter
        if (selectedSubcategory && video.subcategory !== selectedSubcategory) return false;
        
        // Sub filter
        if (selectedSub && video.sub !== selectedSub) return false;
        
        // Format filter
        if (selectedFormat !== 'all' && video.format !== selectedFormat) return false;
        
        // Search filter
        if (searchTerm) {
            const searchableText = `${video.title} ${video.description} ${video.tags} ${video.category} ${video.subcategory} ${video.sub}`.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
    
    // Reset display
    currentLoadIndex = 0;
    displayedVideos = [];
    document.getElementById('video-grid').innerHTML = '';
    
    // Load first batch
    loadMore();
    
    // Update result count
    document.getElementById('resultCount').textContent = `${filteredVideos.length} videos`;
    
    // Update status text
    const statusEl = document.getElementById('status-text');
    if (filteredVideos.length === 0) {
        statusEl.innerHTML = '<span style="color: #9CA3AF;">No videos match your filters</span>';
    } else {
        statusEl.innerHTML = `<span class="inline-block w-2 h-2 bg-teal-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} videos loaded`;
    }
}

function filterByFormat(format) {
    selectedFormat = format;
    
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-teal-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    event.target.classList.remove('bg-gray-100', 'text-gray-700');
    event.target.classList.add('active', 'bg-teal-500', 'text-white');
    
    filterVideos();
}

// ============================================
// LOAD MORE (PAGINATION)
// ============================================

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
    
    // Show/hide load more button
    if (currentLoadIndex < filteredVideos.length) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
    
    // Update status
    document.getElementById('status-text').innerHTML = 
        `<span class="inline-block w-2 h-2 bg-teal-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} videos loaded`;
}

// ============================================
// VIDEO CARD CREATION
// ============================================

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl rounded-xl overflow-hidden bg-white border border-gray-200';
    card.onclick = () => openModal(video);
    
    const formatBadge = {
        '9:16': '📱 9:16',
        '1:1': '⬜ 1:1',
        '16:9': '🖥️ 16:9'
    }[video.format] || video.format;
    
    const featuredBadge = video.featured 
        ? '<span class="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-md text-xs font-bold shadow-lg">⭐ FEATURED</span>' 
        : '';
    
    card.innerHTML = `
        <div class="relative overflow-hidden aspect-video bg-gray-900">
            ${featuredBadge}
            <span class="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium">${formatBadge}</span>
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300" loading="lazy">
            <video src="${video.preview}" class="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" muted loop playsinline onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>
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

// Make functions global
window.init = init;
window.filterVideos = filterVideos;
window.filterByFormat = filterByFormat;
window.loadMore = loadMore;
