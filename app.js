// ========== PolyEdge — Polymarket Analytics Dashboard (v2.8 Stable) ==========

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
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');
let alerts = JSON.parse(localStorage.getItem('polyedge-alerts') || '{}');

// ========== INIT ==========
window.addEventListener('DOMContentLoaded', () => {
    const safeInit = (name, fn) => {
        try {
            fn();
            console.log(`PolyEdge: [${name}] initialized`);
        } catch (e) {
            console.error(`PolyEdge: [${name}] failed`, e);
        }
    };

    safeInit('Theme', initThemeToggle);
    safeInit('Tabs', initTabs);
    safeInit('Clocks', initWorldClocks);
    safeInit('Watchlist', initWatchlist);
    safeInit('Scanner', initScannerControls);
    safeInit('Kelly', initKellyCalculator);

    loadMarkets();
    startAutoRefresh();
});

// ========== THEME TOGGLE ==========
function initThemeToggle() {
    const saved = localStorage.getItem('polyedge-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    
    document.getElementById('theme-toggle').onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('polyedge-theme', newTheme);
        updateThemeIcons();
    };
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelector('.icon-sun').style.display = isDark ? 'block' : 'none';
    document.querySelector('.icon-moon').style.display = isDark ? 'none' : 'block';
}

// ========== TABS ==========
function initTabs() {
    const switchTab = (target) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const tabEl = document.getElementById(`tab-${target}`);
        const navEl = document.querySelector(`.nav-item[data-tab="${target}"]`);
        
        if (tabEl) tabEl.classList.add('active');
        if (navEl) navEl.classList.add('active');
        activeTab = target;

        if (target === 'watchlist') renderWatchlist();
        if (target === 'dashboard') { displayedCount = 0; renderMarkets(); }
    };

    document.querySelectorAll('.nav-item').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ========== WORLD CLOCKS ==========
function initWorldClocks() {
    const update = () => {
        const now = new Date();
        const cfg = { hour: '2-digit', minute: '2-digit', hour12: false };
        document.getElementById('clock-nyc').textContent = new Intl.DateTimeFormat('en-US', { ...cfg, timeZone: 'America/New_York' }).format(now);
        document.getElementById('clock-ldn').textContent = new Intl.DateTimeFormat('en-GB', { ...cfg, timeZone: 'Europe/London' }).format(now);
        document.getElementById('clock-tko').textContent = new Intl.DateTimeFormat('ja-JP', { ...cfg, timeZone: 'Asia/Tokyo' }).format(now);
    };
    update();
    setInterval(update, 10000);
}

// ========== API & DATA ==========
async function fetchWithProxy(url) {
    for (const pFn of CORS_PROXIES) {
        try {
            const pUrl = pFn(url);
            const res = await fetch(pUrl);
            if (!res.ok) continue;
            let data = await res.json();
            if (data.contents) data = JSON.parse(data.contents);
            if (data && (Array.isArray(data) || data.markets)) return data;
        } catch (e) {}
    }
    return null;
}

async function loadMarkets() {
    isLoading = true;
    const url = `${API_BASE}/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false`;
    const data = await fetchWithProxy(url);
    if (data) {
        allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
        updateStats();
        displayedCount = 0;
        renderMarkets();
    }
    isLoading = false;

    // Controls
    document.getElementById('load-more-btn').onclick = () => renderMarkets();
    document.getElementById('search-input').oninput = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('sort-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('category-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('volume-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
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

        const q = (m.question || '').toLowerCase();
        let cat = 'other';
        if (/president|election|trump|biden|politics/.test(q)) cat = 'politics';
        else if (/bitcoin|ethereum|crypto|btc|eth/.test(q)) cat = 'crypto';
        else if (/nfl|nba|world cup|premier|sports/.test(q)) cat = 'sports';
        else if (/gdp|inflation|economy|s&p|nasdaq/.test(q)) cat = 'economics';

        return {
            id: m.id || m.clobTokenId || Math.random(),
            question: m.question || 'Unknown Market',
            image: m.image || '',
            category: cat,
            yesPrice,
            noPrice,
            volumeTotal: Number(m.volumeTotal) || 0,
            volume24h: Number(m.volume24h) || 0,
            liquidity: Number(m.liquidity) || 0,
            daysLeft,
            maxRoi,
            minPrice,
            eventSlug: m.slug || '',
            outcomes
        };
    });
}

