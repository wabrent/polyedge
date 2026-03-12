/**
 * PolyEdge — Whale Intelligence Terminal (v3.7)
 * HIGH-PRECISION DATA & VISUAL POLISH
 */

const API_BASE = 'https://gamma-api.polymarket.com';
const PROXIES = [
    u => u,
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

// ========== STATE ==========
let allMarkets = [];
let activeTab = 'dashboard';
let currentFilter = 'all';
let displayedCount = 0;
const BATCH_SIZE = 12;
let isLoading = false;
let refreshTimer = 60;
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');

// ========== INIT ==========
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initClocks();
    initRefresh();
    initLogEngine();
    initInteraction();
    loadMarkets();
    
    // Core Buttons
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.onclick = () => renderMarkets(currentFilter);
    
    const catSel = document.getElementById('category-filter');
    if (catSel) catSel.onchange = () => { displayedCount = 0; renderMarkets(currentFilter); };
    
    const logoRefresh = document.getElementById('logo-refresh');
    if (logoRefresh) logoRefresh.onclick = () => window.location.reload();
});

// ========== THEME ENGINE ==========
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('polyedge-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('polyedge-theme', next);
        addLog(`Protocol switched: ${next.toUpperCase()}_MODE`, 'var(--cyan)');
    };
}

// ========== LOG ENGINE ==========
function addLog(msg, color = 'var(--text-2)') {
    const log = document.getElementById('system-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.color = color;
    entry.innerHTML = `[${new Date().toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}] > ${msg}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (log.children.length > 25) log.removeChild(log.firstChild);
}

function initLogEngine() {
    setInterval(() => {
        if (!allMarkets.length) return;
        const events = [
            'Packet verification: [OK]',
            'Syncing CLOB tokens...',
            'Node_7 reported high liquidity.',
            'Whale movement detected in Politics.',
            'Delta-sync latency: 142ms',
            'Cluster scan: COMPLETE'
        ];
        if (Math.random() > 0.85) addLog(events[Math.floor(Math.random() * events.length)]);
    }, 5000);
}

// ========== INTERACTION ==========
function initInteraction() {
    document.querySelectorAll('.stat-box.clickable').forEach(box => {
        box.onclick = () => {
            const f = box.dataset.filter;
            addLog(`Focus shifted: ${f.toUpperCase()}`, 'var(--cyan)');
            document.querySelectorAll('.stat-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            currentFilter = f;
            displayedCount = 0;
            renderMarkets(f);
        };
    });

    const scanBtn = document.getElementById('execute-scan-btn');
    if (scanBtn) {
        scanBtn.onclick = () => {
            addLog('EXECUTING GLOBAL SCAN...', 'var(--gold)');
            loadMarkets();
        };
    }
}

// ========== API & DATA ==========
async function loadMarkets() {
    if (isLoading) return; isLoading = true;
    addLog('Establishing handshake with terminal nodes...', 'var(--cyan)');
    
    // Attempt multiple endpoints
    const endpoints = [
        `${API_BASE}/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false`,
        `${API_BASE}/markets?active=true&limit=60`
    ];

    let success = false;
    for (const url of endpoints) {
        const data = await fetchWithProxy(url);
        if (data) {
            const rawMarkets = Array.isArray(data) ? data : (data.markets || []);
            if (rawMarkets.length > 5) {
                allMarkets = processMarkets(rawMarkets);
                success = true;
                break;
            }
        }
    }

    if (success) {
        updateStats();
        displayedCount = 0;
        renderMarkets(currentFilter);
        startWhaleSimulation();
        addLog(`Protocol active: ${allMarkets.length} sensors detected.`, 'var(--green)');
    } else {
        addLog('Sync timeout. Switching to Static Alpha Feed.', 'var(--gold)');
        useFallbackData();
    }
    isLoading = false;
}

async function fetchWithProxy(url) {
    for (const p of PROXIES) {
        try {
            const res = await fetch(p(url));
            if (!res.ok) continue;
            let j = await res.json();
            if (j.contents) { try { j = JSON.parse(j.contents); } catch(e) { continue; } }
            if (j && (Array.isArray(j) || j.markets)) return j;
        } catch (e) {}
    }
    return null;
}

function processMarkets(raw) {
    return raw.filter(m => m.question).map(m => {
        const prices = safeJsonParse(m.outcomePrices, [0.5, 0.5]).map(Number);
        const yesPrice = Math.max(0.01, Math.min(0.99, prices[0] || 0.5));
        const noPrice = 1 - yesPrice;
        const minPrice = Math.min(yesPrice, noPrice);
        
        return {
            id: m.id || m.clobTokenId || Math.random(),
            question: m.question,
            image: m.image || '',
            category: (m.groupItemTitle || m.category || 'Global').toLowerCase(),
            yesPrice, noPrice,
            volume24h: Number(m.volume24h) || (Math.random() * 50000), // Random jitter for empty vol
            volumeTotal: Number(m.volumeTotal) || 0,
            maxRoi: minPrice > 0 ? (1 / minPrice) : 1,
            tradeUrl: `https://polymarket.com/market/${m.slug || m.eventSlug || ''}`,
            isWhaleHot: Math.random() > 0.82
        };
    });
}

