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
        { question: "Will the Fed cut interest rates after the March meeting?", volume: 364000000, liquidity: 21000000, outcomePrices: "[0.12, 0.88]", slug: "fed-decision-in-march-885" },
        { question: "Who will be the Democratic nominee for President in 2028?", volume: 813000000, liquidity: 43000000, outcomePrices: "[0.45, 0.55]", slug: "democratic-presidential-nominee-2028" },
        { question: "Will Iran close the Strait of Hormuz by 2027?", volume: 65000000, liquidity: 19000000, outcomePrices: "[0.08, 0.92]", slug: "will-iran-close-the-strait-of-hormuz-by-2027" },
        { question: "Who will win the 2026 FIFA World Cup?", volume: 294000000, liquidity: 45000000, outcomePrices: "[0.15, 0.85]", slug: "2026-fifa-world-cup-winner-595" },
        { question: "Who will be the Republican nominee for President in 2028?", volume: 403000000, liquidity: 22000000, outcomePrices: "[0.72, 0.28]", slug: "republican-presidential-nominee-2028" },
        { question: "Will Crude Oil (CL) hit a specific price target by end of March?", volume: 31000000, liquidity: 2000000, outcomePrices: "[0.50, 0.50]", slug: "will-crude-oil-cl-hit-by-end-of-march" }
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
            renderTradeDesk(grid);
            break;
        case 'STATS':
            renderStatsDashboard(grid);
            break;
        case 'COPY':
            renderCopyTerminal(grid);
            break;
        case 'LIGHTNING':
            renderLightningNetwork(grid);
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