function updateStats() {
    document.getElementById('stat-total-markets').textContent = allMarkets.length;
    const total = allMarkets.reduce((s, m) => s + m.volume24h, 0);
    document.getElementById('stat-total-volume').textContent = '$' + formatCompact(total);
    document.getElementById('stat-opportunities').textContent = allMarkets.filter(m => m.maxRoi > 3).length;
    const rois = allMarkets.map(m => m.maxRoi);
    document.getElementById('stat-max-potential').textContent = rois.length ? Math.max(...rois).toFixed(0) + 'x' : '0x';
}

// ========== RENDERER ==========
function getFilteredMarkets() {
    const search = (document.getElementById('search-input').value || '').toLowerCase();
    const cat = document.getElementById('category-filter').value;
    const vol = Number(document.getElementById('volume-filter').value);
    const sort = document.getElementById('sort-filter').value;

    let filtered = cat === 'all' ? [...allMarkets] : allMarkets.filter(m => m.category === cat);
    if (vol > 0) filtered = filtered.filter(m => m.volumeTotal >= vol);
    if (search) filtered = filtered.filter(m => m.question.toLowerCase().includes(search));

    switch (sort) {
        case 'volume24hr': filtered.sort((a,b) => b.volume24h - a.volume24h); break;
        case 'liquidity': filtered.sort((a,b) => b.liquidity - a.liquidity); break;
        case 'potential': filtered.sort((a,b) => b.maxRoi - a.maxRoi); break;
        case 'ending': filtered.sort((a,b) => (a.daysLeft || 999) - (b.daysLeft || 999)); break;
    }
    return filtered;
}

function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    const filtered = getFilteredMarkets();
    if (displayedCount === 0) grid.innerHTML = '';

    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    batch.forEach(m => grid.appendChild(createMarketCard(m)));
    displayedCount += batch.length;
    document.getElementById('load-more-btn').style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createMarketCard(m) {
    const card = document.createElement('div');
    card.className = 'market-card';
    const isWatched = watchlist.includes(m.id);
    const days = m.daysLeft !== null ? m.daysLeft + 'd' : '∞';
    
    card.innerHTML = `
        <div class="mc-star ${isWatched ? 'active' : ''}" onclick="toggleWatchlist('${m.id}')">${isWatched ? '★' : '☆'}</div>
        <div class="mc-header">
            <img class="mc-img" src="${m.image}" onerror="this.style.display='none'">
            <div class="mc-title">${escapeHtml(m.question)}</div>
        </div>
        <div class="mc-meta">
            <span>${days}</span>
            <span>Vol ${formatCompact(m.volume24h)}</span>
            <span>Liq ${formatCompact(m.liquidity)}</span>
        </div>
        <div class="mc-sparkline">${generateSparkline(m)}</div>
        <div class="mc-prices">
            <div class="mc-price yes"><div class="mc-price-bar">${(m.yesPrice*100).toFixed(0)}¢</div></div>
            <div class="mc-price no"><div class="mc-price-bar">${(m.noPrice*100).toFixed(0)}¢</div></div>
        </div>
        <div class="mc-footer">
            <span class="mc-roi">${m.maxRoi.toFixed(1)}x</span>
            <a class="btn-primary" href="https://polymarket.com/event/${m.eventSlug}" target="_blank" style="padding: 4px 12px; font-size: 0.7rem;">Trade</a>
        </div>
    `;
    return card;
}

// ========== HELPERS ==========
function generateSparkline(m) {
    const color = m.yesPrice > 0.5 ? '#10b981' : '#ef4444';
    return `<svg viewBox="0 0 100 20" style="width:100%; height:20px;"><polyline points="0,15 20,10 40,18 60,12 80,14 100,5" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}

function formatCompact(num) {
    if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num/1000).toFixed(1) + 'k';
    return num.toFixed(0);
}

function safeJsonParse(v, fb) { try { return (typeof v === 'string') ? JSON.parse(v) : v; } catch(e) { return fb; } }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function toggleWatchlist(id) {
    const idx = watchlist.indexOf(id);
    if (idx === -1) watchlist.push(id); else watchlist.splice(idx, 1);
    localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
    if (activeTab === 'watchlist') renderWatchlist();
    else renderMarkets(); // Update icons
}

function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    const watched = allMarkets.filter(m => watchlist.includes(m.id));
    grid.innerHTML = '';
    watched.forEach(m => grid.appendChild(createMarketCard(m)));
    document.getElementById('watchlist-empty').style.display = watched.length ? 'none' : 'flex';
}

function startAutoRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) { refreshTimer = 60; loadMarkets(); }
        document.getElementById('refresh-text').textContent = refreshTimer + 's';
    }, 1000);
}

// Placeholder scanner/kelly
function initScannerControls() {}
function initKellyCalculator() {}