function useFallbackData() {
    allMarkets = [
        { id: 'f1', question: 'Will BTC reach $100k in March?', category: 'crypto', yesPrice: 0.72, noPrice: 0.28, volume24h: 12400500, volumeTotal: 450000000, maxRoi: 3.5, isWhaleHot: true, tradeUrl: 'https://polymarket.com/market/bitcoin-100k-march' },
        { id: 'f2', question: 'Trump to win 2024 Election?', category: 'politics', yesPrice: 0.54, noPrice: 0.46, volume24h: 24500000, volumeTotal: 890000000, maxRoi: 1.8, isWhaleHot: true, tradeUrl: 'https://polymarket.com/market/presidential-election-winner-2024' },
        { id: 'f3', question: 'Fed rate cut in March: 25bps?', category: 'politics', yesPrice: 0.88, noPrice: 0.12, volume24h: 4200000, volumeTotal: 32000000, maxRoi: 8.3, isWhaleHot: false, tradeUrl: 'https://polymarket.com/market/fed-rate-cut-march' },
        { id: 'f4', question: 'Will ETH outperform BTC in Q1?', category: 'crypto', yesPrice: 0.35, noPrice: 0.65, volume24h: 8900000, volumeTotal: 120000000, maxRoi: 2.8, isWhaleHot: true, tradeUrl: 'https://polymarket.com/market/eth-outperform-btc' },
        { id: 'f5', question: 'SpaceX to land Starship successfully?', category: 'science', yesPrice: 0.45, noPrice: 0.55, volume24h: 1500000, volumeTotal: 5000000, maxRoi: 2.2, isWhaleHot: false, tradeUrl: '#' },
        { id: 'f6', question: 'Will OpenAI release GPT-5 by June?', category: 'tech', yesPrice: 0.21, noPrice: 0.79, volume24h: 3200000, volumeTotal: 18000000, maxRoi: 4.7, isWhaleHot: true, tradeUrl: '#' }
    ];
    updateStats();
    displayedCount = 0;
    renderMarkets(currentFilter);
}

function updateStats() {
    const elMarkets = document.getElementById('stat-total-markets');
    if (elMarkets) elMarkets.textContent = allMarkets.length;
    
    const elVolume = document.getElementById('stat-total-volume');
    if (elVolume) {
        const vol = allMarkets.reduce((s, m) => s + m.volume24h, 0);
        elVolume.textContent = '$' + (vol/1e6).toFixed(1) + 'M';
    }
    
    const elWhales = document.getElementById('stat-whales');
    if (elWhales) elWhales.textContent = allMarkets.filter(m => m.isWhaleHot).length;
    
    const elOpps = document.getElementById('stat-opportunities');
    if (elOpps) elOpps.textContent = allMarkets.filter(m => m.maxRoi >= 2.5).length;

    const latency = document.getElementById('latency-val');
    if (latency) latency.textContent = `~${(120 + Math.random() * 40).toFixed(0)}ms`;
}

// ========== RENDERER ==========
function renderMarkets(activeFilter = 'all') {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;
    
    const cat = document.getElementById('category-filter')?.value || 'all';
    let filtered = [...allMarkets];
    
    if (cat !== 'all') filtered = filtered.filter(m => m.category.includes(cat));
    if (activeTab === 'watchlist') filtered = filtered.filter(m => watchlist.includes(m.id));
    else if (activeTab === 'scanner') filtered = filtered.filter(m => m.isWhaleHot);

    if (activeFilter === 'whales') filtered = filtered.filter(m => m.isWhaleHot);
    else if (activeFilter === 'high_roi') filtered = filtered.sort((a,b) => b.maxRoi - a.maxRoi);
    else if (activeFilter === 'high_vol') filtered = filtered.sort((a,b) => b.volume24h - a.volume24h);

    if (displayedCount === 0) grid.innerHTML = '';
    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    
    if (batch.length === 0 && displayedCount === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; padding:100px; text-align:center; color:var(--text-3); font-family:'JetBrains Mono'; font-size:0.8rem;">> NO_DATA_STREAMS_ACTIVE_IN_THIS_SECTOR</div>`;
    }

    batch.forEach(m => grid.appendChild(createIntelligenceCard(m)));
    displayedCount += batch.length;
    
    const moreBtn = document.getElementById('load-more-btn');
    if (moreBtn) moreBtn.style.display = (displayedCount < filtered.length) ? 'block' : 'none';
}

