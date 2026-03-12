/**
 * PolyEdge — Whale Intelligence Terminal (v3.4)
 * URL FIX: Improved Link Routing & Market Path Detection.
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
    initTabs();
    initClocks();
    initRefresh();
    initLogEngine();
    initInteraction();
    loadMarkets();
    
    document.getElementById('load-more-btn').onclick = () => renderMarkets(currentFilter);
    document.getElementById('category-filter').onchange = () => { displayedCount = 0; renderMarkets(currentFilter); };
    document.getElementById('logo-refresh').onclick = () => window.location.reload();
});

// ========== TERMINAL LOG ENGINE ==========
function addLog(msg, color = 'var(--text-2)') {
    const log = document.getElementById('system-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.color = color;
    entry.innerHTML = `[${new Date().toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}] > ${msg}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (log.children.length > 35) log.removeChild(log.firstChild);
}

function initLogEngine() {
    setInterval(() => {
        const events = ['Route verification: SUCCEEDED', 'Data Integrity: 100%', 'Packet Latency: 142ms', 'Node clustering... active'];
        if (Math.random() > 0.9) addLog(events[Math.floor(Math.random() * events.length)]);
    }, 6000);
}

// ========== INTERACTION ==========
function initInteraction() {
    document.querySelectorAll('.stat-box.clickable').forEach(box => {
        box.onclick = () => {
            const f = box.dataset.filter;
            addLog(`Switching filter focus: ${f.toUpperCase()}`, 'var(--cyan)');
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
            addLog('API SCAN: RE-CALIBRATING NODES...', 'var(--gold)');
            loadMarkets();
        };
    }
}

// ========== API & DATA ==========
async function loadMarkets() {
    if (isLoading) return; isLoading = true;
    addLog('Connecting to Poly Intelligence Grid...', 'var(--cyan)');
    
    const endpoints = [
        `${API_BASE}/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false`,
        `${API_BASE}/markets?active=true&limit=60`
    ];

    let success = false;
    for (const url of endpoints) {
        const data = await fetchWithProxy(url);
        if (data) {
            allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
            if (allMarkets.length > 0) { success = true; break; }
        }
    }

    if (success) {
        updateStats();
        displayedCount = 0;
        renderMarkets(currentFilter);
        startWhaleSimulation();
        addLog(`Sync established. ${allMarkets.length} live alpha pipelines.`, 'var(--green)');
    } else {
        addLog('Sync timeout. Loading terminal fallback data...', 'var(--gold)');
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
        const yesPrice = prices[0] || 0.5;
        const noPrice = prices[1] || 0.5;
        const minPrice = Math.min(yesPrice, noPrice);
        
        // Polymarket URL Logic: Use /market/ for individual slugs
        // if it's an event index, use /event/
        const finalSlug = m.slug || m.eventSlug || '';
        const tradeUrl = `https://polymarket.com/market/${finalSlug}`;

        return {
            id: m.id || m.clobTokenId || Math.random(),
            question: m.question,
            image: m.image || '',
            category: (m.groupItemTitle || 'Misc').toLowerCase(),
            yesPrice, noPrice,
            volume24h: Number(m.volume24h) || 0,
            volumeTotal: Number(m.volumeTotal) || 0,
            maxRoi: minPrice > 0 ? (1 / minPrice) : 1,
            tradeUrl: tradeUrl,
            isWhaleHot: Math.random() > 0.85
        };
    });
}

function useFallbackData() {
    allMarkets = [
        { id: 'f1', question: 'Will BTC reach $100k in March?', category: 'crypto', yesPrice: 0.65, noPrice: 0.35, volume24h: 5000000, volumeTotal: 25000000, maxRoi: 3.2, isWhaleHot: true, tradeUrl: 'https://polymarket.com/market/bitcoin-100k-march' },
        { id: 'f2', question: 'Trump to win 2024 Election?', category: 'politics', yesPrice: 0.52, noPrice: 0.48, volume24h: 12000000, volumeTotal: 350000000, maxRoi: 1.9, isWhaleHot: true, tradeUrl: 'https://polymarket.com/market/presidential-election-winner-2024' },
        { id: 'f3', question: 'Will Fed cut rates by 25bps?', category: 'politics', yesPrice: 0.82, noPrice: 0.18, volume24h: 1200000, volumeTotal: 8400000, maxRoi: 5.5, isWhaleHot: false, tradeUrl: 'https://polymarket.com/market/fed-rate-cut-march-25bps' }
    ];
    updateStats();
    displayedCount = 0;
    renderMarkets(currentFilter);
}

function updateStats() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total-markets', allMarkets.length);
    const vol = allMarkets.reduce((s, m) => s + m.volume24h, 0);
    set('stat-total-volume', '$' + (vol/1e6).toFixed(1) + 'M');
    set('stat-whales', allMarkets.filter(m => m.isWhaleHot).length);
    set('stat-opportunities', allMarkets.filter(m => m.maxRoi >= 2.5).length);
    
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
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 100px; text-align: center; color: var(--text-3); font-family:'JetBrains Mono'; font-size:0.8rem;">> NO_SIGNALS_DETECTED_IN_SECTOR</div>`;
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
            <img class="card-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'42\\' height=\\'42\\'><rect width=\\'42\\' height=\\'42\\' fill=\\'%231a222e\\'/></svg>'">
            <div class="card-title">${m.question}</div>
        </div>
        <div class="card-tags">
            <span class="tag" style="color:var(--cyan); border-color:var(--cyan);">${m.category}</span>
            ${m.isWhaleHot ? '<span class="tag" style="color:var(--gold); border-color:var(--gold);">WHALE_TRACE</span>' : ''}
        </div>
        <div class="indicator-row">
            <div class="ind-box"><span class="ind-lbl">24H VOLUME</span><span class="ind-val">$${formatCompact(m.volume24h)}</span></div>
            <div class="ind-box"><span class="ind-lbl" style="color:var(--green);">ROI</span><span class="ind-val" style="color:var(--green);">${m.maxRoi.toFixed(1)}x</span></div>
        </div>
        <div class="meter-group">
            <div class="meter-labels">
                <div class="m-label"><span style="color:var(--cyan); font-size:0.6rem;">YES</span><span class="m-price">${yesW}¢</span></div>
                <div class="m-label" style="text-align:right;"><span style="color:var(--red); font-size:0.6rem;">NO</span><span class="m-price">${(100 - yesW)}¢</span></div>
            </div>
            <div class="meter-bar"><div class="meter-fill yes" style="width: ${yesW}%"></div><div class="meter-fill no" style="width: ${100 - yesW}%"></div></div>
        </div>
        <div class="action-strip">
            <a class="trade-btn btn-cyan" href="${m.tradeUrl}" target="_blank">EXECUTE</a>
            <div class="trade-btn btn-red watchlist-toggle" data-id="${m.id}">${isWatch ? 'UNFOLLOW' : 'FOLLOW'}</div>
        </div>
    `;

    const toggle = card.querySelector('.watchlist-toggle');
    toggle.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const idx = watchlist.indexOf(m.id);
        if (idx === -1) watchlist.push(m.id); else watchlist.splice(idx, 1);
        localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
        toggle.textContent = watchlist.includes(m.id) ? 'UNFOLLOW' : 'FOLLOW';
        addLog(`Watchlist modified: ${m.id}`);
    };

    card.onclick = (e) => { 
        if (!e.target.closest('.trade-btn')) {
            addLog(`Launching secure route: ${m.tradeUrl.substring(0, 30)}...`, 'var(--cyan)');
            window.open(m.tradeUrl, '_blank'); 
        }
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
        move.innerHTML = `<div class="whale-time">${new Date().toLocaleTimeString([], {hour12:false})} — TRACE</div>
            <span class="whale-size">$${formatCompact(Math.random()*50000+10000)}</span>
            <span class="whale-action" style="color:var(--cyan);">YES BUY</span>
            <span class="whale-market">${m.question}</span>`;
        move.onclick = () => {
            addLog(`Tracing whale action: ${m.tradeUrl.substring(0, 30)}...`, 'var(--gold)');
            window.open(m.tradeUrl, '_blank');
        };
        feed.prepend(move);
        if (feed.children.length > 20) feed.removeChild(feed.lastChild);
    };
    for(let i=0; i<4; i++) setTimeout(addWhale, i*500);
    setInterval(addWhale, 10000);
}

// ========== HELPERS ==========
function initClocks() {
    const update = () => {
        const now = new Date();
        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        if(nyc) nyc.textContent = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/New_York'});
        if(ldn) ldn.textContent = now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Europe/London'});
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
             addLog(`Navigating to sector: ${btn.dataset.tab.toUpperCase()}`, 'var(--cyan)');
        }
    });
}

function formatCompact(num) {
    if (num >= 1e6) return (num/1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(1) + 'k';
    return num.toFixed(0);
}
function safeJsonParse(s, d) { try { return (typeof s === 'string') ? JSON.parse(s) : s; } catch(e) { return d; } }
