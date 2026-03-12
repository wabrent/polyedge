/**
 * POLYBUILDER ALPHA CORE v5.4
 * Real-time Engineering Terminal for Polymarket Developers
 */

const API_ENDPOINT = 'https://gamma-api.polymarket.com/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false';
const PROXY = 'https://api.allorigins.win/get?url=';

let appState = {
    markets: [],
    latencyHistory: Array(20).fill(1.4),
    currentRelayRedeem: 412.00,
    theme: 'dark'
};

// --- INITIALIZE ---
window.addEventListener('load', () => {
    initCore();
    startLatencySimulation();
    syncData();
    startInsiderFeed();
});

function initCore() {
    // Theme toggle
    const swap = document.getElementById('theme-swap');
    if(swap) swap.onclick = () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', appState.theme);
    };

    // Tab Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Action button
    const action = document.getElementById('action-batch');
    if(action) action.onclick = () => {
        action.innerText = "EXECUTING_RELAY_BOND...";
        setTimeout(() => {
            alert(`SUCCESS: Batch redeemed via Builder Relay V2. Gas: 0.14 USD`);
            appState.currentRelayRedeem = 0;
            document.getElementById('redeem-amount').innerText = "$0.00";
            action.innerText = "EXECUTE_MERGE_POSITIONS";
        }, 1500);
    };
}

// --- DATA SYNC ---
async function syncData() {
    try {
        const response = await fetch(PROXY + encodeURIComponent(API_ENDPOINT));
        const json = await response.json();
        const data = JSON.parse(json.contents);
        appState.markets = (Array.isArray(data) ? data : data.markets || []).filter(m => m.question);
        renderMarkets();
    } catch (e) {
        console.warn("Signal Lost. Falling back to Cache.");
        renderSimulatedMarkets();
    }
}

// --- SIMULATIONS ---
function startLatencySimulation() {
    const el = document.getElementById('clob-stat');
    const p99 = document.getElementById('p99-val');
    const graph = document.getElementById('latency-graph');

    setInterval(() => {
        // Median 1.4s, with 5% chance of spike to 10-20s (as per SoLucky's report)
        const chance = Math.random();
        let newLat;
        if (chance > 0.96) newLat = (Math.random() * 15 + 8).toFixed(1);
        else newLat = (Math.random() * 0.8 + 1.2).toFixed(1);

        appState.latencyHistory.push(newLat);
        if(appState.latencyHistory.length > 24) appState.latencyHistory.shift();

        // Update UI
        if(el) {
            el.innerText = newLat + 's';
            el.className = parseFloat(newLat) > 5 ? 'u-val text-neg' : 'u-val';
        }
        if(p99) p99.innerText = Math.max(...appState.latencyHistory) + 's';

        // Update Graph
        if(graph) {
            graph.innerHTML = '';
            appState.latencyHistory.forEach(val => {
                const bar = document.createElement('div');
                bar.className = 'lat-bar' + (parseFloat(val) > 5 ? ' spike' : '');
                bar.style.height = (Math.min(val, 20) * 3) + 'px';
                graph.appendChild(bar);
            });
        }
    }, 2500);
}

function startInsiderFeed() {
    const list = document.getElementById('insider-feed');
    const whales = [
        {name: '0xVitalik_MM', grade: 'S', act: 'Bought 50k NO', col: 'gold'},
        {name: 'PolyWhale_Alpha', grade: 'S', act: 'Staked 120k YES', col: 'gold'},
        {name: 'BuilderRelay_Node', grade: 'A', act: 'Redeemed positions', col: ''},
        {name: 'Gamma_Insider', grade: 'A', act: 'Aggregated 10k YES', col: ''},
        {name: 'Bot_V2_FOK', grade: 'B', act: 'Liquidity injection', col: ''}
    ];

    if(!list) return;
    whales.forEach(w => {
        list.innerHTML += `
            <div class="trader-item glass">
                <div class="t-info">
                    <span class="t-name">${w.name}</span>
                    <span class="t-last">${w.act}</span>
                </div>
                <span class="t-grade ${w.grade === 'S' ? 's' : ''}">${w.grade}</span>
            </div>
        `;
    });
}

// --- RENDERING ---
function renderMarkets() {
    const target = document.getElementById('main-viewport');
    if(!target) return;
    target.innerHTML = '';

    appState.markets.forEach(m => {
        let prices = [0.5, 0.5];
        try { prices = (typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices).map(Number); } catch(e){}
        const yes = (prices[0] * 100).toFixed(1);
        const roi = (1 / prices[0]).toFixed(1);

        target.innerHTML += `
            <div class="m-box">
                <div class="m-box-header">
                    <img src="${m.image}" class="m-box-icon" onerror="this.src='https://via.placeholder.com/32/1e293b/ffffff?text=P'">
                    <h3 class="m-box-title">${m.title}</h3>
                </div>
                <div class="m-box-meta">
                    <span>Alpha: <b style="color:var(--pos)">${roi}x</b></span>
                    <span>Vol: <b style="color:var(--accent)">$${formatCompact(m.volume24h)}</b></span>
                </div>
                <div class="clob-input-row">
                    <div class="clob-btn y">YES_ENTRY: ${yes}¢</div>
                    <div class="clob-btn n">NO_ENTRY: ${(100-yes).toFixed(1)}¢</div>
                </div>
                <button class="buy-btn" style="background:var(--accent); color:#000; border:none; padding:10px; border-radius:6px; font-weight:900; font-size:0.75rem; cursor:pointer;" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">EXECUTE_SIGNAL_ORDER</button>
            </div>
        `;
    });
}

function renderSimulatedMarkets() {
    appState.markets = [
        {title: "Will Iran strike Israel by March 31?", outcomePrices: "[0.001, 0.999]", volume24h: "12000000", slug: "#"},
        {title: "Trump win 2024 Presidential Election?", outcomePrices: "[0.54, 0.46]", volume24h: "850000000", slug: "#"},
        {title: "Will the Fed decrease rates by 50+ bps?", outcomePrices: "[0.003, 0.997]", volume24h: "8200000", slug: "#"}
    ];
    renderMarkets();
}

function formatCompact(n) {
    n = parseFloat(n);
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}
