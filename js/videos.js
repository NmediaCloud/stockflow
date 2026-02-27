Skip to content
NmediaCloud
stockflow
Repository navigation
Code
Issues
Pull requests
Actions
Projects
Wiki
Security
1
 (1)
Insights
Settings
stockflow/js//
/
videos.js
in
main

Edit

Preview
Indent mode

Spaces
Indent size

4
Line wrap mode

No wrap
Editing videos.js file contents
Find
nextpreviousallmatch caseregexpby word
Replace
replacereplace all×
Selection deleted
463
464
465
466
467
468
469
470
471
472
473
474
475
476
477
478
479
480
481
482
483
484
485
486
487
488
489
490
491
492
493
494
495
496
497
498
499
500
501
502
503
504
505
506
507
508
509
510
511
512
513
514
515
516
517
518
519
520
521
522
523
524
525
526
527
528
529
530
531
532
533
534
535
536
537
538
539
540
541
542
543
544
545
546
547
548
549
550
551
552
553
554
555
556
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
        
        // --- STEP 4: INSERTED HERE (The Asset Format Gate) ---
        // --- STEP 4: INSERTED HERE (The Asset Format Gate) ---
        
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
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
 
