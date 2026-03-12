/**
 * PolyEdge — Whale Intelligence Terminal (v3.01)
 * Optimized for professional analytics.
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
    loadMarkets();
    
    // Global Filter Listeners
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.onclick = () => renderMarkets();
    
    const catSel = document.getElementById('category-filter');
    if (catSel) catSel.onchange = () => { displayedCount = 0; renderMarkets(); };
});

// ========== TABS ==========
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
             const tab = btn.dataset.tab;
             document.querySelectorAll('.tab').forEach(t => {
                 if (t.classList.contains('main-content') || t.id === `tab-${tab}`) {
                     // Support for single section content approach if needed
                 }
             });
             
             document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
             btn.classList.add('active');
             
             activeTab = tab;
             // For simplicity in the intelligence layout, we just re-render dashboard or filter
             displayedCount = 0; 
             renderMarkets();
        }
    });
}

// ========== CLOCKS ==========
function initClocks() {
    const update = () => {
        const now = new Date();
        const cfg = { hour: '2-digit', minute: '2-digit', hour12: false };
        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        if(nyc) nyc.textContent = new Intl.DateTimeFormat('en-US', { ...cfg, timeZone: 'America/New_York' }).format(now);
        if(ldn) ldn.textContent = new Intl.DateTimeFormat('en-GB', { ...cfg, timeZone: 'Europe/London' }).format(now);
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
    const url = `${API_BASE}/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false`;
    const data = await fetchWithProxy(url);
    if (data) {
        allMarkets = processMarkets(Array.isArray(data) ? data : (data.markets || []));
        updateStats();
        displayedCount = 0;
        renderMarkets();
        startWhaleSimulation();
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
            question: m.question || 'Target Identified',
            image: m.image || '',
            category: cat,
            yesPrice, noPrice,
            volume24h: Number(m.volume24h) || 0,
            liquidity: Number(m.liquidity) || 0,
            daysLeft, maxRoi, minPrice,
            eventSlug: m.slug || '',
            isWhaleHot: Math.random() > 0.8
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
    if (elOpps) elOpps.textContent = allMarkets.filter(m => m.maxRoi >= 3.0).length;
}

// ========== RENDERER ==========
function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;
    
    const cat = document.getElementById('category-filter')?.value || 'all';
    let filtered = cat === 'all' ? [...allMarkets] : allMarkets.filter(m => m.category === cat);
    
    if (activeTab === 'watchlist') {
        filtered = filtered.filter(m => watchlist.includes(m.id));
    } else if (activeTab === 'scanner') {
        filtered = filtered.filter(m => m.isWhaleHot);
    }

    if (displayedCount === 0) grid.innerHTML = '';
    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);
    
    if (batch.length === 0 && displayedCount === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 100px; text-align: center; color: var(--text-3);">NO DATA SIGNALS DETECTED IN THIS SECTOR.</div>`;
    }

    batch.forEach(m => grid.appendChild(createIntelligenceCard(m)));
    displayedCount += batch.length;
    
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = displayedCount < filtered.length ? 'block' : 'none';
}

function createIntelligenceCard(m) {
    const card = document.createElement('div');
    card.className = 'market-card';
    
    const yesWidth = (m.yesPrice * 100).toFixed(0);
    const isWatch = watchlist.includes(m.id);
    
    card.innerHTML = `
        <div class="card-header">
            <img class="card-img" src="${m.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'42\\' height=\\'42\\'><rect width=\\'42\\' height=\\'42\\' fill=\\'%231a222e\\'/></svg>'">
            <div class="card-title">${m.question}</div>
        </div>
        
        <div class="card-tags">
            <span class="tag" style="color:var(--cyan);">${m.category}</span>
            ${m.isWhaleHot ? '<span class="tag tag-whale">Whale Movement</span>' : ''}
            <span class="tag">${m.daysLeft !== null ? m.daysLeft + 'D left' : 'OPEN'}</span>
        </div>

        <div class="indicators">
            <div class="ind-box">
                <span class="ind-lbl">24h Vol</span>
                <span class="ind-val">$${formatCompact(m.volume24h)}</span>
            </div>
            <div class="ind-box">
                <span class="ind-lbl" style="color:var(--green);">Target ROI</span>
                <span class="ind-val" style="color:var(--green);">${m.maxRoi.toFixed(1)}x</span>
            </div>
        </div>

        <div class="meter-group">
            <div class="meter-labels">
                <div class="m-label">
                    <span style="color:var(--cyan); font-size:0.6rem; opacity:0.6;">PROBABILITY</span>
                    <span class="m-price">${yesWidth}¢</span>
                </div>
                <div class="m-label" style="text-align:right;">
                    <span style="color:var(--red); font-size:0.6rem; opacity:0.6;">NO SIDE</span>
                    <span class="m-price">${(100 - yesWidth)}¢</span>
                </div>
            </div>
            <div class="meter-bar">
                <div class="meter-fill yes" style="width: ${yesWidth}%"></div>
                <div class="meter-fill no" style="width: ${100 - yesWidth}%"></div>
            </div>
        </div>

        <div class="trade-strip">
            <a class="trade-btn btn-cyan" href="https://polymarket.com/event/${m.eventSlug}" target="_blank">EXECUTE TRADE</a>
            <div class="trade-btn btn-red watchlist-toggle" data-id="${m.id}" style="font-size: 0.65rem;">
                ${isWatch ? 'UNFOLLOW' : 'FOLLOW SIGNAL'}
            </div>
        </div>
    `;

    card.querySelector('.watchlist-toggle').onclick = (e) => {
        const id = e.target.dataset.id;
        const idx = watchlist.indexOf(id);
        if (idx === -1) watchlist.push(id); else watchlist.splice(idx, 1);
        localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
        e.target.textContent = watchlist.includes(id) ? 'UNFOLLOW' : 'FOLLOW SIGNAL';
        if (activeTab === 'watchlist') { displayedCount = 0; renderMarkets(); }
    };

    return card;
}

// ========== WHALE SIMULATION ==========
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
        move.className = 'whale-move';
        move.innerHTML = `
            <div class="whale-time">${new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} — TRACE DETECTED</div>
            <span class="whale-size">$${formatCompact(amt)}</span>
            <span class="whale-action" style="color: ${action === 'YES' ? 'var(--cyan)' : 'var(--red)'};">${action} Order</span>
            <span class="whale-market">${m.question}</span>
        `;
        
        feed.prepend(move);
        if (feed.children.length > 20) feed.removeChild(feed.lastChild);
    };

    // Initial batch
    for(let i=0; i<6; i++) setTimeout(addWhaleMove, i * 300);
    // Real-time loop
    setInterval(addWhaleMove, 8000 + (Math.random() * 5000));
}

// ========== HELPERS ==========
function formatCompact(num) {
    if (num >= 1e6) return (num/1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num/1e3).toFixed(1) + 'k';
    return num.toFixed(0);
}
function safeJsonParse(s, d) { try { return (typeof s === 'string') ? JSON.parse(s) : s; } catch(e) { return d; } }
