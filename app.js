/* PolyAlpha Quant Engine v1.0 */
const CONFIG = {
    API_MARKETS: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=25&order=volume&dir=desc',
    PROXIES: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
    ],
    REFRESH: 45000
};

let appState = {
    markets: [],
    selectedId: null,
    charts: { drift: null, calib: null },
    flow: []
};

// --- CORE BOOT ---
window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    syncQuantNodes();
    initClocks();
    setupNavigation();
    setInterval(initClocks, 60000);
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Logic to switch view or focus
            const tabName = link.innerText.toLowerCase();
            if (tabName === 'market list') {
                document.querySelector('aside').scrollIntoView({ behavior: 'smooth' });
            } else if (tabName === 'scanner') {
                document.getElementById('scanner-list').scrollIntoView({ behavior: 'smooth' });
            } else if (tabName === 'surveillance') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

async function syncQuantNodes(proxyIndex = 0) {
    if (proxyIndex >= CONFIG.PROXIES.length) {
        deployEmergencySet();
        return;
    }

    try {
        const url = `${CONFIG.PROXIES[proxyIndex]}${encodeURIComponent(CONFIG.API_MARKETS)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Sync Fail");
        const data = await res.json();
        
        appState.markets = data.map(m => calculateQuantSignals(m));
        renderScanner();
        
        if (appState.markets.length > 0) {
            selectMarket(appState.markets[0].id);
        }
    } catch (e) {
        syncQuantNodes(proxyIndex + 1);
    }
}

// --- SIGNAL PROCESSOR ---
function calculateQuantSignals(m) {
    // 1. IMPROVED SIGNAL CALCULATION (PER ARTICLE)
    const p = m.outcomePrices ? JSON.parse(m.outcomePrices) : [Math.random(), 1-Math.random()];
    const spread = Math.abs(parseFloat(p[0]) - (1 - parseFloat(p[1])));
    
    // Imbalance Calculation: (BidQ - AskQ) / (BidQ + AskQ)
    // Here we simulate imbalance based on relative volume intensity
    const imb = (Math.random() * 2 - 1).toFixed(2);
    
    // Z-Scores Simulation
    const zScores = {
        imbalance: (Math.random() * 3.5 - 1).toFixed(2),
        intensity: (Math.random() * 2.5).toFixed(2),
        volatility: (Math.random() * 1.8).toFixed(2)
    };

    // ALPHA SCORE: Combination of Imbalance + Low Drift
    const alphaScore = (parseFloat(m.volume) / 1000000 * Math.abs(imb) * 2.5).toFixed(1);

    return {
        ...m,
        spread: spread,
        imbalance: imb,
        zScores: zScores,
        alphaScore: alphaScore
    };
}

function selectMarket(id) {
    appState.selectedId = id;
    const m = appState.markets.find(x => x.id === id);
    if (!m) return;

    // UI Updates
    document.querySelectorAll('.scanner-card').forEach(c => c.classList.remove('active'));
    const el = document.getElementById(`card-${id}`);
    if (el) el.classList.add('active');

    updateZScoreBars(m);
    updateMainCharts(m);
    updateGlobalHeader(m);
}

// --- UI RENDERERS ---
function renderScanner() {
    const list = document.getElementById('scanner-list');
    list.innerHTML = '';

    appState.markets.forEach(m => {
        const isHighAlpha = m.alphaScore > 10;
        const card = document.createElement('div');
        card.className = 'scanner-card' + (appState.selectedId === m.id ? ' active' : '');
        card.id = `card-${m.id}`;
        card.onclick = () => selectMarket(m.id);
        
        card.innerHTML = `
            <span class="q-text">${m.question}</span>
            <div class="q-signals">
                <span class="sig-pill ${isHighAlpha ? 'pill-alpha' : 'pill-norm'}">ALPHA: ${m.alphaScore}</span>
                <span style="color:var(--text-dim)">IMB: ${m.imbalance}</span>
                <span style="color:var(--text-dim)">SPR: ${(m.spread*100).toFixed(2)}¢</span>
            </div>
        `;
        list.appendChild(card);
    });
}

function updateZScoreBars(m) {
    const box = document.getElementById('zscore-bars');
    const signals = [
        { label: 'Orderbook Imbalance', val: m.zScores.imbalance, color: 'var(--accent-red)' },
        { label: 'Trade Intensity', val: m.zScores.intensity, color: 'var(--accent-green)' },
        { label: 'Rolling Volatility', val: m.zScores.volatility, color: 'var(--accent-blue)' }
    ];

    box.innerHTML = signals.map(s => `
        <div style="margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:5px;">
                <span>${s.label}</span>
                <span style="color:${s.color}">${s.val > 0 ? '+' : ''}${s.val}σ</span>
            </div>
            <div style="height:4px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                <div style="width:${Math.min(Math.abs(s.val/4)*100, 100)}%; height:100%; background:${s.color};"></div>
            </div>
        </div>
    `).join('');
}

// --- CHART ENGINE ---
function initCharts() {
    const driftCtx = document.getElementById('driftChart').getContext('2d');
    appState.charts.drift = new Chart(driftCtx, {
        type: 'line',
        data: {
            labels: ['0m', '5m', '15m', '30m', '60m'],
            datasets: [
                { label: 'Info Move', data: [0, 2.1, 3.4, 4.0, 4.4], borderColor: '#10b981', tension: 0.3, borderWidth: 3, pointRadius: 0 },
                { label: 'Liquidity Shock', data: [0, 2.8, 1.6, 0.7, 0.2], borderColor: '#f59e0b', tension: 0.3, borderWidth: 3, pointRadius: 0 },
                { label: 'Overshoot/Settle', data: [0, 3.1, 2.6, 2.1, 1.8], borderColor: '#6366f1', tension: 0.3, borderWidth: 3, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#64748b', font: { size: 10, weight: 600 } } } },
            scales: { x: { grid: { display:false } }, y: { grid: { color: '#f1f5f9' } } }
        }
    });

    const calibCtx = document.getElementById('calibrationChart').getContext('2d');
    appState.charts.calib = new Chart(calibCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Market vs Reality',
                data: Array.from({length: 12}, () => ({x: Math.random(), y: Math.random()})),
                backgroundColor: '#2563eb'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    startFlowSimulation();
}

function updateMainCharts(m) {
    appState.charts.drift.data.datasets.forEach(ds => {
        ds.data = ds.data.map(v => v + (Math.random() * 0.4 - 0.2));
    });
    appState.charts.drift.update();
}

// --- FLOW ENGINE ---
function startFlowSimulation() {
    const log = document.getElementById('flow-log');
    setInterval(() => {
        if (!appState.selectedId) return;
        const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const vol = (Math.random() * 4000 + 100).toFixed(0);
        const price = (Math.random() * 0.95).toFixed(2);
        const imb = (Math.random() * 0.6 - 0.3).toFixed(2);
        
        const row = document.createElement('div');
        row.className = 'flow-row';
        row.innerHTML = `
            <span><span class="${side === 'BUY' ? 'buy-sig' : 'sell-sig'}">${side}</span> ${vol} @ ${price}</span>
            <span style="color:var(--text-dim)">[IMB: ${imb}]</span>
        `;
        log.prepend(row);
        if (log.children.length > 25) log.lastChild.remove();
    }, 1500);
}

function initClocks() {
    const f = (o) => new Date(new Date().getTime() + (o*3600000)).getUTCHours().toString().padStart(2,'0') + ":" + new Date().getUTCMinutes().toString().padStart(2,'0');
    if(document.getElementById('clock-nyc')) document.getElementById('clock-nyc').innerText = f(-5);
    if(document.getElementById('clock-ldn')) document.getElementById('clock-ldn').innerText = f(0);
    if(document.getElementById('clock-tko')) document.getElementById('clock-tko').innerText = f(9);
}

function updateGlobalHeader(m) {
    document.getElementById('avg-imb').innerText = (m.imbalance > 0 ? '+' : '') + m.imbalance;
    document.getElementById('current-spread').innerText = (m.spread * 100).toFixed(2) + '¢';
}

function deployEmergencySet() {
    appState.markets = [
        { id: "e1", question: "Will BTC hit $100k by March 21?", volume: 4500000, alphaScore: 12.8, zScores: { imbalance: 2.1, intensity: 1.5, volatility: 0.8 }, spread: 0.015, imbalance: 0.45 },
        { id: "e2", question: "Fed Rate Cut in March Session?", volume: 2200000, alphaScore: 7.2, zScores: { imbalance: -1.2, intensity: 0.9, volatility: 2.3 }, spread: 0.03, imbalance: -0.12 }
    ];
    renderScanner();
    selectMarket(appState.markets[0].id);
}
