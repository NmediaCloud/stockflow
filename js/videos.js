// ============================================
// videos.js - PERFORMANCE OPTIMIZED
// - Uniform 16:9 containers (same height)
// - Original aspect ratios preserved inside (object-contain)
// - NO video previews on hover (images only)
// - Fast loading with optimized thumbnails
// - Collection-level deep linking (?collection=)
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
// --- NEW: TIER 1 DYNAMIC FORMAT TRACKER ---
let currentAssetFormat = 'All';
// Automatically builds the buttons based on your Google Sheet Data
function generateAssetFormatBar() {
    const container = document.getElementById('assetsFormatBar');
    if (!container) return;
    // 1. Extract unique formats, preserving EXACT sheet casing
    const formatsMap = new Map();
    allVideos.forEach(video => {
        if (video.assetFormat && video.assetFormat.trim() !== "") {
            const rawString = video.assetFormat.trim();
            const lowerKey = rawString.toLowerCase();

            // This prevents duplicate buttons (Mp4 vs mp4) but keeps your exact casing
            if (!formatsMap.has(lowerKey)) {
                formatsMap.set(lowerKey, rawString);
            }
        }
    });
    // 2. Convert to array and sort alphabetically
    const sortedFormats = Array.from(formatsMap.values()).sort();
    // 3. Build the HTML string
    let html = `<button onclick="filterByAssetFormat('All')" data-format="All" class="asset-format-btn active border border-orange-500 text-orange-500 bg-black/40 px-4 py-2 rounded transition-colors cursor-pointer">All Assets</button>`;
    // 4. Add the dynamic buttons exactly as they appear in the sheet
    sortedFormats.forEach(fmt => {
        html += `<button onclick="filterByAssetFormat('${fmt}')" data-format="${fmt}" class="asset-format-btn border border-gray-700 text-gray-400 bg-black/40 px-4 py-2 rounded hover:text-white hover:border-gray-500 transition-colors cursor-pointer">${fmt}</button>`;
    });
    // 5. Inject into the page
    container.innerHTML = html;
}
// Handles the click and highlighting
function filterByAssetFormat(format) {
    currentAssetFormat = format;

    document.querySelectorAll('.asset-format-btn').forEach(btn => {
        if (btn.getAttribute('data-format') === format) {
            btn.classList.add('active', 'border-orange-500', 'text-orange-500');
            btn.classList.remove('border-gray-700', 'text-gray-400');
        } else {
            btn.classList.remove('active', 'border-orange-500', 'text-orange-500');
            btn.classList.add('border-gray-700', 'text-gray-400');
        }
    });
    // CRITICAL FIX: Directly call your master rendering function!
    filterVideos();
}
// ===============================
async function init() {
    console.log('🎬 Initializing Stockflow...');

    document.getElementById('status-text').innerHTML =
        '<span class="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse mr-2"></span>Loading content...';

    // INSTANT PAINT: tiny static catalog (few KB) renders category tiles
    // immediately while the full asset data loads in the background.
    try {
        const c = await fetch('data/catalog.json', { cache: 'no-cache' });
        if (c.ok) {
            catalogData = await c.json();
            renderCatalog();
        }
    } catch (e) { /* no catalog yet — grid stays empty until data loads */ }

    try {
        await loadVideosFromSheet();

        allVideos.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return a.id.localeCompare(b.id);
        });

        buildCategoryButtons();
        generateAssetFormatBar();
        // Default view = Catalog (category tiles). Deep links still take over below.
        const urlParams0 = new URLSearchParams(window.location.search);
        const hasDeepLink = urlParams0.get('cat') || urlParams0.get('v') || urlParams0.get('collection') || urlParams0.get('sub');
        if (hasDeepLink) {
            filterVideos();
        } else {
            renderCatalog();
        }
        // --- DEEP LINKING: CATEGORIES, SUBCATEGORIES, COLLECTIONS & VIDEOS ---
        const urlParams = new URLSearchParams(window.location.search);
        const catToOpen = urlParams.get('cat');
        const subToOpen = urlParams.get('sub');
        const collectionToOpen = urlParams.get('collection');
        const videoIdToOpen = urlParams.get('v');

        // 1. Handle Category/Subcategory Deep Links
       if (catToOpen) {
            console.log("🔗 Category Deep Link:", catToOpen);
            selectedCategory = catToOpen;
            if (subToOpen) selectedSubcategory = subToOpen;

            // Re-build buttons to show the correct sub-row
            buildCategoryButtons();

            // Find the category button and click it safely
            const catBtn = Array.from(document.querySelectorAll('.category-btn')).find(b => b.textContent.trim() === catToOpen.trim());
            if (catBtn) {
                selectCategory(catToOpen, { currentTarget: catBtn });
            }

            if (subToOpen) {
                // Find the subcategory button using .trim() to ignore accidental spaces
                const subBtn = Array.from(document.querySelectorAll('.subcategory-btn')).find(b => b.textContent.trim() === subToOpen.trim());

                // Run IMMEDIATELY (no timeout) so the URL and videos don't break.
                // Pass the subBtn if found for the highlight, or null as a safe fallback.
                selectSubcategory(subToOpen, subBtn ? { currentTarget: subBtn } : null);
            }

            // 1b. Handle Collection Deep Links (third level)
            if (collectionToOpen) {
                console.log("🔗 Collection Deep Link:", collectionToOpen);
                const collBtn = Array.from(document.querySelectorAll('.sub-btn')).find(b => b.textContent.trim() === collectionToOpen.trim());
                selectSub(collectionToOpen, collBtn ? { currentTarget: collBtn } : null);
            }
        }
        // 2. Handle Individual Video Deep Links
        if (videoIdToOpen) {
            const targetVideo = allVideos.find(v => v.id == videoIdToOpen);
            if (targetVideo) {
                console.log("🔗 Video Deep Link: Auto-opening", targetVideo.title);
                openModal(targetVideo);   // open instantly on a deep link (no delay)
            }
        }
        const featuredCount = allVideos.filter(v => v.featured).length;
        console.log(`✅ Loaded ${allVideos.length} Assets (${featuredCount} featured)`);

    } catch (error) {
        console.error('❌ Init error:', error);
        document.getElementById('status-text').innerHTML =
            `<span class="text-red-500 flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Error loading Assets. Please refresh the page.</span>`;
        document.getElementById('video-grid').innerHTML = `
            <div class="col-span-full bg-red-50 p-8 rounded-xl">
                <h3 class="text-red-800 font-bold text-xl mb-3">Error Loading Assets</h3>
                <p class="text-red-600 mb-3">${error.message}</p>
                <p class="text-sm text-gray-600">Check browser console (F12) for details.</p>
            </div>
        `;
    }
}
// ---- CATALOG VIEW: instant category tiles (from tiny data/catalog.json) ----
// Painted BEFORE the asset data arrives, so visitors browse immediately.
let catalogData = null;
function buildCatalogFromVideos() {
    const map = new Map();
    allVideos.forEach(v => {
        if (!v.category) return;
        if (!map.has(v.category)) map.set(v.category, { name: v.category, cover: v.thumbnail, count: 0 });
        const c = map.get(v.category);
        c.count++;
        if (v.featured && !c.hasFeaturedCover) { c.cover = v.thumbnail; c.hasFeaturedCover = true; }
    });
    return Array.from(map.values());
}
function renderCatalog() {
    const grid = document.getElementById('video-grid');
    const data = (catalogData && catalogData.length) ? catalogData : buildCatalogFromVideos();
    if (!data || !data.length) return false;
    grid.innerHTML = data.map(c => `
        <div class="group cursor-pointer" onclick="selectCategoryByName('${c.name.replace(/'/g, "\\'")}')">
            <div class="relative rounded-lg overflow-hidden border border-[#3A3F46] bg-[#2A2F36] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-orange-500 group-hover:shadow-xl">
                <div class="relative aspect-[4/3] bg-[#0b0b0b] overflow-hidden">
                    <img src="${c.cover}" alt="${c.name} stock assets" loading="lazy" decoding="async"
                         class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                    <span class="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md">${c.count.toLocaleString()} assets</span>
                </div>
                <div class="p-3">
                    <h3 class="text-[15px] font-bold text-gray-100">${c.name}</h3>
                    <p class="text-[12px] text-orange-500 font-semibold mt-0.5">Browse collection →</p>
                </div>
            </div>
        </div>`).join('');
    const lm = document.getElementById('loadMoreSection');
    if (lm) lm.classList.add('hidden');
    const total = data.reduce((s, c) => s + c.count, 0);
    const rc = document.getElementById('resultCount');
    if (rc) rc.textContent = `${total.toLocaleString()} Assets`;
    const st = document.getElementById('status-text');
    if (st) st.innerHTML = `<span class="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>Catalog — pick a category to explore ${total.toLocaleString()} assets`;
    return true;
}
function selectCategoryByName(name) {
    const btn = Array.from(document.querySelectorAll('.category-btn')).find(b => b.textContent.trim() === name.trim());
    selectCategory(name, btn ? { currentTarget: btn } : null);
}
window.selectCategoryByName = selectCategoryByName;

