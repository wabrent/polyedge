/**
 * POLYEDGE INTELLIGENCE CORE v5.0
 * Performance-first data engine for Polymarket Builders
 */

const CONFIG = {
    API: 'https://gamma-api.polymarket.com/markets',
    PROXY: 'https://api.allorigins.win/get?url=',
    REFRESH_RATE: 30000,
    MIN_ALPHA_ROI: 5 // Markets with >5x ROI are marked Alpha
};

let state = {
    markets: [],
    view: 'markets',
    theme: 'dark'
};

// --- BOOTSTRAP ---
window.addEventListener('load', () => {
    initApp();
    startWhaleIntelligence();
    fetchIntelligence();
});

function initApp() {
    // Theme toggle
    document.getElementById('theme-toggle').onclick = () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('pe_theme_v5', state.theme);
    };

    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.view = btn.dataset.view;
            renderAll();
        };
    });
}

// --- DATA ENGINE ---
async function fetchIntelligence() {
    const target = `${CONFIG.API}?closed=false&limit=50&active=true&order=volume24hr&ascending=false`;
    
    try {
        const response = await fetch(CONFIG.PROXY + encodeURIComponent(target));
        if (!response.ok) throw new Error("Intelligence link offline");
        
        const json = await response.json();
        const raw = JSON.parse(json.contents);
        
        state.markets = processIntelligence(Array.isArray(raw) ? raw : raw.markets);
        updateStats();
        renderAll();
    } catch (err) {
        console.warn("Signal lost. Running local simulation...");
        runSimulation();
    }
}

function processIntelligence(data) {
    if (!data) return [];
    return data.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try {
            const p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(p)) prices = p.map(Number);
        } catch(e) {}

        const yes = Math.max(0.001, prices[0]);
        return {
            id: m.id,
            title: m.question,
            img: m.image || '',
            vol: parseFloat(m.volume24h) || 0,
            liq: parseFloat(m.liquidity) || 0,
            yes: yes,
            no: 1 - yes,
            roi: 1 / yes,
            url: `https://polymarket.com/market/${m.slug}`,
            category: m.groupItemTitle || 'General'
        };
    });
}

// --- SUB-SYSTEMS ---
function updateStats() {
    const vol = state.markets.reduce((s, m) => s + m.vol, 0);
    const alpha = state.markets.filter(m => m.roi > CONFIG.MIN_ALPHA_ROI).length;

    animateCounter('stat-count', state.markets.length);
    animateCounter('stat-alpha', alpha);
    document.getElementById('stat-volume').innerText = `$${(vol/1e6).toFixed(1)}M`;
}

function startWhaleIntelligence() {
    const feed = document.getElementById('whale-simulation-feed');
    const actions = ['BOUGHT YES', 'BOUGHT NO', 'STAKED YES', 'STAKED NO'];
    
    setInterval(() => {
        if (state.markets.length === 0) return;
        
        const m = state.markets[Math.floor(Math.random() * state.markets.length)];
        const size = (Math.random() * 50000 + 5000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        const div = document.createElement('div');
        div.className = 'whale-event';
        div.style.opacity = '0';
        div.style.transform = 'translateX(-10px)';
        div.innerHTML = `<span class="w-size">${size} ${action}</span> on <span class="text-dim">${m.category}</span>`;
        
        feed.prepend(div);
        setTimeout(() => {
            div.style.transition = '0.5s';
            div.style.opacity = '1';
            div.style.transform = 'translateX(0)';
        }, 10);

        if (feed.children.length > 15) feed.lastChild.remove();
    }, 4000);
}

// --- VIEW ENGINE ---
function renderAll() {
    const container = document.getElementById('markets-container');
    container.innerHTML = '';

    state.markets.forEach(m => {
        const card = document.createElement('div');
        card.className = 'market-card glass clickable';
        
        const yesC = (m.yes * 100).toFixed(1);
        const roi = m.roi.toFixed(1);

        card.innerHTML = `
            <div class="card-top">
                <img src="${m.img}" class="avatar" onerror="this.src='https://via.placeholder.com/44/121212/ffffff?text=P'">
                <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">VOL: $${formatCompact(m.vol)}</span>
            </div>
            <h3 class="m-question">${m.title}</h3>
            
            <div class="price-engine">
                <button class="price-trigger y">
                    <span class="p-label">YES_FLOW</span>
                    ${yesC}¢
                </button>
                <button class="price-trigger n">
                    <span class="p-label">NO_FLOW</span>
                    ${(100 - yesC).toFixed(1)}¢
                </button>
            </div>

            <div class="footer-alpha">
                <span class="roi-badge">${roi}x ALPHA</span>
                <button class="clickable" onclick="window.open('${m.url}', '_blank')" style="background:var(--accent-primary); border:none; color:#000; padding:6px 12px; border-radius:8px; font-size:0.7rem; font-weight:900;">EXECUTE</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- UTILS ---
function animateCounter(id, target) {
    const el = document.getElementById(id);
    let curr = 0;
    const step = Math.ceil(target / 20);
    const int = setInterval(() => {
        curr += step;
        if (curr >= target) {
            el.innerText = target;
            clearInterval(int);
        } else {
            el.innerText = curr;
        }
    }, 30);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return n.toFixed(0);
}

function runSimulation() {
    state.markets = [
        { title: "Trump win 2024 Election?", yes: 0.54, vol: 850000000, liq: 120000000, roi: 1.8, category: "POLITICS", url: "#" },
        { title: "Will the Fed cut rates in May?", yes: 0.25, vol: 8500000, liq: 4200000, roi: 4, category: "ECONOMY", url: "#" },
        { title: "BTC to reach $100k by July?", yes: 0.15, vol: 3200000, liq: 850000, roi: 6.6, category: "CRYPTO", url: "#" }
    ];
    updateStats();
    renderAll();
}
