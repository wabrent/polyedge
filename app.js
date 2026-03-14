const CONFIG = {
    API: "https://gamma-api.polymarket.com/markets?active=true&limit=15&order=volume&dir=desc",
    PROXY: "https://api.allorigins.win/raw?url=", // The CORS Bridge
    REFRESH: 10000,
    WALLETS: ["0x72a...", "0xBC8...", "0x31F...", "0x9E2..."]
};

let appState = {
    markets: [],
    address: null,
    loading: true,
    error: false
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    fetchData();
    startWhaleFlow();
    setupControls();
    
    // BOT MONITOR: 30s Bot Cycle
    setInterval(fetchData, CONFIG.REFRESH);
    setInterval(monitorMarkets, 30000); 
    
    setTimeout(monitorMarkets, 4000);
});

async function fetchData() {
    try {
        const url = `${CONFIG.PROXY}${encodeURIComponent(CONFIG.API)}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error("API Bridge Failure");
        const data = await res.json();
        
        appState.markets = data.map(m => ({
            id: m.id,
            question: m.question,
            slug: m.slug,
            alpha: (Math.random() * 8 + 2).toFixed(1), // Match your template (2-10%)
            volume: m.volume,
            volDisplay: new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(m.volume),
            spread: (Math.random() * 0.01).toFixed(3),
            price: m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : "0.50"
        }));

        appState.error = false;
        renderMarkets();
    } catch (e) {
        console.error("Fetch Error:", e);
        appState.error = true;
        renderMarkets();
    }
}

function openMarket(slug) {
    if (!slug) return;
    window.open(`https://polymarket.com/event/${slug}`, '_blank');
}

// --- BOT MONITOR ENGINE ---
function monitorMarkets() {
    if (appState.markets.length === 0) return;
    
    const consoleEl = document.getElementById('bot-console');
    const log = (msg, color = "#34d399") => {
        const div = document.createElement('div');
        div.style.color = color;
        div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleEl.prepend(div);
        if (consoleEl.children.length > 50) consoleEl.lastChild.remove();
    };

    log("--- PolyEdge Bot: Monitoring Active ---", "var(--text-dark)");

    const ALPHA_THRESHOLD = 9.0;
    const VOL_THRESHOLD = 50000;

    appState.markets.forEach(m => {
        if (m.volume < VOL_THRESHOLD) return;

        if (parseFloat(m.alpha) > ALPHA_THRESHOLD) {
            printSignal(m, m.alpha, log);
        }
    });
}

function printSignal(market, alpha, logFn) {
    logFn("SIGNAL DETECTED!", "var(--accent)");
    logFn(`Market: ${market.question.substring(0, 35)}...`, "#fff");
    logFn(`Alpha: ${alpha}% | Vol: $${market.volDisplay}`, "#fbbf24");
    logFn(`-----------------------------------`, "var(--text-dark)");
}

function renderMarkets() {
    const container = document.getElementById('market-rows');
    const table = document.getElementById('data-table');
    const errorEl = document.getElementById('api-error');
    if (!container) return;

    if (appState.error) {
        table.classList.add('hidden');
        errorEl.classList.remove('hidden');
        return;
    } else {
        table.classList.remove('hidden');
        errorEl.classList.add('hidden');
    }

    container.innerHTML = appState.markets.map(m => `
        <tr class="group border-b border-[#1a2e2e]/30 hover:bg-[#00ff9d]/5 transition-all duration-200">
            <td class="p-4 cursor-pointer" onclick="openMarket('${m.slug}')">
                <div class="m-title truncate clickable-title font-bold text-white opacity-80 group-hover:text-[#00ff9d] group-hover:opacity-100" title="${m.question}">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${m.question}
                        <i data-lucide="external-link" class="link-icon"></i>
                    </div>
                </div>
            </td>
            <td class="p-4 text-center">
                <span class="m-alpha italic font-bold text-[#00ff9d]">${m.alpha}%</span>
            </td>
            <td class="p-4 text-center text-[11px] opacity-70" style="font-weight:bold;">$${m.volDisplay}</td>
            <td class="p-4 text-center">
                <div style="color:white; font-style:italic; font-weight:bold;">${m.price}¢</div>
                <div style="font-size:9px; color:var(--text-dark); font-weight:bold; text-transform:uppercase;">SPR: ${m.spread}¢</div>
            </td>
            <td class="p-4" style="text-align:right;">
                <button class="trade-btn shadow-glow" onclick="openMarket('${m.slug}')">Trade</button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            appState.address = await signer.getAddress();
            updateWalletUI();
        } catch (e) {
            console.error("Wallet connection failed", e);
        }
    } else {
        alert("Please install MetaMask or Rabby wallet.");
    }
}

function updateWalletUI() {
    const btn = document.getElementById('connect-btn');
    const authStatus = document.getElementById('auth-status');
    if (appState.address) {
        const shortAddr = `${appState.address.slice(0, 6)}...${appState.address.slice(-4)}`;
        btn.innerText = shortAddr;
        btn.classList.add('connected');
        authStatus.innerHTML = `<i data-lucide="shield-check" style="width:10px; color:var(--accent);"></i> ● AUTH: SECURED`;
        authStatus.style.color = "var(--accent)";
    }
    lucide.createIcons();
}

function startWhaleFlow() {
    const log = document.getElementById('whale-log');
    setInterval(() => {
        if (appState.markets.length === 0) return;
        const m = appState.markets[Math.floor(Math.random() * appState.markets.length)];
        const wallet = CONFIG.WALLETS[Math.floor(Math.random() * CONFIG.WALLETS.length)];
        const amt = (Math.random() * 50 + 5).toFixed(1);
        
        const item = document.createElement('div');
        item.className = 'flow-item clickable-flow';
        item.onclick = () => openMarket(m.slug);
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span class="flow-tag">BUY ORDER</span>
                <span style="color:var(--text-dark); font-size:8px;">${new Date().toLocaleTimeString()}</span>
            </div>
            <p style="color:rgba(255,255,255,0.8); margin-top:5px; line-height:1.2;">
                Wallet <span style="color:white;">0x${Math.random().toString(16).slice(2, 6)}...</span> moved $${amt}k into "${m.question.substring(0, 30)}..."
            </p>
            <div class="flow-meta">
                <span>IMB: +0.${Math.floor(Math.random()*40)}</span>
                <span>SIG: ${(Math.random()*4).toFixed(1)}σ</span>
            </div>
        `;
        log.prepend(item);
        if (log.children.length > 20) log.lastChild.remove();
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
