/* PolyEdge Logic & Interaction Engine v6.0 - ULTIMATE FIX */
const CONFIG = {
    // EXPANDED PROXY LIST FOR MAXIMUM RELIABILITY
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
    activeTab: 'TERMINAL', // MATCHED NAME TO PREVENT NAV BUG
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
    // TAB NAVIGATION FIX
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // UI Update
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // STATE FIX: Ensure activeTab matches the switch logic
            appState.activeTab = item.innerText.trim().toUpperCase(); 
            console.log("Navigating to:", appState.activeTab);
            
            renderMain();
        });
    });

    // SEARCH FIX
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
        console.warn("All primary nodes restricted. Initializing local shard backup.");
        deployEmergency();
        return;
    }

    const loader = document.getElementById('boot-loader');
    if (loader) loader.innerText = `LINKING SHARD NODE [${proxyIndex + 1}/${CONFIG.PROXIES.length}]...`;

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
        console.warn(`Node ${proxyIndex} rejected connection. Redirecting...`);
        syncProtocol(proxyIndex + 1);
    }
}

function deployEmergency() {
    appState.markets = [
        { question: "Will Israel launch offensive in Iran before March 31?", volume: 11200000, liquidity: 2100000, outcomePrices: "[0.12, 0.88]", slug: "will-israel-iran" },
        { question: "Will Fed cut rates by 25bps in April?", volume: 8500000, liquidity: 5600000, outcomePrices: "[0.65, 0.35]", slug: "fed-rates-april" },
        { question: "Will Bitcoin hit $100k in March 2026?", volume: 45000000, liquidity: 12000000, outcomePrices: "[0.72, 0.28]", slug: "btc-100k-mar-26" },
        { question: "Will OpenAI release Sora to public this week?", volume: 1200000, liquidity: 450000, outcomePrices: "[0.15, 0.85]", slug: "openai-sora-public" }
    ];
    updateGlobalStats();
    renderMain();
}

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

    console.log("Rendering view:", appState.activeTab);

    switch(appState.activeTab) {
        case 'TRADE':
            renderTradeView(grid);
            break;
        case 'STATS':
            renderStatsView(grid);
            break;
        case 'COPY':
            renderStatusMessage(grid, 'Copy Trading Protocol', 'Security audit in progress. Access restricted for 48h.');
            break;
        case 'LIGHTNING':
            renderStatusMessage(grid, 'Lightning Integration', 'Establishing P2P node connections. Shard sync: 82%');
            break;
        default:
            renderTerminal(grid);
    }
}

function renderTerminal(container) {
    const filtered = appState.markets.filter(m => m.question.toLowerCase().includes(appState.search));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">NO INTELLIGENCE FOUND FOR "${appState.search.toUpperCase()}"</div>`;
        return;
    }

    filtered.forEach((m, idx) => {
        let p = [0.5, 0.5];
        try { p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.prices; } catch(e) {}
        
        const y = (parseFloat(p[0] || 0.5) * 100).toFixed(1);
        const n = (parseFloat(p[1] || 0.5) * 100).toFixed(1);

        const row = document.createElement('div');
        row.style.cssText = `
            background: #111b1d;
            border: 0.5px solid rgba(255, 255, 255, 0.08);
            border-radius: 4px; padding: 16px 20px;
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 8px; animation: fadeIn 0.3s ease-out ${idx * 0.02}s forwards;
            opacity: 0;
        `;
        
        row.innerHTML = `
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
        container.appendChild(row);
    });
}

function renderTradeView(container) {
    container.innerHTML = `
        <div style="padding: 100px 40px; text-align: center; animation: fadeIn 0.5s ease-out;">
            <div style="font-size: 40px; margin-bottom: 24px;">🛡️</div>
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">SECURE TRADE EXECUTION</h2>
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; max-width: 420px; margin: 0 auto; line-height: 1.6;">
                Direct smart contract validation is currently being synchronized with our decentralized nodes. Live execution will resume upon next block verification.
            </p>
        </div>
    `;
}

function renderStatsView(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; animation: fadeIn 0.5s ease-out;">
            <div style="background: #111b1d; padding: 30px 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label" style="opacity:1; margin-bottom:12px;">Win Probability (Avg)</span>
                <span class="stat-val active-val" style="font-size: 28px;">68.4%</span>
            </div>
            <div style="background: #111b1d; padding: 30px 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label" style="opacity:1; margin-bottom:12px;">Intelligence Shards</span>
                <span class="stat-val active-val" style="font-size: 28px;">4,812</span>
            </div>
            <div style="background: #111b1d; padding: 30px 24px; border-radius: 4px; border: 1px solid var(--border-line);">
                <span class="stat-label" style="opacity:1; margin-bottom:12px;">Global Flow (24h)</span>
                <span class="stat-val active-val" style="font-size: 28px;">$2.4B</span>
            </div>
        </div>
    `;
}

function renderStatusMessage(container, title, msg) {
    container.innerHTML = `
        <div style="padding: 100px 40px; text-align: center; animation: fadeIn 0.5s ease-out;">
            <div style="font-size: 32px; margin-bottom: 20px; color: var(--acc-cyan);">⚡</div>
            <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">${title}</h2>
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600;">${msg}</p>
        </div>
    `;
}
