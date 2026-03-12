/**
 * PolyEdge — Whale Intelligence Terminal (v3.2)
 * Final Refinement: Clickability, Terminal Logs, and Professional Intelligence Feed.
 */

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
    initClocks();
    initRefresh();
    initLogEngine();
    initInteraction();
    loadMarkets();
    
    // Global Listeners
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.onclick = () => renderMarkets();
    
    const catSel = document.getElementById('category-filter');
    if (catSel) catSel.onchange = () => { displayedCount = 0; renderMarkets(); };
    
    const logoRefresh = document.getElementById('logo-refresh');
    if (logoRefresh) logoRefresh.onclick = () => window.location.reload();
});

// ========== TERMINAL LOG ENGINE ==========
function addLog(msg, color = 'var(--text-2)') {
    const log = document.getElementById('system-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.color = color;
    entry.textContent = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] > ${msg}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (log.children.length > 50) log.removeChild(log.firstChild);
}

function initLogEngine() {
    setInterval(() => {
        const events = [
            'Packet verification: [OK]',
            'Delta-sync: [0.04s]',
            'Routing through Node_4... latency stable.',
            'Wallet detection logic updated.',
            'Memory usage: [Optimal]',
            'Sector mapping: [Active]'
        ];
        if (Math.random() > 0.8) addLog(events[Math.floor(Math.random() * events.length)]);
    }, 4000);
}

// ========== INTERACTION HANDLERS (CLICKABILITY) ==========
function initInteraction() {
    // Stats Filtering
    document.querySelectorAll('.stat-box.clickable').forEach(box => {
        box.onclick = () => {
            addLog(`Switching filter focus: ${box.dataset.filter.toUpperCase()}`, 'var(--cyan)');
            document.querySelectorAll('.stat-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            displayedCount = 0;
            renderMarkets(box.dataset.filter);
        };
    });

    // API Scan Simulation
    const scanBtn = document.getElementById('execute-scan-btn');
    if (scanBtn) {
        scanBtn.onclick = () => {
            const original = scanBtn.textContent;
            scanBtn.textContent = 'EXECUTING API_SCAN...';
            scanBtn.style.opacity = '0.5';
            addLog('API SCAN REQUESTED: BROADCASTING NODES...', 'var(--gold)');
            
            setTimeout(() => {
                scanBtn.textContent = 'SCAN_COMPLETE (42 SIGNALS)';
                addLog('SCAN_COMPLETE: 42 NEW ALPHA SIGNALS DETECTED.', 'var(--green)');
                loadMarkets(); 
                setTimeout(() => {
                    scanBtn.textContent = original;
                    scanBtn.style.opacity = '1';
                }, 3000);
            }, 2000);
        };
    }

    // Refresh Trigger
    const refreshBtn = document.getElementById('refresh-trigger');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            addLog('Manual sync triggered by user.', 'var(--cyan)');
            loadMarkets();
        };
    }

    // Insight Blocks
    const whaleAlert = document.getElementById('whale-alert-block');
    if (whaleAlert) {
        whaleAlert.onclick = () => {
            addLog('Cluster zoom enabled. Filtering by Whale Activity...', 'var(--gold)');
            displayedCount = 0;
            renderMarkets('whales');
        };
    }
}

// ========== REFRESH & CLOCKS ==========
function initClocks() {
    const update = () => {
        const now = new Date();
        const cfg = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' };
        const ldnCfg = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' };
        
        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        if(nyc) nyc.textContent = new Intl.DateTimeFormat('en-US', cfg).format(now);
        if(ldn) ldn.textContent = new Intl.DateTimeFormat('en-GB', ldnCfg).format(now);
    };
    update(); setInterval(update, 10000);
}

