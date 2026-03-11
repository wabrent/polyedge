// ========== PolyEdge — Polymarket Analytics Dashboard (v3.1) ==========

const API_BASE = 'https://gamma-api.polymarket.com';

// Improved CORS Proxy logic with working fallbacks
const CORS_PROXIES = [
    url => url, // 1. Direct
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` 
];

// ========== STATE ==========
let allMarkets = [];
let activeTab = 'dashboard';
let displayedCount = 0;
const BATCH_SIZE = 12;
let isLoading = false;
let refreshTimer = 60;
let refreshInterval = null;
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');
let alerts = JSON.parse(localStorage.getItem('polyedge-alerts') || '{}');

// Shard Settings
let shardSort = 'volume24hr';
let shardCategory = 'all';
let shardFilter = 'all';

// ========== INIT ==========
window.addEventListener('DOMContentLoaded', () => {
    console.log('PolyEdge: Environment check...');
    
    // Core initialization sequence
    const safeInit = (name, fn) => {
        try {
            fn();
            console.log(`PolyEdge: [${name}] initialized`);
        } catch (e) {
            console.error(`PolyEdge: [${name}] failed to init`, e);
        }
    };

    safeInit('Theme', initThemeToggle);
    safeInit('Tabs', initTabs);
    safeInit('Clocks', initWorldClocks);
    safeInit('Watchlist', initWatchlist);
    safeInit('Scanner', initScannerControls);
    safeInit('Kelly', initKellyCalculator);
    safeInit('ShardUI', initShardUI);

    // Refresh on Logo Click
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/'; 
        });
    }

    console.log('PolyEdge: Starting initial load...');
    loadMarkets();
    startAutoRefresh();
});

// ========== THEME TOGGLE ==========
function initThemeToggle() {
    const saved = localStorage.getItem('polyedge-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    
    const btns = document.querySelectorAll('.theme-toggle');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('polyedge-theme', newTheme);
            updateThemeIcons();
        });
    });
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.icon-sun').forEach(i => i.style.display = isDark ? 'block' : 'none');
    document.querySelectorAll('.icon-moon').forEach(i => i.style.display = isDark ? 'none' : 'block');
}

// ========== TABS ==========
function initTabs() {
    const switchTab = (target, updateState = true) => {
        if (!target) return;
        
        // UI reset
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const tabEl = document.getElementById(`tab-${target}`);
        const navEl = document.querySelector(`.nav-item[data-tab="${target}"]`);
        
        if (tabEl) tabEl.classList.add('active');
        if (navEl) navEl.classList.add('active');

        activeTab = target; 
        
        if (updateState) {
            const path = target === 'dashboard' ? '/' : `/${target}`;
            window.history.pushState({ tab: target }, '', path);
        }
        
        // Refresh views on switch
        if (target === 'watchlist') renderWatchlist();
        if (target === 'dashboard') {
             displayedCount = 0;
             renderMarkets();
        }
    };

    document.querySelectorAll('.nav-item').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Handle initial routing
    const path = window.location.pathname.replace('/', '') || 'dashboard';
    const valid = ['dashboard', 'watchlist', 'scanner', 'arbitrage', 'kelly'];
    if (valid.includes(path)) switchTab(path, false);

    window.addEventListener('popstate', (e) => {
        const tab = (e.state && e.state.tab) || 'dashboard';
        switchTab(tab, false);
    });
}

// ========== SHARD UI ==========
function initShardUI() {
    // Sort Buttons
    document.querySelectorAll('.shard-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            document.querySelectorAll('.shard-btn').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            shardSort = el.dataset.sort;
            displayedCount = 0;
            renderMarkets();
        });
    });

    // Preset Buttons
    document.querySelectorAll('.shard-list-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            document.querySelectorAll('.shard-list-btn').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            shardFilter = el.dataset.filter;
            displayedCount = 0;
            renderMarkets();
        });
    });

    // Category Buttons
    document.querySelectorAll('.shard-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            document.querySelectorAll('.shard-cat').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            shardCategory = el.dataset.cat;
            displayedCount = 0;
            renderMarkets();
        });
    });

    // Search input
    const searchInp = document.getElementById('search-input');
    if (searchInp) {
        searchInp.addEventListener('input', () => {
            displayedCount = 0;
            renderMarkets();
        });
    }
}

// ========== WORLD CLOCKS ==========
function initWorldClocks() {
    const update = () => {
        const now = new Date();
        const cfg = { hour: '2-digit', minute: '2-digit', hour12: false };
        
        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        const tko = document.getElementById('clock-tko');
        
        if(nyc) nyc.textContent = new Intl.DateTimeFormat('en-US', { ...cfg, timeZone: 'America/New_York' }).format(now);
        if(ldn) ldn.textContent = new Intl.DateTimeFormat('en-GB', { ...cfg, timeZone: 'Europe/London' }).format(now);
        if(tko) tko.textContent = new Intl.DateTimeFormat('ja-JP', { ...cfg, timeZone: 'Asia/Tokyo' }).format(now);
    };
    update();
    setInterval(update, 10000);
}

// ========== WATCHLIST & ALERTS ==========
function initWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    if (grid) renderWatchlist();
}

function toggleWatchlist(id) {
    const idx = watchlist.indexOf(id);
    if (idx === -1) watchlist.push(id);
    else watchlist.splice(idx, 1);
    
    localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
    
    // Refresh all instances of star icons
    document.querySelectorAll(`.mc-star[data-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('active', watchlist.includes(id));
        btn.textContent = watchlist.includes(id) ? '★' : '☆';
    });
    
    if (activeTab === 'watchlist') renderWatchlist();
}

