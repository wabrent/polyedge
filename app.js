// PolyEdge — Polymarket Analytics Terminal (REVERT TO V2.9 - SCREENSHOT MODE)

const API_BASE = 'https://gamma-api.polymarket.com';
const PROXIES = [
    u => u,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

// ========== STATE ==========
let allMarkets = [];
let activeTab = 'dashboard';
let displayedCount = 0;
const BATCH_SIZE = 12;
let isLoading = false;
let refreshTimer = 60;
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');

// ========== INIT ==========
window.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initTheme();
    initClocks();
    initRefresh();
    loadMarkets();
    
    // Global Event Listeners
    document.getElementById('load-more-btn').onclick = () => renderMarkets();
    document.getElementById('search-input').oninput = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('sort-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('category-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
    document.getElementById('volume-filter').onchange = () => { displayedCount = 0; renderMarkets(); };
});

// ========== THEME ==========
function initTheme() {
    const saved = localStorage.getItem('polyedge-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    
    document.getElementById('theme-toggle').onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('polyedge-theme', next);
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
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
             const tab = btn.dataset.tab;
             document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
             document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
             
             document.getElementById(`tab-${tab}`).classList.add('active');
             btn.classList.add('active');
             activeTab = tab;
             if (tab === 'dashboard') { displayedCount = 0; renderMarkets(); }
        }
    });
}

// ========== CLOCKS ==========
function initClocks() {
    const update = () => {
        const now = new Date();
        const cfg = { hour: '2-digit', minute: '2-digit', hour12: false };
        document.getElementById('clock-nyc').textContent = new Intl.DateTimeFormat('en-US', { ...cfg, timeZone: 'America/New_York' }).format(now);
        document.getElementById('clock-ldn').textContent = new Intl.DateTimeFormat('en-GB', { ...cfg, timeZone: 'Europe/London' }).format(now);
        document.getElementById('clock-tko').textContent = new Intl.DateTimeFormat('ja-JP', { ...cfg, timeZone: 'Asia/Tokyo' }).format(now);
    };
    update(); setInterval(update, 10000);
}

// ========== REFRESH TIMER ==========
function initRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) {
            refreshTimer = 60;
            loadMarkets();
        }
        document.getElementById('refresh-text').textContent = `${refreshTimer}s`;
        const offset = 100 - (refreshTimer / 60) * 100;
        document.getElementById('refresh-progress').style.strokeDasharray = `${offset}, 100`;
    }, 1000);
}

// ========== API & DATA ==========
async function fetchWithProxy(url) {
    for (const p of PROXIES) {
        try {
            const res = await fetch(p(url));
            if (!res.ok) continue;
            let j = await res.json();
            if (j.contents) j = JSON.parse(j.contents);
            if (j && (Array.isArray(j) || j.markets)) return j;
        } catch (e) {}
    }
    return null;
}

async function loadMarkets() {
    if (isLoading) return; isLoading = true;
    const url = `${API_BASE}/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false`;
    const data = await fetchWithProxy(url);
    if (data) {
        allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
        updateStats();
        displayedCount = 0;
        renderMarkets();
    }
    isLoading = false;
}

function processMarkets(raw) {
    return raw.map(m => {
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
        else if (/nfl|nba|world cup|sports/.test(q)) cat = 'sports';

        return {
            id: m.id || m.clobTokenId || Math.random(),
            question: m.question || 'Unknown',
            image: m.image || '',
            category: cat,
            yesPrice, noPrice,
            volume24h: Number(m.volume24h) || 0,
            volumeTotal: Number(m.volumeTotal) || 0,
            liquidity: Number(m.liquidity) || 0,
            daysLeft, maxRoi, minPrice,
            eventSlug: m.slug || '',
            change24h: Number(m.priceChange24h) || 0
        };
    });
}

function updateStats() {
    document.getElementById('stat-total-markets').textContent = allMarkets.length;
    const vol = allMarkets.reduce((s, m) => s + m.volume24h, 0);
    document.getElementById('stat-total-volume').textContent = '$' + (vol/1e6).toFixed(1) + 'M';
    document.getElementById('stat-opportunities').textContent = allMarkets.filter(m => m.maxRoi >= 2.5).length;
    const rois = allMarkets.map(m => m.maxRoi);
    document.getElementById('stat-max-potential').textContent = rois.length ? Math.max(...rois).toFixed(0) + 'x' : '1x';
}

