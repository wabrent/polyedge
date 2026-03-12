/**
 * PolyEdge - Risk Navigator Engine v1.0
 * Logic based on Python package provided by USER.
 */

const CONFIG = {
    // Using Gamma API as it's the current standard for Polymarket
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=40&order=volume&dir=desc',
    REFRESH_RATE: 30000 // 30s
};

let state = {
    markets: [],
    signals: [],
    isAppLaunched: false
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initLaunch();
    initSimulations();
    
    // Check if hash exists to skip landing
    if (window.location.hash === '#active') {
        launchApp();
    }
});

// --- 1. USER AUTH & LAUNCH FLOW ---
function initLaunch() {
    const launchBtn = document.getElementById('launchBtn');
    if (launchBtn) {
        launchBtn.onclick = () => {
            launchApp();
        }
    }
}

function launchApp() {
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    
    landing.classList.add('fade-out');
    window.location.hash = '#active';
    
    setTimeout(() => {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('fade-in');
        state.isAppLaunched = true;
        fetchData();
    }, 500);
}

// --- 2. ANALYTICS ENGINE (Translating User's Python Logic) ---
function analyzeMarket(market) {
    // Extract probability from prices (outcomePrices[0] is typically YES)
    let prices = [0.5, 0.5];
    if (market.outcomePrices) {
        prices = (typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices).map(Number);
    }
    
    const probability = prices[0] || 0.5;
    
    // USER'S LOGIC: probability - 0.1
    const hiddenTrend = probability - 0.1;
    
    // USER'S LOGIC: HIGH RISK if < 0.5 else OPPORTUNITY
    const signal = hiddenTrend < 0.5 ? "HIGH RISK" : "OPPORTUNITY";
    
    return {
        id: market.id,
        name: market.question || market.name || "Unknown Event",
        signal: signal,
        prob: (probability * 100).toFixed(1),
        trend: hiddenTrend,
        vol: market.volume || 0,
        slug: market.slug
    };
}

// --- 3. DATA ACQUISITION ---
async function fetchData() {
    try {
        const response = await fetch(CONFIG.API_URL);
        const data = await response.json();
        
        state.markets = data;
        state.signals = data.map(m => analyzeMarket(m));
        
        renderOverview();
        generateAlerts();
    } catch (e) {
        console.warn("API Node Shard Offline. Using fallback forensics.");
        deployFallback();
    }
}

// --- 4. UI RENDERING ---
function renderOverview() {
    const list = document.getElementById('market-list');
    const count = document.getElementById('target-count');
    if (!list) return;

    count.innerText = `Targets: ${state.signals.length}`;
    list.innerHTML = '';

    state.signals.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'market-item animate-fadeInUp';
        item.style.animationDelay = `${i * 0.05}s`;
        
        const signalStyle = s.signal === 'OPPORTUNITY' ? 'pill-signal-opp' : 'pill-signal-high';
        
        item.innerHTML = `
            <div class="market-info">
                <h3 class="truncate" title="${s.name}">${s.name}</h3>
                <div class="market-pills">
                    <span class="pill pill-prob">${s.prob}% Prob</span>
                    <span class="pill ${signalStyle}">${s.signal}</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-dim uppercase">Trend</div>
                <div class="text-xs font-bold ${s.signal === 'OPPORTUNITY' ? 'text-green-400' : 'text-accent'}">
                    ${s.trend.toFixed(2)}
                </div>
            </div>
        `;
        
        item.onclick = () => {
            if (s.slug && s.slug !== '#') {
                window.open(`https://polymarket.com/market/${s.slug}`, '_blank');
            }
        };
        
        list.appendChild(item);
    });
}

function generateAlerts() {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    // Filter opportunities
    const opps = state.signals.filter(s => s.signal === 'OPPORTUNITY').slice(0, 5);
    
    if (opps.length > 0) {
        container.innerHTML = '';
        opps.forEach(o => {
            const alert = document.createElement('div');
            alert.className = 'alert-item';
            alert.innerHTML = `
                <span class="alert-time">${new Date().toLocaleTimeString()}</span>
                <div class="alert-content">Insight: <b>${o.name}</b> detected as a high-value signal.</div>
            `;
            container.appendChild(alert);
        });
    }
}

// --- 5. VISUAL SIMULATIONS (Heatmap & Charts) ---
function initSimulations() {
    // Heatmap
    const heatmap = document.getElementById('heatmap');
    if (heatmap) {
        for (let i = 0; i < 49; i++) {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            const intensity = Math.random();
            cell.style.backgroundColor = `rgba(255, 61, 0, ${intensity * 0.5})`;
            if (intensity > 0.8) cell.style.border = '1px solid rgba(255, 61, 0, 0.5)';
            heatmap.appendChild(cell);
        }
    }

    // Charts
    const charts = document.getElementById('charts-bars');
    if (charts) {
        for (let i = 0; i < 12; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            const height = 20 + Math.random() * 80;
            bar.style.height = `${height}%`;
            bar.style.opacity = 0.3 + Math.random() * 0.7;
            charts.appendChild(bar);
        }
    }
}

function deployFallback() {
    const dummy = [
        { question: "Fed Rate Cut in March?", volume: 1000000, outcomePrices: [0.65, 0.35] },
        { question: "BTC Above $100k?", volume: 5000000, outcomePrices: [0.85, 0.15] },
        { question: "US GDP Growth Exceeds 3%?", volume: 200000, outcomePrices: [0.3, 0.7] }
    ];
    state.markets = dummy;
    state.signals = dummy.map(m => analyzeMarket(m));
    renderOverview();
    generateAlerts();
}