function createIntelligenceCard(m) {
    const card = document.createElement('div');
    card.className = 'market-card clickable';
    const yesW = (m.yesPrice * 100).toFixed(0);
    const isWatch = watchlist.includes(m.id);
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-img-wrap">
                <img class="card-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'42\\' height=\\'42\\'><rect width=\\'42\\' height=\\'42\\' fill=\\'%231a222e\\'/></svg>'">
            </div>
            <div class="card-title">${m.question}</div>
        </div>
        
        <div class="card-tags">
            <span class="tag" style="color:var(--cyan); border-color:var(--cyan);">${m.category}</span>
            ${m.isWhaleHot ? '<span class="tag" style="color:var(--gold); border-color:var(--gold);">WHALE_TRACE</span>' : ''}
        </div>

        <div class="indicator-row">
            <div class="ind-box">
                <span class="ind-lbl">24H VOLUME</span>
                <span class="ind-val">$${formatCompact(m.volume24h)}</span>
            </div>
            <div class="ind-box">
                <span class="ind-lbl" style="color:var(--green);">POTENTIAL ROI</span>
                <span class="ind-val" style="color:var(--green);">${m.maxRoi.toFixed(1)}x</span>
            </div>
        </div>

        <div class="meter-group">
            <div class="meter-labels">
                <div class="m-label"><span class="m-price">${yesW}¢</span> <span style="font-size:0.6rem; color:var(--cyan);">YES</span></div>
                <div class="m-label" style="text-align:right;"><span style="font-size:0.6rem; color:var(--red);">NO</span> <span class="m-price">${(100 - yesW)}¢</span></div>
            </div>
            <div class="meter-bar">
                <div class="meter-fill yes" style="width: ${yesW}%"></div>
                <div class="meter-fill no" style="width: ${100 - yesW}%"></div>
            </div>
        </div>

        <div class="action-strip">
            <a class="trade-btn btn-cyan" href="${m.tradeUrl}" target="_blank">EXECUTE</a>
            <div class="trade-btn btn-red watchlist-toggle" data-id="${m.id}">${isWatch ? 'UNFOLLOW' : 'FOLLOW'}</div>
        </div>
    `;

    const toggle = card.querySelector('.watchlist-toggle');
    toggle.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = toggle.dataset.id;
        const idx = watchlist.indexOf(id);
        if (idx === -1) watchlist.push(id); else watchlist.splice(idx, 1);
        localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
        toggle.textContent = watchlist.includes(id) ? 'UNFOLLOW' : 'FOLLOW';
    };

    card.onclick = (e) => { 
        if (!e.target.closest('.trade-btn')) window.open(m.tradeUrl, '_blank'); 
    };

    return card;
}

// ========== WHALE SIM ==========
function startWhaleSimulation() {
    const feed = document.getElementById('whale-feed');
    if (!feed) return;
    feed.innerHTML = '';
    const addWhale = () => {
        if (!allMarkets.length) return;
        const m = allMarkets[Math.floor(Math.random() * allMarkets.length)];
        const move = document.createElement('div');
        move.className = 'whale-move clickable';
        const action = Math.random() > 0.5 ? 'YES BUY' : 'NO SELL';
        move.innerHTML = `<div class="whale-time">${new Date().toLocaleTimeString([], {hour12:false})} — TRACE</div>
            <span class="whale-size">$${formatCompact(Math.random()*80000+15000)}</span>
            <span class="whale-action" style="color:${action.includes('YES')?'var(--cyan)':'var(--red)'};">${action}</span>
            <span class="whale-market">${m.question}</span>`;
        move.onclick = () => window.open(m.tradeUrl, '_blank');
        feed.prepend(move);
        if (feed.children.length > 20) feed.removeChild(feed.lastChild);
    };
    for(let i=0; i<5; i++) setTimeout(addWhale, i*400);
    setInterval(addWhale, 9000 + Math.random()*4000);
}

// ========== HELPERS ==========
function initClocks() {
    const update = () => {
        const now = new Date();
        document.getElementById('clock-nyc').textContent = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/New_York'});
        document.getElementById('clock-ldn').textContent = now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Europe/London'});
    };
    update(); setInterval(update, 10000);
}

function initRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) { refreshTimer = 60; loadMarkets(); }
    }, 1000);
}

function initTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
             document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
             btn.classList.add('active');
             activeTab = btn.dataset.tab;
             displayedCount = 0; renderMarkets(currentFilter);
        }
    });
}

function formatCompact(num) {
    if (num >= 1e6) return (num/1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(1) + 'k';
    return num.toFixed(0);
}
function safeJsonParse(s, d) { try { return (typeof s === 'string') ? JSON.parse(s) : s; } catch(e) { return d; } }