function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    const empty = document.getElementById('watchlist-empty');
    if (!grid) return;

    const watched = allMarkets.filter(m => watchlist.includes(m.id));

    if (watched.length === 0) {
        grid.innerHTML = '';
        if (empty) {
            grid.appendChild(empty);
            empty.style.display = 'flex';
        }
        return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';
    watched.forEach(m => grid.appendChild(createMarketCard(m)));
}

// ========== API & DATA ==========
async function fetchWithProxy(url) {
    for (const pFn of CORS_PROXIES) {
        try {
            const pUrl = pFn(url);
            const res = await fetch(pUrl);
            if (!res.ok) continue;
            
            let data = await res.json();
            
            // AllOrigins JSON wrap fallback
            if (data.contents) {
                try { data = JSON.parse(data.contents); }
                catch (e) { continue; }
            }
            
            if (data && (Array.isArray(data) || data.markets)) {
                console.log(`PolyEdge: Loaded via ${pUrl.split('?')[0]}`);
                return data;
            }
        } catch (e) {
            console.warn(`PolyEdge: Proxy failed for ${url}`);
        }
    }
    return null;
}

async function loadMarkets() {
    if (isLoading) return;
    isLoading = true;
    
    const url = `${API_BASE}/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false`;
    const data = await fetchWithProxy(url);
    
    if (data) {
        allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
        updateStats();
        displayedCount = 0;
        renderMarkets();
    } else {
        console.error('PolyEdge: TOTAL FAIL - Could not load market data.');
    }
    
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn && !loadMoreBtn.hasListener) {
        loadMoreBtn.addEventListener('click', () => renderMarkets());
        loadMoreBtn.hasListener = true;
    }
    
    isLoading = false;
}

function processMarkets(raw) {
    return raw.map(m => {
        const outcomes = safeJsonParse(m.outcomes, ['Yes', 'No']);
        const prices = safeJsonParse(m.outcomePrices, ['0.5', '0.5']).map(Number);
        const yesPrice = prices[0] || 0.5;
        const noPrice = prices[1] || 0.5;
        const minPrice = Math.min(yesPrice, noPrice);
        const maxRoi = minPrice > 0 ? (1 / minPrice) : 1;
        const endDate = m.endDate ? new Date(m.endDate) : null;
        const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))) : null;

        // Categorization logic
        const q = (m.question || '').toLowerCase();
        let cat = 'other';
        if (/president|election|trump|biden|congress|senate|politics|governor|war|iran|fed|tariff/.test(q)) cat = 'politics';
        else if (/bitcoin|ethereum|crypto|btc|eth|solana/.test(q)) cat = 'crypto';
        else if (/nfl|nba|world cup|premier league|win the|super bowl|uefa|sports/.test(q)) cat = 'sports';
        else if (/gdp|inflation|economy|recession|s&p|nasdaq/.test(q)) cat = 'economics';

        return {
            id: m.id || m.clobTokenId || Math.random(),
            question: m.question || 'Unknown Title',
            image: m.image || m.icon || '',
            category: cat,
            yesPrice,
            noPrice,
            volumeTotal: Number(m.volumeTotal) || 0,
            volume24h: Number(m.volume24h) || 0,
            liquidity: Number(m.liquidity) || 0,
            daysLeft,
            maxRoi,
            minPrice,
            eventSlug: m.slug || m.eventSlug || '',
            outcomes
        };
    });
}

function updateStats() {
    const elMarkets = document.getElementById('stat-total-markets');
    const elVolume = document.getElementById('stat-total-volume');
    const elOpps = document.getElementById('stat-opportunities');
    const elMaxRoi = document.getElementById('stat-max-potential');

    if (elMarkets) elMarkets.textContent = allMarkets.length;
    if (elVolume) {
        const total = allMarkets.reduce((s, m) => s + m.volume24h, 0);
        elVolume.textContent = `$${formatCompact(total)}`;
    }
    if (elOpps) {
        elOpps.textContent = allMarkets.filter(m => m.maxRoi > 3 && m.liquidity > 10000).length;
    }
    if (elMaxRoi) {
        const rois = allMarkets.map(m => m.maxRoi);
        elMaxRoi.textContent = rois.length ? `${Math.max(...rois).toFixed(0)}x` : '0x';
    }
}

