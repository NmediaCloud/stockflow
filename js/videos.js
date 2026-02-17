// ============================================
// videos.js - Video loading, filtering, rendering
// ============================================

let allVideos = [];
let filteredVideos = [];
let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSub = 'all';
let currentFormat = 'all';
let currentVideo = null;
let displayCount = 0;

let categories = new Set();
let subcategories = {};
let subs = {};

// ---- CSV PARSER ----

function parseCSV(text) {
    const lines = text.split('\n');
    const result = [];

    for (let line of lines) {
        if (!line.trim()) continue;
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        result.push(values);
    }
    return result;
}

// ---- INIT / LOAD DATA ----

async function init() {
    const grid = document.getElementById('video-grid');
    const status = document.getElementById('status-text');

    try {
        console.log('🔄 Fetching CSV from:', CONFIG.SHEET_CSV_URL);
        status.innerHTML = `<span class="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-2"></span>Loading footage...`;

        const response = await fetch(CONFIG.SHEET_CSV_URL, {
            method: 'GET',
            cache: 'no-cache'
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - Sheet may not be published. Go to File → Share → Publish to web → CSV`);
        }

        const csvText = await response.text();
        console.log('📄 CSV preview:', csvText.substring(0, 200));

        if (!csvText || csvText.trim().length === 0) {
            throw new Error('Sheet returned empty data. Make sure your sheet is published and has data.');
        }

        if (csvText.trim().startsWith('<')) {
            throw new Error('Sheet returned HTML instead of CSV. Re-publish: File → Share → Publish to web → select sheet tab → CSV → Publish');
        }

        const rows = parseCSV(csvText);
        console.log('✅ Rows received:', rows.length - 1);

        allVideos = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2 || !row[1]) continue;

            const video = {
                id:          row[0]  || i.toString(),
                title:       row[1]  || 'Untitled',
                category:    row[2]  || 'Uncategorized',
                subcategory: row[3]  || '',
                sub:         row[4]  || '',
                description: row[5]  || '',
                thumb:       row[6]  || '',
                preview:     row[7]  || '',
                price:       row[8]  || '25',
                format:      row[9]  || '16:9',
                resolution:  row[10] || '4K',
                tags:        row[11] || ''
            };

            if (video.category) {
                categories.add(video.category);
                if (video.subcategory) {
                    if (!subcategories[video.category]) subcategories[video.category] = new Set();
                    subcategories[video.category].add(video.subcategory);
                    if (video.sub) {
                        const subKey = `${video.category}::${video.subcategory}`;
                        if (!subs[subKey]) subs[subKey] = new Set();
                        subs[subKey].add(video.sub);
                    }
                }
            }
            allVideos.push(video);
        }

        allVideos.reverse(); // Latest first
        generateCategoryButtons();
        filteredVideos = [...allVideos];
        displayCount = 0;
        renderVideos(true);

        status.innerHTML = `<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>${allVideos.length} videos loaded`;

    } catch (error) {
        console.error('❌ Init error:', error);
        status.innerHTML = `<span class="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>Failed to load footage`;

        grid.innerHTML = `
            <div class="col-span-full bg-red-50 border border-red-200 rounded-xl p-8 text-center" style="max-width:700px;margin:0 auto;">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <h3 class="text-red-800 font-bold text-xl mb-3">Videos Cannot Load</h3>
                <p style="background:#fff;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-word;color:#dc2626;margin-bottom:12px;">${error.message}</p>
                <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:16px;text-align:left;">
                    <p style="color:#92400e;font-weight:bold;margin-bottom:8px;">🔧 Fix: Re-publish your Google Sheet</p>
                    <ol style="color:#78350f;font-size:13px;padding-left:20px;line-height:2;">
                        <li>Open your <strong>video data Google Sheet</strong></li>
                        <li>Click <strong>File → Share → Publish to web</strong></li>
                        <li>Select your <strong>video tab</strong> + <strong>CSV format</strong></li>
                        <li>Click <strong>Publish</strong></li>
                        <li>Update <strong>SHEET_ID</strong> in <code>js/config.js</code></li>
                    </ol>
                </div>
            </div>
        `;
    }
}

// ---- RENDER ----

function renderVideos(reset = false) {
    const grid = document.getElementById('video-grid');
    const loadMoreSection = document.getElementById('loadMoreSection');

    if (reset) {
        grid.innerHTML = '';
        displayCount = 0;
    }

    if (filteredVideos.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16">
                <p class="text-gray-400 text-lg">No videos match your filters</p>
                <button onclick="resetFilters()" class="mt-4 text-teal-600 hover:text-teal-700 font-medium">Reset Filters</button>
            </div>
        `;
        loadMoreSection.classList.add('hidden');
        return;
    }

    const endIndex = Math.min(displayCount + CONFIG.ITEMS_PER_LOAD, filteredVideos.length);
    const videosToShow = filteredVideos.slice(displayCount, endIndex);

    videosToShow.forEach((video) => {
        const card = document.createElement('div');
        card.className = 'video-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group';
        card.innerHTML = `
            <div class="relative thumbnail-container">
                <img src="${video.thumb}"
                     class="transition-transform duration-500"
                     alt="${video.title}"
                     loading="lazy"
                     onerror="this.src='https://placehold.co/600x400/14B8A6/FFFFFF?text=${encodeURIComponent(video.title)}'">
                <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="bg-white/95 p-4 rounded-full shadow-xl">
                        <svg class="w-8 h-8 text-teal-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                        </svg>
                    </div>
                </div>
                <div class="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-semibold rounded">${video.format}</div>
            </div>
            <div class="p-4">
                <h4 class="font-bold text-gray-800 text-base mb-2 line-clamp-1">${video.title}</h4>
                <div class="flex justify-between items-center">
                    <div class="flex flex-col">
                        <span class="text-xs text-teal-600 font-semibold uppercase tracking-wide">${video.category}</span>
                        ${video.subcategory ? `<span class="text-[10px] text-gray-500">${video.subcategory}</span>` : ''}
                    </div>
                    <span class="font-bold text-gray-900 text-lg">$${video.price}</span>
                </div>
            </div>
        `;
        card.onclick = () => openModal(video);
        grid.appendChild(card);
    });

    displayCount = endIndex;
    loadMoreSection.classList.toggle('hidden', displayCount >= filteredVideos.length);
}

function loadMore() { renderVideos(false); }

// ---- FILTERS ----

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredVideos = allVideos.filter(video => {
        const matchesCategory    = currentCategory    === 'all' || video.category    === currentCategory;
        const matchesSubcategory = currentSubcategory === 'all' || video.subcategory === currentSubcategory;
        const matchesSub         = currentSub         === 'all' || video.sub         === currentSub;
        const matchesFormat      = currentFormat      === 'all' || video.format      === currentFormat;
        const matchesSearch      = !searchTerm ||
            video.title.toLowerCase().includes(searchTerm) ||
            video.category.toLowerCase().includes(searchTerm) ||
            video.subcategory.toLowerCase().includes(searchTerm) ||
            video.description.toLowerCase().includes(searchTerm) ||
            video.tags.toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSubcategory && matchesSub && matchesFormat && matchesSearch;
    });

    const resultCount = document.getElementById('resultCount');
    if (resultCount) resultCount.textContent = `${filteredVideos.length} video${filteredVideos.length !== 1 ? 's' : ''} found`;

    renderVideos(true);
}

function filterVideos() { applyFilters(); }

function filterByFormat(format) {
    currentFormat = format;
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-format') === format);
    });
    applyFilters();
}

function filterByCategory(category) {
    currentCategory = category;
    currentSubcategory = 'all';
    currentSub = 'all';

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });

    const subcatSection = document.getElementById('subcategorySection');
    const subSection = document.getElementById('subSection');
    subSection.classList.add('hidden');

    if (category !== 'all' && subcategories[category]?.size > 0) {
        subcatSection.classList.remove('hidden');
        document.getElementById('subcategoryTitle').textContent = `${category} Subcategories`;
        const subcatButtons = document.getElementById('subcategoryButtons');
        subcatButtons.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'subcategory-btn active px-4 py-2 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-teal-600 hover:text-white transition border border-teal-300';
        allBtn.textContent = `All ${category}`;
        allBtn.onclick = () => filterBySubcategory('all', allBtn);
        subcatButtons.appendChild(allBtn);

        Array.from(subcategories[category]).sort().forEach(subcat => {
            const btn = document.createElement('button');
            btn.className = 'subcategory-btn px-4 py-2 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-teal-600 hover:text-white transition border border-teal-200';
            btn.textContent = subcat;
            btn.onclick = () => filterBySubcategory(subcat, btn);
            subcatButtons.appendChild(btn);
        });
    } else {
        subcatSection.classList.add('hidden');
    }

    applyFilters();
}

function filterBySubcategory(subcategory, btn) {
    currentSubcategory = subcategory;
    currentSub = 'all';

    document.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const subSection = document.getElementById('subSection');
    const subKey = `${currentCategory}::${subcategory}`;

    if (subcategory !== 'all' && subs[subKey]?.size > 0) {
        subSection.classList.remove('hidden');
        document.getElementById('subTitle').textContent = `${subcategory} Types`;
        const subButtons = document.getElementById('subButtons');
        subButtons.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'sub-btn active px-4 py-2 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-purple-600 hover:text-white transition border border-purple-300';
        allBtn.textContent = 'All Types';
        allBtn.onclick = () => filterBySub('all', allBtn);
        subButtons.appendChild(allBtn);

        Array.from(subs[subKey]).sort().forEach(sub => {
            const btn = document.createElement('button');
            btn.className = 'sub-btn px-4 py-2 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-purple-600 hover:text-white transition border border-purple-200';
            btn.textContent = sub;
            btn.onclick = () => filterBySub(sub, btn);
            subButtons.appendChild(btn);
        });
    } else {
        subSection.classList.add('hidden');
    }

    applyFilters();
}

function filterBySub(sub, btn) {
    currentSub = sub;
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyFilters();
}

function resetFilters() {
    currentCategory = 'all';
    currentSubcategory = 'all';
    currentSub = 'all';
    currentFormat = 'all';
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === 'all');
    });
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-format') === 'all');
    });
    document.getElementById('subcategorySection').classList.add('hidden');
    document.getElementById('subSection').classList.add('hidden');
    applyFilters();
}

// ---- CATEGORY BUTTONS ----

function generateCategoryButtons() {
    const container = document.getElementById('categoryButtons');
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'category-btn active px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-teal-500 hover:text-white transition shadow-sm';
    allBtn.setAttribute('data-category', 'all');
    allBtn.innerHTML = `<div class="flex items-center gap-2"><span>🆕 New Arrivals</span></div>`;
    allBtn.onclick = () => filterByCategory('all');
    container.appendChild(allBtn);

    Array.from(categories).sort().forEach(cat => {
        const btn = document.createElement('button');
        const subcatCount = subcategories[cat] ? subcategories[cat].size : 0;
        btn.className = 'category-btn px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-teal-500 hover:text-white transition shadow-sm';
        btn.setAttribute('data-category', cat);
        btn.innerHTML = `<div class="flex items-center gap-2"><span>${cat}</span>${subcatCount > 0 ? `<span class="text-xs opacity-60">(${subcatCount})</span>` : ''}</div>`;
        btn.onclick = () => filterByCategory(cat);
        container.appendChild(btn);
    });
}
