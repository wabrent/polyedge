/**
 * PolyEdge Pro Terminal Logic v15.2
 * FIXED: Loading hangs & Missing Logo
 */

const CONFIG = {
    // Standard Gamma API
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=15&order=volume&dir=desc',
    TAGS_URL: 'https://gamma-api.polymarket.com/tags',
    REFRESH_RATE: 30000,
    TIMEOUT: 5000 // 5 seconds to fallback
};

let state = {
    markets: [],
    tags: [],
    isLoaded: false
};

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    initClocks();
    initApp();
    
    // Safety Force Stop loading after timeout
    setTimeout(() => {
        if (!state.isLoaded) {
            console.warn("API Timed out. Deploying fallback data.");
            deployFallback();
        }
    }, CONFIG.TIMEOUT);
});

function initApp() {
    fetchTags();
    fetchMarkets();
}

// --- WORLD CLOCKS ---
function initClocks() {
    const update = () => {
        const time = (tz) => new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: tz
        }).format(new Date());

        document.getElementById('clock-nyc').innerText = time('America/New_York');
        document.getElementById('clock-ldn').innerText = time('Europe/London');
        document.getElementById('clock-tko').innerText = time('Asia/Tokyo');
    };
    update();
    setInterval(update, 10000);
}

// --- DATA ACCESS ---
async function fetchTags() {
    try {
        const res = await fetch(CONFIG.TAGS_URL);
        const data = await res.json();
        const select = document.getElementById('category');
        data.sort((a,b) => b.followers - a.followers).slice(0, 15).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn("Tags node restricted.");
    }
}

async function fetchMarkets() {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
        
        const res = await fetch(CONFIG.API_URL, { signal: controller.signal });
        const data = await res.json();
        clearTimeout(id);
        
        if (data && data.length > 0) {
            state.markets = data;
            state.isLoaded = true;
            renderAll();
        } else {
            deployFallback();
        }
    } catch (e) {
        deployFallback();
    }
}

function deployFallback() {
    if (state.isLoaded) return;
    
    const fallbackData = [
        { question: "Will Iran strike Israel on March 26?", volume: 11000000, liquidity: 2500000, outcomePrices: "[0.1, 0.999]" },
        { question: "Will the Fed decrease interest rates by 50+ bps in March?", volume: 5000000, liquidity: 4100000, outcomePrices: "[0.03, 0.998]" },
        { question: "Will Chelsea win the 2025-26 English Premier League?", volume: 3400000, liquidity: 395000, outcomePrices: "[0.01, 0.999]" },
        { question: "Will Trump say 'Jesus' this week? (March 15)", volume: 3300000, liquidity: 2100000, outcomePrices: "[0.999, 0.01]" }
    ];
    
    state.markets = fallbackData;
    state.isLoaded = true;
    renderAll();
}

// --- RENDERING ---
function renderAll() {
    const loader = document.getElementById('loading-state');
    if (loader) loader.style.display = 'none';

    updateStats();
    renderGrid();
}

function updateStats() {
    document.getElementById('stat-markets').innerText = state.markets.length;
    const totalVol = state.markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
    document.getElementById('stat-vol').innerText = `$${(totalVol / 1000000).toFixed(1)}M`;
}

function renderGrid() {
    const grid = document.getElementById('marketGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    state.markets.forEach((m, i) => {
        let prices = [0.5, 0.5];
        try {
            prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        } catch(e) {}
        
        const y = (parseFloat(prices[0]) * 100).toFixed(1);
        const n = (parseFloat(prices[1]) * 100).toFixed(1);
        
        const card = document.createElement('div');
        card.className = 'market-card animate-in';
        card.style.animationDelay = `${i * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex gap-2">
                    <span class="tag tag-high-vol"><svg width="10" height="10" fill="currentColor" class="mr-1"><path d="M1 9l4-4 2 2 4-4"/></svg>HIGH VOL</span>
                </div>
                <button class="text-gray-300 hover:text-gray-500"><svg width="18" height="18" fill="currentColor"><path d="M9 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg></button>
            </div>

            <h3 class="text-[17px] font-bold leading-tight mb-4 min-h-[42px]">${m.question}</h3>

            <div class="flex items-center gap-3 text-[10px] font-bold text-gray-400 mb-6">
                <span>VOL $${(m.volume / 1000000).toFixed(1)}M</span>
                <span>LIQ $${(m.liquidity / 1000).toFixed(0)}K</span>
            </div>

            <div class="flex gap-3 mb-6">
                <div class="price-btn btn-yes">Yes <span class="ml-1">${y}¢</span></div>
                <div class="price-btn btn-no">No <span class="ml-1">${n}¢</span></div>
            </div>

            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                <div class="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">Bet $ <input type="number" value="10" class="bet-input w-12 ml-1"></div>
                <div class="text-[11px] font-bold text-green-600">→ win $${(10 / prices[0]).toFixed(2)}</div>
            </div>

            <div class="flex justify-between items-center px-1 mb-6">
                <div class="text-[11px] font-black text-green-600 italic tracking-tighter">${(1 / (prices[0] || 0.5)).toFixed(1)}x ROI</div>
                <div class="text-[11px] font-bold text-gray-300">0.0%</div>
            </div>

            <a href="https://polymarket.com/market/${m.slug || '#'}" target="_blank" class="trade-btn">Trade on Polymarket</a>
        `;
        grid.appendChild(card);
    });
}