// Build the category/subcategory/sub indexes from allVideos (used by both load paths)
function indexVideos() {
    categories = new Set();
    subcategories = {};
    subs = {};
    allVideos.forEach(video => {
        if (!video.category) return;
        categories.add(video.category);
        if (!subcategories[video.category]) subcategories[video.category] = new Set();
        if (video.subcategory) subcategories[video.category].add(video.subcategory);
        const catSubKey = `${video.category}|${video.subcategory}`;
        if (!subs[catSubKey]) subs[catSubKey] = new Set();
        if (video.sub) subs[catSubKey].add(video.sub);
    });
}
async function loadVideosFromSheet() {
    allVideos = [];

    // FAST PATH: static snapshot published with the site (same-origin CDN, gzipped,
    // ~5x smaller than the sheet CSV export). cache:'no-cache' revalidates via ETag,
    // so visitors always get fresh data right after a publish, at 304-speed otherwise.
    try {
        const snap = await fetch('data/assets.json', { cache: 'no-cache' });
        if (snap.ok) {
            const data = await snap.json();
            if (Array.isArray(data) && data.length > 0) {
                allVideos = data;
                indexVideos();
                console.log(`⚡ Loaded ${allVideos.length} assets from static snapshot`);
                return;
            }
        }
    } catch (e) {
        console.warn('⚠️ Static snapshot unavailable, falling back to Sheet CSV:', e);
    }

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
            const hrFileName = (row[12] || '').toString().trim();
            const formatMatch = hrFileName.match(/_([^_]+)_\.[a-z0-9]+$/i);
            const technicalExtension = formatMatch ? formatMatch[1] : "";

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
                featured: hasFeaturedColumn ? (row[14] === 'TRUE' || row[14] === 'true' || row[14] === true) : false,
                fileFormat: technicalExtension,
                assetFormat: (row[20] || '').toString().trim()
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
            throw new Error('No valid Assets found in sheet');
        }

        console.log(`✅ Successfully loaded ${allVideos.length} Assets`);

    } catch (error) {
        console.error('❌ Error loading Assets:', error);
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

    const catalogBtn = document.createElement('button');
    catalogBtn.className = 'category-btn active px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm';
    catalogBtn.innerHTML = `<span class="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> Catalog</span>`;
    catalogBtn.onclick = (e) => selectCategory(null, e);
    container.appendChild(catalogBtn);

    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm';
        btn.textContent = cat;
        btn.onclick = (e) => selectCategory(cat, e);

        container.appendChild(btn);
    });
}
function selectCategory(category, e) {
    const newUrl = new URL(window.location.href);
    if (category) {
        newUrl.searchParams.set('cat', category);
        newUrl.searchParams.delete('sub');
        newUrl.searchParams.delete('collection');
    } else {
        newUrl.searchParams.delete('cat');
        newUrl.searchParams.delete('sub');
        newUrl.searchParams.delete('collection');
    }
    window.history.pushState({}, '', newUrl);
    selectedCategory = category;
    selectedSubcategory = null;
    selectedSub = null;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));

    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }

    const subSection = document.getElementById('subcategorySection');
    const subSubSection = document.getElementById('subSection');

    if (category === null) {
        if (subSection) subSection.classList.add('hidden');
        if (subSubSection) subSubSection.classList.add('hidden');
    } else if (subcategories[category] && subcategories[category].size > 0) {
        buildSubcategoryButtons(category);
        if (subSection) subSection.classList.remove('hidden');
    } else {
        if (subSection) subSection.classList.add('hidden');
    }

    if (subSubSection) {
        subSubSection.classList.add('hidden');
    }

    if (category === null) {
        renderCatalog();          // Catalog button -> back to category tiles
    } else {
        filterVideos();
    }
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
        btn.className = 'subcategory-btn px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm';
        btn.textContent = `${sub} (${count})`;
        btn.onclick = (e) => selectSubcategory(sub, e);

        container.appendChild(btn);
    });
}
function selectSubcategory(subcategory, e) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('sub', subcategory);
    newUrl.searchParams.delete('collection');
    window.history.pushState({}, '', newUrl);

    selectedSubcategory = subcategory;
    selectedSub = null;
    document.querySelectorAll('.subcategory-btn').forEach(btn => btn.classList.remove('active'));

    const evt = e || window.event;
    if (evt && (evt.currentTarget || evt.target)) {
        const targetBtn = evt.currentTarget || evt.target;
        targetBtn.classList.add('active');
    }

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
    if (!container) return;

    container.innerHTML = '';

    const sortedSubs = Array.from(subs[catSubKey]).sort();
    sortedSubs.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'sub-btn px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm bg-black/40 text-gray-400 border border-gray-700 hover:text-white';
        btn.textContent = sub;
        btn.onclick = (e) => selectSub(sub, e);
        container.appendChild(btn);
    });
}
function selectSub(sub, e) {
    selectedSub = sub;

    // Update URL with collection parameter for deep linking
    const newUrl = new URL(window.location.href);
    if (sub) {
        newUrl.searchParams.set('collection', sub);
    } else {
        newUrl.searchParams.delete('collection');
    }
    window.history.pushState({}, '', newUrl);

    document.querySelectorAll('.sub-btn').forEach(btn => {
        btn.classList.remove('active');
    });

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
        // No category picked: show featured only — EXCEPT when searching,
        // a search from the Catalog view must cover the whole library.
        if (selectedCategory === null && !searchTerm) {
            const hasFeatured = allVideos.some(v => v.featured);
            if (hasFeatured && !video.featured) return false;
        }

        if (selectedCategory !== null && video.category !== selectedCategory) return false;
        if (selectedSubcategory && video.subcategory !== selectedSubcategory) return false;
        if (selectedSub && video.sub !== selectedSub) return false;
        if (selectedFormat !== 'all' && video.format !== selectedFormat) return false;

        if (currentAssetFormat !== 'All' && (!video.assetFormat || video.assetFormat.toUpperCase() !== currentAssetFormat.toUpperCase())) return false;

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

    document.getElementById('resultCount').textContent = `${filteredVideos.length} Assets`;

    const statusEl = document.getElementById('status-text');
    if (filteredVideos.length === 0) {
        statusEl.innerHTML = `<span class="text-gray-400 flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg> No Assets match your filters</span>`;
    } else {
        // THE FIX: Removed the duplicate } else { that was right here!
        statusEl.innerHTML = `<span class="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} assets loaded`;
    }
}
function filterByFormat(format, e) {
    selectedFormat = format;

    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.remove('active');
    });

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
        `<span class="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>${displayedVideos.length} of ${filteredVideos.length} Assets loaded`;
}
function createVideoCard(video) {
    // Gallery-style card: dark tile, object-cover image, orange accents, quick lazy load.
    // Click still opens the buy/preview modal (storefront behaviour unchanged).
    const card = document.createElement('div');
    card.className = 'group cursor-pointer';
    card.onclick = () => openModal(video);
    const isVideo = (video.fileFormat || '').toLowerCase().includes('mp4') ||
                    (video.type || '').toLowerCase() === 'video';
    const fmtBadge = video.format
        ? `<span class="absolute top-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-[11px] font-medium">${video.format}</span>`
        : '';
    const playBadge = isVideo
        ? `<span class="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-[11px] font-medium">▶ video</span>`
        : '';
    const ext = video.fileFormat
        ? `<span class="ml-1.5 text-[10px] text-gray-500 uppercase">${video.fileFormat}</span>`
        : '';
    card.innerHTML = `
        <div class="relative rounded-lg overflow-hidden border border-[#3A3F46] bg-[#2A2F36] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-orange-500 group-hover:shadow-xl">
            <div class="relative aspect-[4/3] bg-[#0b0b0b] overflow-hidden">
                ${fmtBadge}${playBadge}
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" decoding="async"
                     class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                <span class="absolute top-2 right-2 bg-orange-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow opacity-95 group-hover:opacity-100">License</span>
            </div>
            <div class="p-2.5">
                <h3 class="text-[13px] font-semibold text-gray-100 leading-snug line-clamp-2">${video.title}</h3>
                <div class="flex items-center justify-between mt-1.5">
                    <span class="text-[11.5px] text-gray-400">${video.resolution || ''}${ext}</span>
                    <span class="text-orange-500 font-bold text-sm">$${video.price}</span>
                </div>
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
    window.currentVideo = video;
    if (typeof window.showPreviewModal === 'function') {
        window.showPreviewModal(video);
    } else {
        console.log("Opening modal for:", video.title, "Format:", video.fileFormat);
    }
}
window.openModal = openModal;
// ---- NOTIFICATION SYSTEM ----
function showNotification(message, type = 'success') {
    const toast = document.getElementById('notification');
    const msgEl = document.getElementById('notificationMessage');

    if (!toast || !msgEl) {
        console.log(`Notification (${type}): ${message}`);
        return;
    }
    msgEl.textContent = message;

    if (type === 'error') {
        toast.style.backgroundColor = '#EF4444';
    } else if (type === 'info') {
        toast.style.backgroundColor = '#3B82F6';
    } else {
        toast.style.backgroundColor = '#F97316';
    }
    toast.style.display = 'block';
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.add('hidden');
    }, 4000);
}
window.showNotification = showNotification;
