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
    theme: 'dark',
    redeemable: 142.50,
    gas: 24,
    latency: 1.4 // Default median from SoLucky's report
};

// --- BOOTSTRAP ---
window.addEventListener('load', () => {
    initApp();
    startWhaleIntelligence();
    startRelayNode(); // Added for Builder Relay simulation
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
function startRelayNode() {
    // Simulate Gas & CLOB Latency spikes (as discussed by SoLucky)
    setInterval(() => {
        state.gas = Math.floor(Math.random() * 10) + 22;
        
        // Random latency spikes mimicking technical bottlenecks
        const chance = Math.random();
        if (chance > 0.95) state.latency = (Math.random() * 15 + 5).toFixed(1); // Spike!
        else state.latency = (Math.random() * 0.8 + 1.2).toFixed(1); // Normal median

        const gasEl = document.getElementById('gas-estimate');
        const latEl = document.getElementById('clob-latency');
        
        if (gasEl) gasEl.innerText = `${state.gas} Gwei`;
        if (latEl) {
            latEl.innerText = `${state.latency}s`;
            latEl.className = state.latency > 5 ? 'mono latency-warn' : 'mono';
        }
    }, 3000);
}

function updateStats() {
    const vol = state.markets.reduce((s, m) => s + m.vol, 0);
    animateCounter('stat-count', state.markets.length);
    document.getElementById('stat-volume').innerText = `$${(vol/1e6).toFixed(1)}M`;
    document.getElementById('stat-redeem').innerText = `$${state.redeemable.toFixed(2)}`;
}

function startWhaleIntelligence() {
    const feed = document.getElementById('whale-simulation-feed');
    const actions = ['BOUGHT YES', 'BOUGHT NO', 'STAKED YES', 'STAKED NO'];
    const grades = [
        { g: 'S', c: 'grade-s' },
        { g: 'A', c: 'grade-a' },
        { g: 'A', c: 'grade-a' },
        { g: 'B', c: '' }
    ];
    
    setInterval(() => {
        if (state.markets.length === 0) return;
        
        const m = state.markets[Math.floor(Math.random() * state.markets.length)];
        const size = (Math.random() * 50000 + 5000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const action = actions[Math.floor(Math.random() * actions.length)];
        const grade = grades[Math.floor(Math.random() * grades.length)];
        
        const div = document.createElement('div');
        div.className = 'whale-event';
        div.style.opacity = '0';
        div.innerHTML = `
            <span class="grade ${grade.c}">${grade.g}</span>
            <span class="w-size">${size} ${action}</span> 
            <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 4px;">TARGET_NODE: ${m.category}</div>
        `;
        
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
    const headerTitle = document.querySelector('.terminal-main h1');
    const headerSub = document.querySelector('.terminal-main p');
    
    container.innerHTML = '';

    if (state.view === 'redeem') {
        headerTitle.innerText = "Builder Relay Node";
        headerSub.innerText = "Batching redeemable positions for Polygon Relay...";
        renderRedeemView(container);
        return;
    }

    headerTitle.innerText = "Intelligence Dashboard";
    headerSub.innerText = "Intercepting Polymarket signals...";

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

function renderRedeemView(container) {
    const wrap = document.createElement('div');
    wrap.style.gridColumn = "1 / -1";
    wrap.className = "glass";
    wrap.style.padding = "40px";
    wrap.style.borderRadius = "24px";
    wrap.style.textAlign = "center";

    wrap.innerHTML = `
        <div style="margin-bottom: 32px;">
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 8px;">TOTAL_REDEEMABLE_BALANCE</div>
            <div style="font-size: 3.5rem; font-weight: 900; color: var(--accent-secondary);">$${state.redeemable.toFixed(2)}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; text-align: left;">
            <div class="glass" style="padding: 16px; border-radius: 12px;">
                <span class="m-label">Positions Ready</span>
                <span class="m-val" style="font-size: 1.2rem;">12</span>
            </div>
            <div class="glass" style="padding: 16px; border-radius: 12px;">
                <span class="m-label">Estimated Gas</span>
                <span class="m-val" style="font-size: 1.2rem; color: var(--pos);">$0.12</span>
            </div>
            <div class="glass" style="padding: 16px; border-radius: 12px;">
                <span class="m-label">Relay Mode</span>
                <span class="m-val" style="font-size: 1.2rem;">BATCH_AUTO</span>
            </div>
        </div>

        <button class="clickable" id="redeem-action-btn" style="background: var(--accent-secondary); border: none; color: #fff; padding: 20px 60px; border-radius: 16px; font-weight: 900; font-size: 1.2rem; box-shadow: 0 0 30px rgba(112, 0, 255, 0.4);">
            EXECUTE BATCH REDEEM
        </button>
        
        <p style="margin-top: 24px; font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">
            >> relay_bridge.sendTransaction({ gasLimit: 250000, to: BUILDER_RELAY_V2 })
        </p>
    `;

    container.appendChild(wrap);

    document.getElementById('redeem-action-btn').onclick = function() {
        this.innerText = "PACKETING...";
        this.style.opacity = "0.7";
        setTimeout(() => {
            this.innerText = "SENDING TO RELAY...";
            setTimeout(() => {
                alert(`SUCCESS: $${state.redeemable} redeemed for 0.12 USD gas.`);
                state.redeemable = 0;
                updateStats();
                renderAll();
            }, 1000);
        }, 1000);
    };
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