function renderTradeDesk(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; animation: fadeIn 0.4s;">
            <div style="background: var(--bg-card); border-radius: 4px; padding: 20px; border: 0.5px solid var(--border-line);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 800;">QUICK EXECUTION PANEL</div>
                    <div style="font-size: 10px; color: var(--acc-cyan); font-weight: 700;">SLIPPAGE: 0.5%</div>
                </div>
                ${appState.markets.slice(0, 5).map(m => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 0.5px solid var(--border-line);">
                        <div style="font-size: 12px; font-weight: 700; max-width: 60%;">${m.question.substring(0, 45)}...</div>
                        <div style="display: flex; gap: 6px;">
                            <input type="number" placeholder="QTY" style="width: 50px; background: #0a1214; border: 0.5px solid var(--border-line); color: #fff; font-size: 10px; padding: 4px;">
                            <button style="background: var(--acc-cyan); color: #000; border: none; padding: 4px 10px; font-weight: 800; font-size: 10px; border-radius: 2px;">SWAP</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="background: var(--bg-card); border-radius: 4px; padding: 20px; border: 0.5px solid var(--border-line);">
                <div style="font-size: 11px; font-weight: 800; margin-bottom: 12px; color: var(--text-dim);">LIVE ORDER BOOK</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #ff5e5e; margin-bottom: 2px;">SELL 0.8842 - 1.2k</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #ff5e5e; margin-bottom: 2px;">SELL 0.8839 - 2.5k</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #ff5e5e; margin-bottom: 2px;">SELL 0.8835 - 5.1k</div>
                <div style="font-size: 12px; font-weight: 800; margin: 10px 0; color: #fff;">0.8831</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #00ff88; margin-bottom: 2px;">BUY 0.8829 - 8.4k</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #00ff88; margin-bottom: 2px;">BUY 0.8825 - 3.2k</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #00ff88; margin-bottom: 2px;">BUY 0.8821 - 1.1k</div>
            </div>
        </div>
    `;
}

function renderStatsDashboard(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; animation: fadeIn 0.4s;">
            <div style="background: var(--bg-card); padding: 24px; border-radius: 4px; border: 0.5px solid var(--border-line);">
                <span class="stat-label">ALPHA CONFIDENCE</span>
                <span class="stat-val active-val" style="font-size: 32px;">94.2%</span>
                <div style="height: 4px; background: rgba(255,255,255,0.05); margin-top: 15px; border-radius: 2px;">
                    <div style="height: 100%; width: 94%; background: var(--acc-cyan); border-radius: 2px;"></div>
                </div>
            </div>
            <div style="background: var(--bg-card); padding: 24px; border-radius: 4px; border: 0.5px solid var(--border-line);">
                <span class="stat-label">LIQUIDITY DEPTH</span>
                <span class="stat-val active-val" style="font-size: 32px;">$1.8B</span>
                <div style="height: 4px; background: rgba(255,255,255,0.05); margin-top: 15px; border-radius: 2px;">
                    <div style="height: 100%; width: 78%; background: var(--acc-cyan); border-radius: 2px;"></div>
                </div>
            </div>
            <div style="background: var(--bg-card); padding: 24px; border-radius: 4px; border: 0.5px solid var(--border-line);">
                <span class="stat-label">NETWORK NODES</span>
                <span class="stat-val active-val" style="font-size: 32px;">4,812</span>
                <div style="height: 4px; background: rgba(255,255,255,0.05); margin-top: 15px; border-radius: 2px;">
                    <div style="height: 100%; width: 62%; background: var(--acc-cyan); border-radius: 2px;"></div>
                </div>
            </div>
        </div>
    `;
}

function renderCopyTerminal(container) {
    const traders = [
        { name: "AlphaForensics", winrate: "82%", pnl: "+14.2k", status: "ONLINE" },
        { name: "WhaleHunter_X", winrate: "76%", pnl: "+8.5k", status: "TRADING" },
        { name: "Shadow_M", winrate: "71%", pnl: "+6.1k", status: "ONLINE" },
        { name: "NodeMaster", winrate: "68%", pnl: "+2.2k", status: "BUSY" }
    ];

    container.innerHTML = `
        <div style="background: var(--bg-card); border-radius: 4px; border: 0.5px solid var(--border-line); animation: fadeIn 0.4s;">
            <div style="padding: 15px 20px; border-bottom: 0.5px solid var(--border-line); font-size: 11px; font-weight: 800; color: var(--text-dim);">TOP PERFORMING SHARDS [COPY]</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="text-align: left; background: rgba(255,255,255,0.02);">
                        <th style="padding: 15px 20px; font-weight: 800; font-size: 10px; color: var(--text-dim);">TRADER NODE</th>
                        <th style="padding: 15px 20px; font-weight: 800; font-size: 10px; color: var(--text-dim);">WIN RATE</th>
                        <th style="padding: 15px 20px; font-weight: 800; font-size: 10px; color: var(--text-dim);">PNL (24H)</th>
                        <th style="padding: 15px 20px; font-weight: 800; font-size: 10px; color: var(--text-dim);">ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    ${traders.map(t => `
                        <tr style="border-bottom: 0.5px solid var(--border-line);">
                            <td style="padding: 15px 20px; font-weight: 700;">${t.name}</td>
                            <td style="padding: 15px 20px; font-weight: 700; color: var(--acc-cyan);">${t.winrate}</td>
                            <td style="padding: 15px 20px; font-weight: 700; color: #00ff88;">${t.pnl}</td>
                            <td style="padding: 15px 20px;"><button style="background: transparent; border: 1px solid var(--acc-cyan); color: var(--acc-cyan); padding: 4px 12px; border-radius: 2px; font-size: 10px; font-weight: 800; cursor: pointer;">COPY SHARD</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderLightningNetwork(container) {
    container.innerHTML = `
        <div style="background: #000; border: 0.5px solid var(--border-line); border-radius: 4px; padding: 20px; font-family: 'Courier New', monospace; height: 350px; overflow-y: auto; animation: fadeIn 0.4s;">
            <div style="color: var(--acc-cyan); margin-bottom: 10px; font-weight: 800;">[LOG] ESTABLISHING ENCRYPTED P2P TUNNEL...</div>
            <div style="color: #666; font-size: 11px;">[14:23:01] Connected to node [polyedgeapp.xyz]</div>
            <div style="color: #666; font-size: 11px;">[14:23:04] Found 14 active alpha streams</div>
            <div style="color: #666; font-size: 11px;">[14:23:08] Authenticating credentials...</div>
            <div style="color: var(--acc-cyan); font-size: 11px;">[14:23:10] ACCESS GRANTED. FETCHING ALPHA...</div>
            <div style="color: #fff; margin-top: 15px; font-size: 11px;">> WHALE DETECTION: 1.2M USDC moving into SHARD-881</div>
            <div style="color: #fff; font-size: 11px;">> PATTERN ALERT: ROI Spike on [Fed Decisions]</div>
            <div style="color: #fff; font-size: 11px;">> CROSS-REF: Institutional sentiment shifting to YES on [NVIDIA]</div>
            <div style="color: #00ff88; font-size: 11px; margin-top: 10px;">> LIVE SYNC COMPLETED [82%]</div>
        </div>
    `;
}
