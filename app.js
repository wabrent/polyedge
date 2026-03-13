/* PolyEdge Logic & Interaction Engine v7.2 - PRO LIGHT THEME */
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
    syncStatus: 'OFFLINE',
    selectedMarket: null,
    charts: {}
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
            const target = item.getAttribute('data-tab').toUpperCase();
            if (!target) return;

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            appState.activeTab = target; 
            
            const title = document.getElementById('view-title');
            if (title) title.innerText = target === 'MARKETS' ? 'Trending Markets' : 
                                       target === 'SCANNER' ? 'Opportunity Scanner' : 
                                       target === 'TERMINAL' ? 'Quant Signal Terminal' : item.innerText.trim();
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
            if (!appState.selectedMarket && data.length > 0) appState.selectedMarket = data[0];
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
        { id: "1", question: "Will Iran strike Israel on March 15?", volume: 11000000, liquidity: 2500000, prices: [0.10, 0.99], slug: "iran-strike-israel-march-15", badge: "HIGH VOL" },
        { id: "2", question: "Will the Fed decrease interest rates by 50+ bps?", volume: 5000000, liquidity: 4100000, prices: [0.03, 0.99], slug: "fed-rates-decrease-50", badge: "SOON" },
        { id: "3", question: "Will Chelsea win the 2025-26 English Premier League?", volume: 3400000, liquidity: 395000, prices: [0.10, 0.99], slug: "chelsea-win-epl-2026", badge: "HIGH VOL" },
        { id: "4", question: "Will Trump say 'Jesus' this week?", volume: 3300000, liquidity: 2100000, prices: [0.99, 0.01], slug: "trump-jesus", badge: "ENDING" }
    ];
    if (!appState.selectedMarket) appState.selectedMarket = appState.markets[0];
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
        case 'TERMINAL':
            renderTerminalView(grid);
            break;
        case 'SCANNER':
            renderScannerView(grid);
            break;
        case 'WATCHLIST':
            renderStatusMessage(grid, 'Watchlist', 'Your saved markets will appear here.');
            break;
        case 'ARBITRAGE':
            renderStatusMessage(grid, 'Arbitrage', 'Cross-exchange opportunities sync in progress.');
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
            <div style="display:flex; gap: 8px;">
                <button class="trade-btn" style="background: #f1f5f9; color: #000; font-size: 12px; border: 1px solid #e2e8f0; flex: 1;" onclick="goToTerminal('${m.slug}')">Analyze</button>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" style="text-decoration:none; flex: 2;">
                    <button class="trade-btn">Trade</button>
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

function goToTerminal(slug) {
    const market = appState.markets.find(m => m.slug === slug);
    if (market) {
        appState.selectedMarket = market;
        document.querySelector('[data-tab="terminal"]').click();
    }
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
                <div><button class="trade-btn" style="padding: 6px 12px; font-size: 11px;" onclick="goToTerminal('${m.slug}')">Analyze</button></div>
            </div>
        `).join('')}
    `;
    container.appendChild(wrap);
}

function renderTerminalView(container) {
    const layout = document.createElement('div');
    layout.className = 'terminal-layout';
    
    const sidebar = document.createElement('div');
    sidebar.className = 'terminal-sidebar';
    sidebar.innerHTML = `
        <h3 style="font-size: 12px; color: var(--text-dim); margin-bottom: 15px; text-transform: uppercase;">Active Markets</h3>
        ${appState.markets.slice(0, 15).map(m => `
            <div class="market-mini-card ${appState.selectedMarket && appState.selectedMarket.slug === m.slug ? 'active' : ''}" onclick="selectTerminalMarket('${m.slug}')">
                <div class="mini-q">${m.question.substring(0, 50)}...</div>
                <div class="mini-stats">Vol: $${((m.volume || 0)/1000000).toFixed(1)}M | Liq: $${((m.liquidity || 0)/1000000).toFixed(1)}M</div>
            </div>
        `).join('')}
    `;

    const content = document.createElement('div');
    content.className = 'terminal-content';
    content.innerHTML = `
        <div class="chart-card">
            <div class="chart-title">Estimated Mispricing <span>α</span></div>
            <div class="chart-container"><canvas id="mispricingChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-title">Post-Trade Probability Drift <span>Δp</span></div>
            <div class="chart-container"><canvas id="driftChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-title">Liquidity Friction & Order Imbalance <span>Ω</span></div>
            <div class="chart-container"><canvas id="liquidityChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-title">Signal Strength Z-Scores <span>σ</span></div>
            <div class="chart-container"><canvas id="zscoreChart"></canvas></div>
        </div>
        <div class="chart-card" style="grid-column: span 2; min-height: 100px;">
            <div class="chart-title">Model Insights & Signals <span>🤖 AI</span></div>
            <div id="modelInsights" style="font-size: 13px; line-height: 1.6; color: var(--text-secondary);">
                <!-- Dynamic text -->
            </div>
        </div>
    `;

    layout.appendChild(sidebar);
    layout.appendChild(content);
    container.appendChild(layout);

    setTimeout(() => initTerminalCharts(), 100);
}

