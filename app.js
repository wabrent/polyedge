/* PolyEdge Logic & Interaction Engine v5.0 */
const CONFIG = {
    // FALLBACK PROXIES FOR HIGH RELIABILITY
    PROXIES: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=25&order=volume&dir=desc',
    REFRESH: 45000
};

let appState = {
    markets: [],
    activeView: 'TERMINAL',
    search: '',
    syncStatus: 'OFFLINE'
};

// --- BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', () => {
    initEngine();
});

function initEngine() {
    setupUI();
    syncProtocol();
    setInterval(syncProtocol, CONFIG.REFRESH);
}

function setupUI() {
    // Tab Listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            appState.activeView = item.innerText.trim();
            renderMain();
        });
    });

    // Search Interaction
    const search = document.getElementById('shardSearch');
    if (search) {
        search.addEventListener('input', (e) => {
            appState.search = e.target.value.toLowerCase();
            renderMain();
        });
    }
}

// --- NETWORK CORE (MULTI-PROXY FAILOVER) ---
async function syncProtocol(proxyIndex = 0) {
    if (proxyIndex >= CONFIG.PROXIES.length) {
        console.error("All shard nodes failed. Deploying emergency local data.");
        deployEmergency();
        return;
    }

    const loader = document.getElementById('boot-loader');
    if (loader) loader.innerText = `SYNCING DATA FLOW [PROXY ${proxyIndex + 1}]...`;

    try {
        const proxy = CONFIG.PROXIES[proxyIndex];
        const res = await fetch(`${proxy}${encodeURIComponent(CONFIG.API_URL)}`);
        
        if (!res.ok) throw new Error("Proxy Error");
        
        const data = await res.json();
        if (data && data.length > 0) {
            appState.markets = data;
            appState.syncStatus = 'ONLINE';
            updateGlobalStats();
            renderMain();
        } else {
            throw new Error("Empty Response");
        }
    } catch (e) {
        console.warn(`Shard Node ${proxyIndex} failed. Retrying...`);
        syncProtocol(proxyIndex + 1);
    }
}

function deployEmergency() {
    appState.markets = [
        { question: "Will Israel launch offensive in Iran before March 31?", volume: 11200000, liquidity: 2100000, outcomePrices: "[0.12, 0.88]", slug: "will-israel-iran" },
        { question: "Will the Fed decrease interest rates by 25+ bps in April?", volume: 8500000, liquidity: 5600000, outcomePrices: "[0.65, 0.35]", slug: "fed-rates-april" },
        { question: "Will NVIDIA stock close above $1,200 this week?", volume: 14000000, liquidity: 8900000, outcomePrices: "[0.45, 0.55]", slug: "nvda-above-1200" },
        { question: "Will Bitcoin hit $100k in March 2026?", volume: 45000000, liquidity: 12000000, outcomePrices: "[0.72, 0.28]", slug: "btc-100k-mar-26" }
    ];
    updateGlobalStats();
    renderMain();
}

// --- ANALYTICS ---
function updateGlobalStats() {
    const mCount = document.getElementById('market-count');
    const fVal = document.getElementById('flow-val');
    
    if (mCount) {
        mCount.innerText = appState.markets.length;
        mCount.classList.add('active-val');
    }
    
    if (fVal) {
        const total = appState.markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
        fVal.innerText = `$${(total/1000000).toFixed(1)}M`;
        fVal.classList.add('active-val');
    }
}

// --- RENDER ENGINE ---
function renderMain() {
    const grid = document.getElementById('shard-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // VIEW ROUTING
    switch(appState.activeTab) {
        case 'TRADE':
            renderTradeView(grid);
            break;
        case 'STATS':
            renderStatsView(grid);
            break;
        case 'COPY':
            renderComingSoon(grid, 'Copy Trading');
            break;
        case 'LIGHTNING':
            renderComingSoon(grid, 'Lightning Node');
            break;
        default:
            renderTerminal(grid);
    }
}

function renderTerminal(container) {
    const filtered = appState.markets.filter(m => m.question.toLowerCase().includes(appState.search));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">ZERO SHARDS MATCHED "${appState.search.toUpperCase()}"</div>`;
        return;
    }

    filtered.forEach((m, idx) => {
        let p = [0.5, 0.5];
        try { p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.prices; } catch(e) {}
        
        const y = (parseFloat(p[0] || 0.5) * 100).toFixed(1);
        const n = (parseFloat(p[1] || 0.5) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'market-row';
        card.style.cssText = `
            background: #111b1d;
            border: 0.5px solid rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            animation: fadeIn 0.3s ease-out ${idx * 0.03}s forwards;
            opacity: 0;
        `;
        
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px; color: #fff;">${m.question}</div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase;">
                    VOL: $${(m.volume/1000000).toFixed(1)}M | LIQ: $${(m.liquidity/1000).toFixed(0)}K
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="buy-btn yes">YES ${y}¢</a>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="buy-btn no">NO ${n}¢</a>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderTradeView(container) {
    container.innerHTML = `
        <div style="padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚡</div>
            <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px;">ADVANCED TRADE EXECUTION</h2>
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; max-width: 400px; margin: 0 auto;">
                Direct smart contract interactions and limit orders are currently being audited. Flow synchronization pending.
            </p>
        </div>
    `;
}

function renderStatsView(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px;">
            <div style="background: #111b1d; padding: 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label">Winning Prob (Avg)</span>
                <span class="stat-val active-val" style="font-size: 24px;">64.2%</span>
            </div>
            <div style="background: #111b1d; padding: 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label">Alpha Shards Active</span>
                <span class="stat-val active-val" style="font-size: 24px;">1,244</span>
            </div>
            <div style="background: #111b1d; padding: 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label">Global Vol (24h)</span>
                <span class="stat-val active-val" style="font-size: 24px;">$1.2B</span>
            </div>
        </div>
    `;
}

function renderComingSoon(container, title) {
    container.innerHTML = `<div class="empty-state" style="padding-top: 50px;">SECTION [${title.toUpperCase()}] UNDER CONSTRUCTION...</div>`;
}