// ========== RENDERER ==========
function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    const query = (document.getElementById('search-input').value || '').toLowerCase();
    const cat = document.getElementById('category-filter').value;
    const vol = Number(document.getElementById('volume-filter').value);
    const sort = document.getElementById('sort-filter').value;

    let filtered = cat === 'all' ? [...allMarkets] : allMarkets.filter(m => m.category === cat);
    if (vol > 0) filtered = filtered.filter(m => m.volumeTotal >= vol);
    if (query) filtered = filtered.filter(m => m.question.toLowerCase().includes(query));

    switch (sort) {
        case 'volume24hr': filtered.sort((a,b) => b.volume24h - a.volume24h); break;
        case 'liquidity': filtered.sort((a,b) => b.liquidity - a.liquidity); break;
        case 'potential': filtered.sort((a,b) => b.maxRoi - a.maxRoi); break;
    }

    if (displayedCount === 0) grid.innerHTML = '';
    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    batch.forEach(m => grid.appendChild(createMarketCard(m)));
    displayedCount += batch.length;
    document.getElementById('load-more-btn').style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createMarketCard(m) {
    const card = document.createElement('div');
    card.className = 'market-card';
    
    // Badges
    let badgesHtml = '';
    if (m.volume24h >= 1000000) badgesHtml += '<span class="badge badge-high-vol">📈 High Vol</span>';
    if (m.daysLeft !== null && m.daysLeft <= 3) badgesHtml += '<span class="badge badge-ending">⏰ Ending</span>';
    else if (m.daysLeft !== null && m.daysLeft <= 7) badgesHtml += '<span class="badge badge-soon">Soon</span>';

    card.innerHTML = `
        <div class="mc-badges">${badgesHtml}</div>
        <div class="mc-actions">
             <div class="action-btn">🔔</div>
             <div class="action-btn">⭐</div>
        </div>
        <div class="mc-header">
            <img class="mc-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%23f1f5f9\\'/></svg>'">
            <div class="mc-title">${m.question}</div>
        </div>
        <div class="mc-meta">
            ${m.daysLeft !== null ? `<span>${m.daysLeft}d left</span>` : '<span>∞</span>'}
            <span>Vol $${(m.volumeTotal/1e6).toFixed(1)}M</span>
            <span>Liq $${(m.liquidity/1e6).toFixed(1)}M</span>
        </div>
        <div class="mc-sparkline">
            <svg viewBox="0 0 100 20" style="width:100%; height:100%;">
                <polyline points="0,15 20,12 40,16 60,10 80,12 100,6" fill="none" stroke="var(--green)" stroke-width="2"/>
            </svg>
        </div>
        <div class="mc-prices">
            <div class="mc-price-bar yes">Yes ${(m.yesPrice*100).toFixed(1)}¢</div>
            <div class="mc-price-bar no">No ${(m.noPrice*100).toFixed(1)}¢</div>
        </div>
        <div class="mc-profit">
            <span class="label-grey">Bet $</span>
            <input type="number" class="profit-input" value="10">
            <span class="profit-res">→ win $${((10 / m.minPrice) - 10).toFixed(2)}</span>
        </div>
        <div class="mc-footer-info">
            <span class="roi-val">${m.maxRoi.toFixed(1)}x</span>
            <span class="change-val ${m.change24h >= 0 ? 'up' : 'down'}">${m.change24h >= 0 ? '+' : ''}${(m.change24h*100).toFixed(1)}%</span>
        </div>
        <a class="trade-btn" href="https://polymarket.com/event/${m.eventSlug}" target="_blank">Trade on Polymarket</a>
    `;

    // Internal calculation
    const input = card.querySelector('.profit-input');
    const res = card.querySelector('.profit-res');
    input.oninput = (e) => {
        const val = Number(e.target.value) || 0;
        res.textContent = `→ win $${((val / m.minPrice) - val).toFixed(2)}`;
    };

    return card;
}

// ========== HELPERS ==========
function safeJsonParse(s, d) { try { return (typeof s === 'string') ? JSON.parse(s) : s; } catch(e) { return d; } }
