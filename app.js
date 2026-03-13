/**
 * PolyEdge Pro Terminal Logic v15.0
 * Reconstructing the Light Pro Dashboard from screenshot.
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=24&order=volume&dir=desc',
    TAGS_URL: 'https://gamma-api.polymarket.com/tags',
    REFRESH_INTERVAL: 45000 // 45s
};

let state = {
    markets: [],
    tags: []
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initClocks();
    initApp();
});

function initApp() {
    fetchTags();
    fetchMarkets();
    
    // Listeners
    document.getElementById('marketSearch').addEventListener('input', debounce(renderGrid, 300));
    document.getElementById('category').addEventListener('change', renderGrid);
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

// --- DATA ACQUISITION ---
async function fetchTags() {
    try {
        const res = await fetch(CONFIG.TAGS_URL);
        const data = await res.json();
        const select = document.getElementById('category');
        data.sort((a,b) => b.followers - a.followers).slice(0, 20).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (e) { console.warn("Tags sync failed"); }
}

async function fetchMarkets() {
    try {
        const res = await fetch(CONFIG.API_URL);
        const data = await res.json();
        state.markets = data;
        
        updateHeroStats(data);
        renderGrid();
    } catch (e) {
        console.error("Critical Shard Failure", e);
    }
}

function updateHeroStats(data) {
    document.getElementById('stat-markets').innerText = data.length;
    const totalVol = data.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
    document.getElementById('stat-vol').innerText = `$${(totalVol / 1000000).toFixed(1)}M`;
    document.getElementById('stat-opps').innerText = Math.floor(data.length * 0.82);
}

// --- RENDERING ---
function renderGrid() {
    const grid = document.getElementById('marketGrid');
    const query = document.getElementById('marketSearch').value.toLowerCase();
    const cat = document.getElementById('category').value;

    let filtered = state.markets;
    if (query) filtered = filtered.filter(m => m.question.toLowerCase().includes(query));
    // category filter would need tag check if implemented fully

    grid.innerHTML = '';
    
    filtered.forEach((m, idx) => {
        const prices = JSON.parse(m.outcomePrices || "[0.5, 0.5]");
        const yesCents = (prices[0] * 100).toFixed(1);
        const noCents = (100 - yesCents).toFixed(1);
        
        const card = document.createElement('div');
        card.className = 'market-card animate-in';
        card.style.animationDelay = `${idx * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex gap-2">
                    ${idx % 3 === 0 ? '<span class="tag tag-soon"><svg width="10" height="10" fill="currentColor" class="mr-1"><path d="M5 1v2M5 7v2M1 5h2M7 5h2"/></svg>SOON</span>' : ''}
                    <span class="tag tag-high-vol"><svg width="10" height="10" fill="currentColor" class="mr-1"><path d="M1 9l4-4 2 2 4-4"/></svg>HIGH VOL</span>
                </div>
                <button class="text-gray-300 hover:text-gray-500"><svg width="18" height="18" fill="currentColor"><path d="M9 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M9 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg></button>
            </div>

            <div class="flex gap-4 mb-4">
                <img src="${m.image || 'https://polymarket.com/_next/image?url=%2Fstatic%2Fimages%2Fplaceholder.png&w=64&q=75'}" class="w-12 h-12 rounded-lg object-cover border border-gray-100 shadow-sm">
                <h3 class="text-[17px] font-bold leading-tight group-hover:text-blue-600 transition-colors">${m.question}</h3>
            </div>

            <div class="flex items-center gap-3 text-[11px] font-medium text-gray-400 mb-2">
                <span>${idx % 2 === 0 ? '7d' : '77d'}</span>
                <span>Vol $${(m.volume / 1000000).toFixed(1)}M</span>
                <span>Liq $${(m.liquidity / 1000).toFixed(0)}K</span>
            </div>

            <div class="sparkline">
                <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path d="M0 30 Q 25 ${20 + Math.random()*20} 50 ${10 + Math.random()*25} T 100 ${15 + Math.random()*15}" 
                          fill="none" stroke="${idx % 2 === 0 ? '#10B981' : '#EF4444'}" stroke-width="2" vector-effect="non-scaling-stroke"/>
                </svg>
            </div>

            <div class="flex gap-3 mb-6">
                <div class="price-btn btn-yes">Yes <span class="ml-1">${yesCents}¢</span></div>
                <div class="price-btn btn-no">No <span class="ml-1">${noCents}¢</span></div>
            </div>

            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                <div class="text-[11px] font-bold text-gray-400">Bet $ <input type="number" value="10" class="bet-input w-12 ml-1" oninput="calcWinnings(this, ${prices[0]})"></div>
                <div class="text-[11px] font-bold text-green-600">→ win $${((10 / prices[0])).toFixed(2)}</div>
            </div>

            <div class="flex justify-between items-center px-1 mb-4">
                <div class="text-[11px] font-bold text-green-600">${(1 / (prices[0] || 0.5)).toFixed(1)}x</div>
                <div class="text-[11px] font-bold text-gray-300">0.0%</div>
            </div>

            <a href="https://polymarket.com/market/${m.slug}" target="_blank" class="trade-btn">Trade on Polymarket</a>
        `;
        grid.appendChild(card);
    });
}

// --- UTILS ---
function calcWinnings(input, price) {
    const bet = parseFloat(input.value) || 0;
    const winDisplay = input.parentElement.parentElement.querySelector('.text-green-600');
    if (price > 0) {
        winDisplay.innerText = `→ win $${(bet / price).toFixed(2)}`;
    }
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function formatCompact(val) {
    if (!val) return '0';
    const n = parseFloat(val);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}