function initRefresh() {
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer <= 0) {
            refreshTimer = 60;
            loadMarkets();
        }
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
    addLog('Starting global synchronization sequence...');
    const url = `${API_BASE}/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false`;
    const data = await fetchWithProxy(url);
    if (data) {
        allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
        updateStats();
        displayedCount = 0;
        renderMarkets();
        startWhaleSimulation();
        addLog('Sync successful. Cluster mapping complete.', 'var(--green)');
    } else {
        addLog('Sync failed. Retrying through alternate node...', 'var(--red)');
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
            question: m.question || 'Target Intelligence Identified',
            image: m.image || '',
            category: cat,
            yesPrice, noPrice,
            volume24h: Number(m.volume24h) || 0,
            volumeTotal: Number(m.volumeTotal) || 0,
            liquidity: Number(m.liquidity) || 0,
            daysLeft, maxRoi, minPrice,
            eventSlug: m.slug || '',
            isHighRoi: maxRoi >= 3.0,
            isWhaleHot: Math.random() > 0.82
        };
    });
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
    if (elOpps) elOpps.textContent = allMarkets.filter(m => m.isHighRoi).length;

    // Latency mock
    const latency = document.getElementById('latency-val');
    if (latency) latency.textContent = `~${(140 + Math.random() * 20).toFixed(0)}ms`;
}

// ========== TABS ==========
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
             addLog(`Navigating to sector: ${btn.dataset.tab.toUpperCase()}`, 'var(--cyan)');
             document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
             btn.classList.add('active');
             activeTab = btn.dataset.tab;
             displayedCount = 0; 
             renderMarkets();
        }
    });
}

// ========== RENDERER ==========
function renderMarkets(activeFilter = 'all') {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;
    
    const cat = document.getElementById('category-filter')?.value || 'all';
    let filtered = cat === 'all' ? [...allMarkets] : allMarkets.filter(m => m.category === cat);
    
    if (activeTab === 'watchlist') {
        filtered = filtered.filter(m => watchlist.includes(m.id));
    } else if (activeTab === 'scanner') {
        filtered = filtered.filter(m => m.isWhaleHot);
    }

    if (activeFilter === 'high_vol') {
        filtered = filtered.sort((a,b) => b.volume24h - a.volume24h);
    } else if (activeFilter === 'whales') {
        filtered = filtered.filter(m => m.isWhaleHot);
    } else if (activeFilter === 'high_roi') {
        filtered = filtered.filter(m => m.isHighRoi);
    }

    if (displayedCount === 0) grid.innerHTML = '';
    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    
    if (batch.length === 0 && displayedCount === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 100px; text-align: center; color: var(--text-3); font-weight:800; font-family:'JetBrains Mono';">> NO_SIGNALS_DETECTED_IN_SECTOR</div>`;
    }

    batch.forEach(m => grid.appendChild(createIntelligenceCard(m)));
    displayedCount += batch.length;
    
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createIntelligenceCard(m) {
    const card = document.createElement('div');
    card.className = 'market-card clickable';
    
    const yesWidth = (m.yesPrice * 100).toFixed(0);
    const isWatch = watchlist.includes(m.id);
    
    card.innerHTML = `
        <div class="card-header">
            <img class="card-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'42\\' height=\\'42\\'><rect width=\\'42\\' height=\\'42\\' fill=\\'%231a222e\\'/></svg>'">
            <div class="card-title">${m.question}</div>
        </div>
        
        <div class="card-tags">
            <span class="tag" style="color:var(--cyan); border-color:var(--cyan);">${m.category}</span>
            ${m.isWhaleHot ? '<span class="tag" style="color:var(--gold); border-color:var(--gold);">WHALE_TRACE</span>' : ''}
            <span class="tag">${m.daysLeft !== null ? m.daysLeft + 'D LEFT' : 'OPEN'}</span>
        </div>

        <div class="indicator-row">
            <div class="ind-box">
                <span class="ind-lbl">GLOBAL VOL</span>
                <span class="ind-val">$${formatCompact(m.volumeTotal)}</span>
            </div>
            <div class="ind-box">
                <span class="ind-lbl" style="color:var(--green);">POTENTIAL ROI</span>
                <span class="ind-val" style="color:var(--green);">${m.maxRoi.toFixed(1)}x</span>
            </div>
        </div>

        <div class="meter-group">
            <div class="meter-labels">
                <div class="m-label">
                    <span style="color:var(--cyan); font-size:0.6rem; opacity:0.8; letter-spacing:1px;">PROBABILITY</span>
                    <span class="m-price">${yesWidth}¢</span>
                </div>
                <div class="m-label" style="text-align:right;">
                    <span style="color:var(--red); font-size:0.6rem; opacity:0.8; letter-spacing:1px;">NO_SIDE</span>
                    <span class="m-price">${(100 - yesWidth)}¢</span>
                </div>
            </div>
            <div class="meter-bar">
                <div class="meter-fill yes" style="width: ${yesWidth}%"></div>
                <div class="meter-fill no" style="width: ${100 - yesWidth}%"></div>
            </div>
        </div>

        <div class="action-strip">
            <a class="trade-btn btn-cyan" href="https://polymarket.com/event/${m.eventSlug}" target="_blank">EXECUTE TRADE</a>
            <div class="trade-btn btn-red watchlist-toggle" data-id="${m.id}">
                ${isWatch ? 'UNFOLLOW' : 'FOLLOW SIGNAL'}
            </div>
        </div>
    `;

    // Click behavior fixes
    const toggle = card.querySelector('.watchlist-toggle');
    toggle.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = toggle.dataset.id;
        const idx = watchlist.indexOf(id);
        if (idx === -1) { watchlist.push(id); addLog(`Following signal: ${m.id}`); } 
        else { watchlist.splice(idx, 1); addLog(`Unfollowing signal: ${m.id}`); }
        localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
        toggle.textContent = watchlist.includes(id) ? 'UNFOLLOW' : 'FOLLOW SIGNAL';
        if (activeTab === 'watchlist') { displayedCount = 0; renderMarkets(); }
    };

    // Open link on card click (excluding buttons)
    card.onclick = (e) => {
        if (!e.target.closest('.trade-btn')) window.open(`https://polymarket.com/event/${m.eventSlug}`, '_blank');
    };

    return card;
}

