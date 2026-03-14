/* PolyEdge Quant Engine v2.0 */
const CONFIG = {
    API: "https://gamma-api.polymarket.com/markets?active=true&limit=15&order=volume&dir=desc",
    REFRESH: 10000,
    WALLETS: ["0x72a...", "0xBC8...", "0x31F...", "0x9E2..."],
    ASSETS: ["Fed Rate Cut", "BTC hit $120k", "ETH Pectra", "NVDA $4T Cap"]
};

let appState = {
    markets: [],
    balance: "0.00",
    connected: false
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    fetchData();
    startWhaleFlow();
    setupControls();
    setInterval(fetchData, CONFIG.REFRESH);
});

async function fetchData() {
    try {
        const res = await fetch(CONFIG.API);
        const data = await res.json();
        
        appState.markets = data.map(m => ({
            id: m.id,
            question: m.question,
            alpha: (Math.random() * 12 + 2).toFixed(1),
            volume: new Intl.NumberFormat('en-US', { notation: 'compact' }).format(m.volume),
            spread: (Math.random() * 0.02).toFixed(3),
            price: m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : "0.50"
        }));

        renderMarkets();
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();
    } catch (e) {
        console.error("Sync Error:", e);
    }
}

function renderMarkets() {
    const container = document.getElementById('market-rows');
    if (!container) return;

    container.innerHTML = appState.markets.map(m => `
        <tr class="group">
            <td class="p-4">
                <div class="m-title truncate" title="${m.question}">${m.question}</div>
            </td>
            <td class="p-4" style="text-align:center;">
                <span class="m-alpha ${Number(m.alpha) > 8 ? 'alpha-high' : ''}">${m.alpha}%</span>
            </td>
            <td class="p-4" style="color:#d1fae5; font-weight:bold;">$${m.volume}</td>
            <td class="p-4">
                <div style="color:white; font-style:italic;">${(m.price * 100).toFixed(0)}¢</div>
                <div style="font-size:9px; color:var(--text-dark);">SPR: ${m.spread}¢</div>
            </td>
            <td class="p-4" style="text-align:right;">
                <button class="trade-btn">Trade</button>
            </td>
        </tr>
    `).join('');
}

function startWhaleFlow() {
    const log = document.getElementById('whale-log');
    setInterval(() => {
        const wallet = CONFIG.WALLETS[Math.floor(Math.random() * CONFIG.WALLETS.length)];
        const asset = CONFIG.ASSETS[Math.floor(Math.random() * CONFIG.ASSETS.length)];
        const amt = (Math.random() * 50 + 5).toFixed(1);
        
        const item = document.createElement('div');
        item.className = 'flow-item';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span class="flow-tag">BUY ORDER</span>
                <span style="color:var(--text-dark); font-size:8px;">${new Date().toLocaleTimeString()}</span>
            </div>
            <p style="color:rgba(255,255,255,0.8); margin-top:5px;">
                Wallet <span style="color:white;">${wallet}</span> moved $${amt}k into "${asset}"
            </p>
            <div class="flow-meta">
                <span>IMB: +0.${Math.floor(Math.random()*40)}</span>
                <span>SIG: ${(Math.random()*4).toFixed(1)}σ</span>
            </div>
        `;
        log.prepend(item);
        if (log.children.length > 15) log.lastChild.remove();
    }, 4000);
}

function setupControls() {
    const btn = document.getElementById('connect-btn');
    btn.addEventListener('click', () => {
        appState.connected = !appState.connected;
        btn.innerText = appState.connected ? "$2,840.12 USDC" : "INITIALIZE WALLET";
        btn.style.borderColor = appState.connected ? "var(--accent)" : "var(--border)";
    });
}
