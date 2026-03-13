/**
 * PolyAlpha Quant Terminal Engine
 * Based on "100,000 Trades Analysis" Research
 */

const CONFIG = {
    API_BASE: 'https://gamma-api.polymarket.com',
    PROXY: 'https://api.allorigins.win/raw?url=',
    REFRESH_RATE: 30000
};

let state = {
    markets: [],
    selectedMarket: null,
    searchQuery: '',
    charts: {},
    signals: {
        flow: 0,
        imbalance: 0,
        gap: 0
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEvents();
});

async function init() {
    await fetchMarkets();
    if (state.markets.length > 0) {
        selectMarket(state.markets[0].slug);
    }
}

function setupEvents() {
    document.getElementById('refreshBtn').addEventListener('click', () => init());
    document.getElementById('marketSearch').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderMarketList();
    });
}

async function fetchMarkets() {
    try {
        const url = `${CONFIG.PROXY}${encodeURIComponent(`${CONFIG.API_BASE}/markets?active=true&closed=false&limit=30&order=volume&dir=desc`)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        state.markets = data.map(m => ({
            id: m.id,
            question: m.question,
            slug: m.slug,
            volume: parseFloat(m.volume) || 0,
            liquidity: parseFloat(m.liquidity) || 0,
            price: m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : (m.prices ? m.prices[0] : 0.5),
            raw: m
        }));

        updateGlobalMetrics();
        renderMarketList();
    } catch (error) {
        console.error("Failed to fetch markets:", error);
    }
}

function updateGlobalMetrics() {
    const totalVol = state.markets.reduce((acc, m) => acc + m.volume, 0);
    document.getElementById('totalVol').innerText = `$${(totalVol / 1000000).toFixed(2)}M`;
    document.getElementById('marketCount').innerText = state.markets.length;
}

function renderMarketList() {
    const container = document.getElementById('marketList');
    container.innerHTML = '';

    const filtered = state.markets.filter(m => m.question.toLowerCase().includes(state.searchQuery));

    filtered.forEach(m => {
        const div = document.createElement('div');
        div.className = `market-item ${state.selectedMarket?.slug === m.slug ? 'active' : ''}`;
        div.onclick = () => selectMarket(m.slug);
        div.innerHTML = `
            <div class="m-question">${m.question}</div>
            <div class="m-meta">
                <span>VOL: $${(m.volume / 1000).toFixed(0)}K</span>
                <span class="price">${(m.price * 100).toFixed(1)}¢</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function selectMarket(slug) {
    state.selectedMarket = state.markets.find(m => m.slug === slug);
    renderMarketList();
    runQuantAnalysis();
}

/**
 * QUANT ENGINE - Article Logic Implemetation
 */
function runQuantAnalysis() {
    if (!state.selectedMarket) return;

    const m = state.selectedMarket;
    const signals = generateSignals(m);
    
    // Update Stats
    document.getElementById('signal-flow').innerText = signals.flow.toFixed(2);
    document.getElementById('signal-imbalance').innerText = `${(signals.imbalance * 100).toFixed(1)}%`;
    document.getElementById('signal-gap').innerText = `${(signals.gap * 100).toFixed(1)}%`;

    renderCharts(signals);
}

function generateSignals(m) {
    // Seeded random for demo purposes based on market data to simulate real-time signals
    const seed = m.volume + m.liquidity;
    const seededRandom = (s) => (Math.sin(seed + s) * 0.5 + 0.5);

    // 1. Signed Trade Flow (Accumulated net flow)
    const flow = (seededRandom(1) - 0.45) * 5000;

    // 2. Order Book Imbalance (Qbid - Qask) / (Qbid + Qask)
    const imbalance = seededRandom(2) - 0.5;

    // 3. Calibration Gap (α)
    const gap = (seededRandom(3) - 0.5) * 0.15;

    // 4. Drift Data (Δp)
    const driftMarket = [m.price * 100, (m.price + 0.02) * 100, (m.price + 0.05) * 100, (m.price + 0.08) * 100];
    const driftModel = driftMarket.map(p => p + (seededRandom(4) * 5));

    // 5. Liquidity Data
    const spread = [0.01, 0.015, 0.02, 0.012, 0.01, 0.03, 0.02];
    const vol = spread.map(s => s * (1 + seededRandom(5)));

    return {
        flow, imbalance, gap,
        drift: { labels: ['Now', '5m', '15m', '60m'], market: driftMarket, model: driftModel },
        liquidity: { labels: ['10h', '11h', '12h', '13h', '14h', '15h', '16h'], spread, vol },
        zscores: [seededRandom(6)*3, seededRandom(7)*-2, seededRandom(8)*4, seededRandom(9)*1.5, seededRandom(10)*-1]
    };
}

function renderCharts(signals) {
    // Destroy old charts
    Object.values(state.charts).forEach(c => c.destroy());

    // 1. Drift Chart
    state.charts.drift = new Chart(document.getElementById('driftChart'), {
        type: 'line',
        data: {
            labels: signals.drift.labels,
            datasets: [
                { label: 'Market Implied', data: signals.drift.market, borderColor: '#cbd5e1', tension: 0.4, borderDash: [5,5] },
                { label: 'PolyAlpha Model', data: signals.drift.model, borderColor: '#635bff', tension: 0.4, fill: true, backgroundColor: 'rgba(99, 91, 255, 0.05)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 6, font: { size: 10 } } } },
            scales: { y: { grid: { borderDash: [2, 2] } } }
        }
    });

    // 2. Liquidity Chart
    state.charts.liquidity = new Chart(document.getElementById('liquidityChart'), {
        type: 'bar',
        data: {
            labels: signals.liquidity.labels,
            datasets: [
                { label: 'Spread Regime', data: signals.liquidity.spread, backgroundColor: '#00d924', borderRadius: 4 },
                { label: 'Intensity', data: signals.liquidity.vol, type: 'line', borderColor: '#ffb800', tension: 0.4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false } }
        }
    });

    // 3. Z-Score Heatmap
    state.charts.zscore = new Chart(document.getElementById('zscoreChart'), {
        type: 'bar',
        data: {
            labels: ['Flow', 'Size', 'Imbalance', 'Volatility', 'Calibration'],
            datasets: [{
                label: 'Z-Score Strength',
                data: signals.zscores,
                backgroundColor: signals.zscores.map(v => v > 2 || v < -2 ? '#ff3b30' : (v > 1 || v < -1 ? '#ffb800' : '#635bff')),
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                annotation: {
                  annotations: {
                    line1: { type: 'line', xMin: 2, xMax: 2, borderColor: 'rgba(255, 59, 48, 0.3)', borderDash: [5, 5], borderWidth: 1 },
                    line2: { type: 'line', xMin: -2, xMax: -2, borderColor: 'rgba(255, 59, 48, 0.3)', borderDash: [5, 5], borderWidth: 1 }
                  }
                }
            },
            scales: { x: { min: -4, max: 4, grid: { borderDash: [2, 2] } } }
        }
    });
}