// ========== RENDERER ==========
function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;

    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    
    // Primary Filter
    let filtered = shardCategory === 'all' ? [...allMarkets] : allMarkets.filter(m => m.category === shardCategory);
    
    // Preset Filter
    if (shardFilter === 'high_vol') filtered = filtered.filter(m => m.volumeTotal > 100000);
    else if (shardFilter === 'high_liq') filtered = filtered.filter(m => m.liquidity > 50000);

    // Search
    if (query) filtered = filtered.filter(m => m.question.toLowerCase().includes(query));

    // Sort
    switch (shardSort) {
        case 'volume24hr': filtered.sort((a,b) => b.volume24h - a.volume24h); break;
        case 'volume': filtered.sort((a,b) => b.volumeTotal - a.volumeTotal); break;
        case 'liquidity': filtered.sort((a,b) => b.liquidity - a.liquidity); break;
        case 'spread': filtered.sort((a,b) => Math.abs(a.yesPrice - a.noPrice) - Math.abs(b.yesPrice - b.noPrice)); break;
        case 'ending': filtered.sort((a,b) => (a.daysLeft || 999) - (b.daysLeft || 999)); break;
        case 'potential': filtered.sort((a,b) => b.maxRoi - a.maxRoi); break;
    }

    if (displayedCount === 0) grid.innerHTML = '';

    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    
    if (batch.length === 0 && displayedCount === 0) {
        grid.innerHTML = '<div class="empty-state">No matching markets found.</div>';
        const loadBtn = document.getElementById('load-more-btn');
        if(loadBtn) loadBtn.style.display = 'none';
        return;
    }

    batch.forEach(m => grid.appendChild(createMarketCard(m)));
    displayedCount += batch.length;

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createMarketCard(m) {
    const card = document.createElement('div');
    card.className = 'shard-card';
    
    const isWatched = watchlist.includes(m.id);
    const outcomesHtml = [
        { name: 'Yes', price: m.yesPrice, color: 'blue' },
        { name: 'No', price: m.noPrice, color: 'red' }
    ].map(o => {
        const pct = (o.price * 100).toFixed(0);
        return `
            <div class="shard-outcome">
                <div class="shard-outcome-labels">
                    <span class="shard-outcome-name">${o.name}</span>
                    <span class="shard-outcome-pct ${o.color}">${pct}%</span>
                </div>
                <div class="shard-bar-bg">
                    <div class="shard-bar-fill ${o.color}" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="shard-card-header">
            <img class="shard-card-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%231a1e26\\'/></svg>'">
            <div class="shard-card-title">${escapeHtml(m.question)}</div>
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span class="mc-star ${isWatched ? 'active' : ''}" data-id="${m.id}">${isWatched ? '★' : '☆'}</span>
            </div>
        </div>
        <div style="flex:1;">${outcomesHtml}</div>
        <div class="shard-card-footer">
            <div><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${m.daysLeft ?? '∞'}d</div>
            <div>$${formatCompact(m.volumeTotal)}</div>
            <a href="https://polymarket.com/event/${m.eventSlug}" target="_blank" style="color:var(--text); text-decoration:none; font-weight:700;">Open →</a>
        </div>
    `;

    card.querySelector('.mc-star').onclick = (e) => { e.stopPropagation(); toggleWatchlist(m.id); };
    card.onclick = (e) => { if(!e.target.closest('a') && !e.target.closest('.mc-star')) showChartModal(m); };

    return card;
}

// ========== HELPERS ==========
function formatCompact(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toFixed(0);
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function safeJsonParse(val, fallback) {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch (e) { return fallback; }
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function startAutoRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) {
            refreshTimer = 60;
            loadMarkets();
        }
        const timerEl = document.getElementById('refresh-text');
        if (timerEl) timerEl.textContent = `${refreshTimer}s`;
    }, 1000);
}

// ========== PLACEHOLDER MODALS ==========
function showChartModal(m) {
    console.log('PolyEdge: Modal requested for', m.question);
    alert(`Market Details:\n\n${m.question}\nPrice: ${(m.yesPrice*100).toFixed(1)}¢\nVolume: $${formatCompact(m.volumeTotal)}`);
}

function initScannerControls() { /* Scanner placeholder */ }
function initKellyCalculator() { /* Kelly placeholder */ }
function initQuantumMatrix() { /* Quantum placeholder */ }
