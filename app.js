/* PolyEdge Logic & Interaction Engine v7.0 - PRO LIGHT THEME */
const CONFIG = {
    PROXIES: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://thingproxy.freeboard.io/fetch/'
    ],
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=25&order=volume&dir=desc',
    REFRESH: 45000
};

let appState = {
    markets: [],
    activeTab: 'MARKETS',
    search: '',
    syncStatus: 'OFFLINE'
};

// --- BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    updateClocks();
    setInterval(updateClocks, 60000);
});

function initEngine() {
    setupUI();
    syncProtocol();
    setInterval(syncProtocol, CONFIG.REFRESH);
}

function setupUI() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            appState.activeTab = item.innerText.trim().toUpperCase(); 
            const title = document.getElementById('view-title');
            if (title) title.innerText = appState.activeTab === 'MARKETS' ? 'Trending Markets' : 
                                       appState.activeTab === 'SCANNER' ? 'Opportunity Scanner' : item.innerText.trim();
            renderMain();
        });
    });

    const search = document.getElementById('shardSearch');
    if (search) {
        search.addEventListener('input', (e) => {
            appState.search = e.target.value.toLowerCase();
            renderMain();
        });
    }
}

// --- NETWORK CORE ---
async function syncProtocol(proxyIndex = 0) {
    if (proxyIndex >= CONFIG.PROXIES.length) {
        deployEmergency();
        return;
    }

    try {
        const proxy = CONFIG.PROXIES[proxyIndex];
        const res = await fetch(`${proxy}${encodeURIComponent(CONFIG.API_URL)}`);
        if (!res.ok) throw new Error("Node timeout");
        
        const data = await res.json();
        if (data && data.length > 0) {
            appState.markets = data;
            appState.syncStatus = 'ONLINE';
            updateGlobalStats();
            renderMain();
        } else {
            throw new Error("Data corruption");
        }
    } catch (e) {
        syncProtocol(proxyIndex + 1);
    }
}

function deployEmergency() {
    appState.markets = [
        { question: "Will Iran strike Israel on March 6?", volume: 11000000, liquidity: 2500000, prices: [0.10, 0.99], slug: "iran-strike-israel-march-6", badge: "HIGH VOL" },
        { question: "Will Iran close the Strait of Hormuz by March 31?", volume: 7800000, liquidity: 1700000, prices: [0.99, 0.03], slug: "iran-strait-hormuz-march-31", badge: "HIGH VOL" },
        { question: "Will the Fed decrease interest rates by 50+ bps after the March 2026 meeting?", volume: 5000000, liquidity: 4100000, prices: [0.03, 0.99], slug: "fed-rates-decrease-50", badge: "SOON" },
        { question: "Will the Fed increase interest rates by 25+ bps after the March 2026 meeting?", volume: 3700000, liquidity: 4800000, prices: [0.03, 0.99], slug: "fed-rates-increase-25", badge: "SOON" },
        { question: "Will Chelsea win the 2025-26 English Premier League?", volume: 3400000, liquidity: 395000, prices: [0.10, 0.99], slug: "chelsea-win-epl-2026", badge: "HIGH VOL" },
        { question: "Will Trump say 'Jesus' this week? (March 8)", volume: 3300000, liquidity: 2100000, prices: [0.99, 0.01], slug: "trump-jesus-march-8", badge: "ENDING" }
    ];
    updateGlobalStats();
    renderMain();
}

function updateGlobalStats() {
    const mCount = document.getElementById('market-count');
    const fVal = document.getElementById('flow-val');
    if (mCount) mCount.innerText = appState.markets.length;
    if (fVal) {
        const total = appState.markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
        fVal.innerText = `$${(total/1000000).toFixed(1)}M`;
    }
}

function updateClocks() {
    const now = new Date();
    const format = (offset) => {
        const d = new Date(now.getTime() + (offset * 3600000));
        return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    };
    if (document.getElementById('time-nyc')) document.getElementById('time-nyc').innerText = format(-5);
    if (document.getElementById('time-ldn')) document.getElementById('time-ldn').innerText = format(0);
    if (document.getElementById('time-tko')) document.getElementById('time-tko').innerText = format(9);
}

