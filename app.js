/** 
 * PolyEdge — Polymarket Analytics Terminal (v2.9 FULL STABLE REVERT)
 * Restore the original featured dashboard with profit simulator & alerts.
 */

const API_BASE = 'https://gamma-api.polymarket.com';

const CORS_PROXIES = [
    url => url, // 1. Direct
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
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
    console.log('PolyEdge: Initializing terminal...');
    
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
    safeInit('Watchlist', () => {});
    safeInit('Kelly', initKelly);
    
    // Refresh loop
    startAutoRefresh();
    
    // Initial Load
    loadMarkets();
});

// ========== THEME TOGGLE ==========
function initThemeToggle() {
    const saved = localStorage.getItem('polyedge-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    
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

// ========== API & DATA ==========
async function fetchWithProxy(url) {
    for (const pFn of CORS_PROXIES) {
        try {
            const pUrl = pFn(url);
            const res = await fetch(pUrl);
            if (!res.ok) continue;
            let data = await res.json();
            if (data.contents) data = JSON.parse(data.contents);
            if (data && (Array.isArray(data) || data.markets)) {
                 console.log(`PolyEdge: Data fetched via ${pUrl.split('?')[0]}`);
                 return data;
            }
        } catch (e) {}
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
    }
    
    isLoading = false;

    // Direct event assignment for stable v2 (Old Site Style)
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn && !loadBtn.hasListener) {
        loadBtn.onclick = () => renderMarkets();
        loadBtn.hasListener = true;
    }
    
    const searchInp = document.getElementById('search-input');
    if (searchInp) searchInp.oninput = () => { displayedCount = 0; renderMarkets(); };
    
    const sortSel = document.getElementById('sort-filter');
    if (sortSel) sortSel.onchange = () => { displayedCount = 0; renderMarkets(); };
    
    const catSel = document.getElementById('category-filter');
    if (catSel) catSel.onchange = () => { displayedCount = 0; renderMarkets(); };

    const volSel = document.getElementById('volume-filter');
    if (volSel) volSel.onchange = () => { displayedCount = 0; renderMarkets(); };
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
    const elMarkets = document.getElementById('stat-total-markets');
    const elVolume = document.getElementById('stat-total-volume');
    const elOpps = document.getElementById('stat-opportunities');
    const elMaxRoi = document.getElementById('stat-max-potential');

    if (elMarkets) elMarkets.textContent = allMarkets.length;
    if (elVolume) {
        const total = allMarkets.reduce((s, m) => s + m.volume24h, 0);
        elVolume.textContent = '$' + formatCompact(total);
    }
    if (elOpps) {
        const ops = allMarkets.filter(m => m.maxRoi > 3 && m.liquidity > 1000).length;
        elOpps.textContent = ops;
    }
    if (elMaxRoi) {
        const rois = allMarkets.map(m => m.maxRoi);
        elMaxRoi.textContent = rois.length ? Math.max(...rois).toFixed(0) + 'x' : '0x';
    }
}

// ========== RENDERER ==========
function getFilteredMarkets() {
    const searchEl = document.getElementById('search-input');
    const search = (searchEl ? searchEl.value || '' : '').toLowerCase();
    const cat = document.getElementById('category-filter')?.value || 'all';
    const vol = Number(document.getElementById('volume-filter')?.value || 0);
    const sort = document.getElementById('sort-filter')?.value || 'volume24hr';

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
    if (!grid) return;

    const filtered = getFilteredMarkets();
    if (displayedCount === 0) grid.innerHTML = '';

    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    batch.forEach((m, idx) => grid.appendChild(createMarketCard(m, displayedCount + idx)));
    
    displayedCount += batch.length;
    
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createMarketCard(m, index) {
    const card = document.createElement('div');
    card.className = 'market-card';
    card.style.animationDelay = `${(index % BATCH_SIZE) * 0.05}s`;
    
    const isWatched = watchlist.includes(m.id);
    const days = m.daysLeft !== null ? m.daysLeft + 'd' : '∞';
    
    card.innerHTML = `
        <div class="mc-star ${isWatched ? 'active' : ''}" data-id="${m.id}">${isWatched ? '★' : '☆'}</div>
        <div class="mc-header">
            <img class="mc-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%231a1e26\\'/></svg>'">
            <div class="mc-title">${escapeHtml(m.question)}</div>
        </div>
        <div class="mc-meta">
            <span>${days} left</span>
            <span>Vol $${formatCompact(m.volume24h)}</span>
            <span class="roi-high">${m.maxRoi.toFixed(1)}x</span>
        </div>
        <div class="mc-sparkline">${generateSparkline(m)}</div>
        <div class="mc-prices">
            <div class="mc-price yes"><div class="mc-price-bar"><span>YES</span><span>${(m.yesPrice*100).toFixed(0)}¢</span></div></div>
            <div class="mc-price no"><div class="mc-price-bar"><span>NO</span><span>${(m.noPrice*100).toFixed(0)}¢</span></div></div>
        </div>
        
        <div class="mc-profit">
            <span class="mc-profit-label">Stake $</span>
            <input type="number" class="mc-profit-input" value="10" min="1">
            <span class="mc-profit-result">→ win $${((10 / m.minPrice) - 10).toFixed(2)}</span>
        </div>
        
        <div class="mc-footer">
            <a class="btn-primary" href="https://polymarket.com/event/${m.eventSlug}" target="_blank">TRADE ON POLYMARKET</a>
        </div>
    `;

    // Watchlist
    card.querySelector('.mc-star').onclick = (e) => {
        e.stopPropagation();
        toggleWatchlist(m.id);
    };

    // Profit Calculator
    const input = card.querySelector('.mc-profit-input');
    const result = card.querySelector('.mc-profit-result');
    input.oninput = (e) => {
        const val = Number(e.target.value) || 0;
        const profit = (val / m.minPrice) - val;
        result.textContent = `→ win $${profit.toFixed(2)}`;
    };
    input.onclick = (e) => e.stopPropagation();

    return card;
}

// ========== HELPERS ==========
function generateSparkline(m) {
    const color = m.yesPrice > 0.5 ? 'var(--blue)' : 'var(--red)';
    // Simplified SVG mock trend
    return `<svg viewBox="0 0 100 20" style="width:100%; height:20px; opacity: 0.6;"><polyline points="0,15 20,10 40,18 60,12 80,14 100,5" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
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
    
    // Refresh icons
    document.querySelectorAll(`.mc-star[data-id="${id}"]`).forEach(btn => {
        const active = watchlist.includes(id);
        btn.classList.toggle('active', active);
        btn.textContent = active ? '★' : '☆';
    });
    
    if (activeTab === 'watchlist') renderWatchlist();
}

function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    if (!grid) return;
    const watched = allMarkets.filter(m => watchlist.includes(m.id));
    grid.innerHTML = '';
    watched.forEach((m, idx) => grid.appendChild(createMarketCard(m, idx)));
    document.getElementById('watchlist-empty').style.display = watched.length ? 'none' : 'flex';
}

function initKelly() {
    const pInput = document.getElementById('kelly-prob');
    const prInput = document.getElementById('kelly-price');
    const res = document.getElementById('kelly-result');
    
    const calc = () => {
        const p = (Number(pInput.value) || 0) / 100;
        const price = (Number(prInput.value) || 0) / 100;
        if (p <= price) { res.textContent = 'NO EDGE'; return; }
        const b = (1 - price) / price;
        const f = (p * b - (1 - p)) / b;
        res.textContent = `SUGGESTED STAKE: ${(f * 100).toFixed(1)}%`;
    };
    
    if (pInput) {
        pInput.oninput = calc;
        prInput.oninput = calc;
    }
}

function startAutoRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) { 
            refreshTimer = 60; 
            loadMarkets(); 
        }
        const el = document.getElementById('refresh-text');
        if (el) el.textContent = refreshTimer + 's';
    }, 1000);
}
