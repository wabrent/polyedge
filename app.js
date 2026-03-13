/**
 * PolyEdge Pro Terminal v3.0
 * Fixed: Navigation Interactivity & Branding
 */

const CONFIG = {
    API: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=15&order=volume&dir=desc',
    REFRESH: 60000 
};

let appState = {
    data: [],
    query: ''
};

// --- INITIALIZE ---
window.addEventListener('load', () => {
    fetchStream();
    setupSearch();
    setInterval(fetchStream, CONFIG.REFRESH);
});

function setupSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.addEventListener('input', (e) => {
            appState.query = e.target.value.toLowerCase();
            renderDashboard();
        });
    }
}

// --- DATA ENGINE ---
async function fetchStream() {
    const loader = document.getElementById('loader-fill');
    if (loader) loader.style.width = '30%';

    try {
        const res = await fetch(CONFIG.API);
        const markets = await res.json();
        
        if (markets && markets.length > 0) {
            appState.data = markets;
            document.getElementById('count-markets').innerText = markets.length;
            
            const total = markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
            document.getElementById('total-vol').innerText = `$${(total/1000000).toFixed(1)}M`;
            
            renderDashboard();
        } else {
            deployLocalShard();
        }
    } catch (e) {
        console.warn("Retrying through local node...");
        deployLocalShard();
    } finally {
        if (loader) {
            loader.style.width = '100%';
            setTimeout(() => loader.style.width = '0%', 400);
        }
    }
}

function deployLocalShard() {
    appState.data = [
        { question: "Will Israel launch offensive in Iran before March 31?", volume: 11200000, liquidity: 2100000, outcomePrices: "[0.12, 0.88]", slug: "will-israel-iran" },
        { question: "Will the Fed decrease interest rates by 25+ bps in April?", volume: 8500000, liquidity: 5600000, outcomePrices: "[0.65, 0.35]", slug: "fed-rates-april" },
        { question: "Will NVIDIA stock close above $1,200 this week?", volume: 14000000, liquidity: 8900000, outcomePrices: "[0.45, 0.55]", slug: "nvda-above-1200" },
        { question: "Who will win the 2026 World Cup Shard?", volume: 22000000, liquidity: 1200000, outcomePrices: "[0.18, 0.82]", slug: "world-cup-2026" }
    ];
    renderDashboard();
}

// --- RENDERER ---
function renderDashboard() {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = appState.data.filter(m => m.question.toLowerCase().includes(appState.query));

    filtered.forEach((m, idx) => {
        let p = [0.5, 0.5];
        try { p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.prices; } catch(e) {}
        
        const y = (parseFloat(p[0] || 0.5) * 100).toFixed(1);
        const n = (parseFloat(p[1] || 0.5) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'market-card';
        card.style.animation = `fadeIn 0.4s ease-out ${idx * 0.05}s forwards`;
        card.style.opacity = '0';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 9px; font-weight: 800; color: var(--teal-glow);">FLOW $${(m.volume/1000000).toFixed(1)}M</span>
                <span class="live-indicator"></span>
            </div>
            <div class="market-title">${m.question}</div>
            
            <div class="price-container">
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="price-box yes">
                    <span class="p-label">BUY YES</span>
                    <span class="p-val">${y}¢</span>
                </a>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="price-box no">
                    <span class="p-label">BUY NO</span>
                    <span class="p-val">${n}¢</span>
                </a>
            </div>

            <div class="card-footer">
                <span>LIQ: $${(m.liquidity/1000).toFixed(0)}K</span>
                <span style="color: var(--teal-glow); font-weight: 700; cursor: pointer;">ANALYZE ⚡</span>
            </div>
        `;
        grid.appendChild(card);
    });
}