// --- RENDER ENGINE ---
function renderMain() {
    const grid = document.getElementById('shard-grid');
    if (!grid) return;
    grid.className = '';
    grid.innerHTML = '';

    switch(appState.activeTab) {
        case 'SCANNER':
            renderScannerView(grid);
            break;
        case 'WATCHLIST':
            renderStatusMessage(grid, 'Watchlist', 'Your saved markets will appear here.');
            break;
        case 'ARBITRAGE':
            renderStatusMessage(grid, 'Arbitrage', 'Cross-exchange opportunities sync in progress.');
            break;
        case 'SIMULATOR':
            renderStatusMessage(grid, 'Simulator', 'Strategy simulation engine restricted for Pro users.');
            break;
        default:
            grid.classList.add('market-list');
            renderMarketsView(grid);
    }
}

function renderMarketsView(container) {
    const filtered = appState.markets.filter(m => m.question.toLowerCase().includes(appState.search));

    filtered.forEach((m, idx) => {
        let p = [0.5, 0.5];
        try { p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.prices || [0.5, 0.5]; } catch(e) {}
        
        const y = (parseFloat(p[0] || 0.5) * 100).toFixed(1);
        const n = (parseFloat(p[1] || 0.5) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'market-card';
        card.innerHTML = `
            <div class="alert-icon">🔔</div>
            <div class="badge-row">
                <span class="badge ${m.badge ? m.badge.toLowerCase().replace(' ', '-') : 'high-vol'}">${m.badge || 'HIGH VOL'}</span>
                <span class="badge">PRO</span>
            </div>
            <div class="card-main">
                <img src="https://api.dicebear.com/7.x/initials/svg?seed=${m.slug}&backgroundColor=f1f5f9" class="card-img" alt="topic">
                <div class="card-q">${m.question}</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 15px;">
                7d Vol: $${((m.volume || 1000000)/1000000).toFixed(1)}M | Liq: $${((m.liquidity || 500000)/1000000).toFixed(1)}M
            </div>
            <div class="price-grid">
                <div class="p-btn yes" style="text-align:center">Yes ${y}¢</div>
                <div class="p-btn no" style="text-align:center">No ${n}¢</div>
            </div>
            <div class="bet-input-row">
                <span class="bet-label">Bet $</span>
                <input type="number" class="bet-field" value="10" oninput="updateWin(this, ${y})">
                <span class="win-label">→ win $${(10 / (parseFloat(y)/100 || 0.1)).toFixed(2)}</span>
            </div>
            <a href="https://polymarket.com/event/${m.slug}" target="_blank" style="text-decoration:none">
                <button class="trade-btn">Trade on Polymarket</button>
            </a>
        `;
        container.appendChild(card);
    });
}

window.updateWin = (el, price) => {
    const val = parseFloat(el.value) || 0;
    const win = val / (parseFloat(price)/100);
    el.nextElementSibling.innerText = `→ win $${win.toFixed(2)}`;
};

function renderScannerView(container) {
    const wrap = document.createElement('div');
    wrap.className = 'scanner-table';
    wrap.innerHTML = `
        <div class="scanner-row header">
            <div>#</div>
            <div>Market Name</div>
            <div>Liquidity</div>
            <div>24h Vol</div>
            <div>Action</div>
        </div>
        ${appState.markets.slice(0, 10).map((m, i) => `
            <div class="scanner-row">
                <div style="color: var(--text-dim); font-weight: 700;">#${i+1}</div>
                <div style="font-weight: 600; font-size: 14px;">${m.question}</div>
                <div style="font-family: monospace;">$${((m.liquidity || 500000)/1000).toFixed(0)}K</div>
                <div style="font-family: monospace;">$${((m.volume || 1000000)/1000000).toFixed(1)}M</div>
                <div><button class="trade-btn" style="padding: 6px 12px; font-size: 11px;">Trade</button></div>
            </div>
        `).join('')}
    `;
    container.appendChild(wrap);
}

function renderStatusMessage(container, title, msg) {
    container.innerHTML = `
        <div style="padding: 100px 40px; text-align: center; background: #fff; margin: 0 40px; border-radius: 12px; border: 1px dashed var(--border-line);">
            <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">${title}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${msg}</p>
        </div>
    `;
}