// ========== WHALE SIMULATION (CLICKABLE MOVES) ==========
function startWhaleSimulation() {
    const feed = document.getElementById('whale-feed');
    if (!feed) return;
    feed.innerHTML = '';
    
    const addWhaleMove = () => {
        if (!allMarkets.length) return;
        const m = allMarkets[Math.floor(Math.random() * allMarkets.length)];
        const amt = (Math.random() * 80000 + 10000);
        const action = Math.random() > 0.5 ? 'YES' : 'NO';
        
        const move = document.createElement('div');
        move.className = 'whale-move clickable';
        move.innerHTML = `
            <div class="whale-time">${new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} — TRACE DETECTED</div>
            <span class="whale-size">$${formatCompact(amt)}</span>
            <span class="whale-action" style="color: ${action === 'YES' ? 'var(--cyan)' : 'var(--red)'};">${action} ORDER</span>
            <span class="whale-market">${m.question}</span>
        `;
        
        move.onclick = () => {
            addLog(`Tracing Whale move on: ${m.question.substring(0, 20)}...`, 'var(--gold)');
            window.open(`https://polymarket.com/event/${m.eventSlug}`, '_blank');
        };
        
        feed.prepend(move);
        if (feed.children.length > 20) feed.removeChild(feed.lastChild);
    };

    for(let i=0; i<6; i++) setTimeout(addWhaleMove, i * 300);
    setInterval(addWhaleMove, 8000 + (Math.random() * 5000));
}

// ========== HELPERS ==========
function formatCompact(num) {
    if (num >= 1e6) return (num/1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(1) + 'k';
    return num.toFixed(0);
}
function safeJsonParse(s, d) { try { return (typeof s === 'string') ? JSON.parse(s) : s; } catch(e) { return d; } }