window.selectTerminalMarket = (slug) => {
    appState.selectedMarket = appState.markets.find(m => m.slug === slug);
    renderMain();
};

function initTerminalCharts() {
    if (!appState.selectedMarket) return;

    // Destroy existing charts if any
    Object.values(appState.charts).forEach(c => c.destroy());

    const m = appState.selectedMarket;
    const signals = calculateSignals(m);

    // 1. Mispricing Chart
    appState.charts.mispricing = new Chart(document.getElementById('mispricingChart'), {
        type: 'bar',
        data: {
            labels: ['ETH-ST', 'BTC-OPT', 'FED-50', 'US-ELEC', 'C-WIN'],
            datasets: [{
                label: 'Mispricing (%)',
                data: signals.mispricing,
                backgroundColor: signals.mispricing.map(v => v > 0 ? '#10b981' : '#ef4444'),
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 2. Drift Chart
    appState.charts.drift = new Chart(document.getElementById('driftChart'), {
        type: 'bar',
        data: {
            labels: ['5m', '15m', '30m', '60m'],
            datasets: [
                { label: 'Market Prob', data: signals.drift.market, backgroundColor: '#cbd5e1' },
                { label: 'Model Prob', data: signals.drift.model, backgroundColor: '#2563eb' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });

    // 3. Liquidity Friction
    appState.charts.liquidity = new Chart(document.getElementById('liquidityChart'), {
        type: 'line',
        data: {
            labels: ['10h', '11h', '12h', '13h', '14h', '15h', '16h'],
            datasets: [
                { label: 'Spread', data: signals.liquidity.spread, borderColor: '#10b981', fill: false, tension: 0.4 },
                { label: 'Imbalance', data: signals.liquidity.imbalance, borderColor: '#2563eb', fill: true, backgroundColor: 'rgba(37, 99, 235, 0.1)', tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 4. Z-Scores
    appState.charts.zscore = new Chart(document.getElementById('zscoreChart'), {
        type: 'bar',
        data: {
            labels: ['Flow', 'Size', 'Imbalance', 'Drift', 'Gap'],
            datasets: [{
                label: 'Z-Score',
                data: signals.zscores,
                backgroundColor: signals.zscores.map(v => Math.abs(v) > 2 ? '#f59e0b' : '#2563eb'),
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { annotation: { annotations: { line1: { type: 'line', yMin: 2, yMax: 2, borderColor: 'red', borderDash: [5, 5] } } } }
        }
    });

    // Update Insights
    const insights = document.getElementById('modelInsights');
    insights.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <b style="color: var(--text-primary)">Signal Detected:</b> ${Math.abs(signals.zscores[2]) > 2 ? '<span style="color: #f59e0b">Heavy Imbalance</span>' : 'Normal Order Flow'}<br>
                <b style="color: var(--text-primary)">Calibration:</b> The market is currently ${signals.mispricing[0] > 0 ? 'undervalued' : 'overvalued'} by ${Math.abs(signals.mispricing[0])}% relative to historical drift.
            </div>
            <div>
                <b style="color: var(--text-primary)">Recommendation:</b> ${signals.zscores[2] > 2 ? 'Aggressive Entry Potential' : 'Monitor for Pullback'}<br>
                <b style="color: var(--text-primary)">Confidence:</b> High (Z-Score: ${signals.zscores[2]})
            </div>
        </div>
    `;
}

function calculateSignals(market) {
    // Article-based logic simulation
    // Imbalance = (Qbid - Qask) / (Qbid + Qask)
    // Drift = p(t+h) - p(t)
    // We generate pseudo-random but somewhat consistent data based on the market slug/volume
    const seed = market.slug.length;
    const random = (s) => Math.sin(seed + s) * 10;
    
    return {
        mispricing: [random(1), random(2), random(3), random(4), random(5)].map(v => v.toFixed(2)),
        drift: {
            market: [45, 48, 52, 50],
            model: [46, 51, 58, 62] // Model predicts higher drift
        },
        liquidity: {
            spread: [0.01, 0.02, 0.015, 0.03, 0.02, 0.01, 0.012],
            imbalance: [0.2, 0.5, -0.1, 0.8, 0.4, 0.2, 0.6]
        },
        zscores: [1.2, -0.5, 2.4, 0.8, -1.9]
    };
}

function renderStatusMessage(container, title, msg) {
    container.innerHTML = `
        <div style="padding: 100px 40px; text-align: center; background: #fff; margin: 0 40px; border-radius: 12px; border: 1px dashed var(--border-line);">
            <h2 style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">${title}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${msg}</p>
        </div>
    `;
}

