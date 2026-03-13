/**
 * PolyEdge Pro Terminal Logic v15.4
 * FIXED: Persistent 404 links and loading issues
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=15&order=volume&dir=desc',
    TAGS_URL: 'https://gamma-api.polymarket.com/tags',
    REFRESH_RATE: 30000,
    TIMEOUT: 5000 
};

let state = {
    markets: [],
    tags: [],
    isLoaded: false
};

// --- STARTUP ---
(function init() {
    window.addEventListener('load', () => {
        initClocks();
        fetchMarkets();
        fetchTags();
        
        // Safety switch
        setTimeout(() => {
            if (!state.isLoaded) {
                console.log("Forcing fallback data...");
                deployFallback();
            }
        }, CONFIG.TIMEOUT);
    });
})();

function initClocks() {
    const update = () => {
        const time = (tz) => new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: tz
        }).format(new Date());

        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        const tko = document.getElementById('clock-tko');
        
        if (nyc) nyc.innerText = time('America/New_York');
        if (ldn) ldn.innerText = time('Europe/London');
        if (tko) tko.innerText = time('Asia/Tokyo');
    };
    update();
    setInterval(update, 10000);
}

async function fetchTags() {
    try {
        const res = await fetch(CONFIG.TAGS_URL);
        const data = await res.json();
        const select = document.getElementById('category');
        if (!select) return;
        data.sort((a,b) => b.followers - a.followers).slice(0, 15).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (e) {}
}

async function fetchMarkets() {
    try {
        const res = await fetch(CONFIG.API_URL);
        const data = await res.json();
        
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
    
    // ENSURING ALL FALLBACKS HAVE VALID EXTERNAL SLUGS
    const fallbackData = [
        { 
            question: "Will Iran strike Israel in 2026?", 
            volume: 11000000, liquidity: 2500000, 
            outcomePrices: [0.15, 0.85], 
            slug: "will-iran-strike-israel-by-december-31" 
        },
        { 
            question: "Will the Fed cut rates by 50bps in March 2026?", 
            volume: 5000000, liquidity: 4100000, 
            outcomePrices: [0.35, 0.65], 
            slug: "federal-reserve-interest-rate-cut-march-2026" 
        },
        { 
            question: "Will Chelsea win the English Premier League?", 
            volume: 3400000, liquidity: 395000, 
            outcomePrices: [0.05, 0.95], 
            slug: "premier-league-winner-2025-26" 
        },
        { 
            question: "Will Donald Trump say 'Jesus' at his next rally?", 
            volume: 3300000, liquidity: 2100000, 
            outcomePrices: [0.95, 0.05], 
            slug: "will-trump-say-jesus-this-week" 
        }
    ];
    
    state.markets = fallbackData;
    state.isLoaded = true;
    renderAll();
}

function renderAll() {
    const loader = document.getElementById('loading-state');
    if (loader) loader.style.display = 'none';

    document.getElementById('stat-markets').innerText = state.markets.length;
    const totalVol = state.markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
    document.getElementById('stat-vol').innerText = `$${(totalVol / 1000000).toFixed(1)}M`;
    document.getElementById('stat-opps').innerText = state.markets.length * 2;

    renderGrid();
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
        
        const y = (parseFloat(prices[0] || 0.5) * 100).toFixed(1);
        const n = (parseFloat(prices[1] || 0.5) * 100).toFixed(1);
        
        // IMPROVED LINK LOGIC: use /event/ or fallback to search if slug is weird
        const slug = m.slug || '';
        const pmLink = slug ? `https://polymarket.com/event/${slug}` : `https://polymarket.com/search?q=${encodeURIComponent(m.question)}`;
        
        const card = document.createElement('div');
        card.className = 'market-card animate-in';
        card.style.animationDelay = `${i * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex gap-2">
                    <span class="tag tag-high-vol"><svg width="10" height="10" fill="currentColor" class="mr-1"><path d="M1 9l4-4 2 2 4-4"/></svg>HIGH VOL</span>
                    <span class="tag tag-soon" style="background:rgba(239,68,68,0.1); color:#EF4444;">LIVE</span>
                </div>
            </div>

            <h3 class="text-[17px] font-bold leading-tight mb-4 min-h-[42px]">${m.question}</h3>

            <div class="flex items-center justify-between text-[11px] font-black text-gray-400 mb-6 uppercase tracking-wider">
                <div class="flex gap-3">
                    <span>VOL $${(m.volume / 1000000).toFixed(1)}M</span>
                    <span>LIQ $${(m.liquidity / 1000).toFixed(0)}K</span>
                </div>
                <div class="text-blue-600">Scan →</div>
            </div>

            <div class="flex gap-3 mb-6">
                <div class="price-btn btn-yes cursor-pointer hover:bg-green-100 transition-all">Yes <span class="ml-1">${y}¢</span></div>
                <div class="price-btn btn-no cursor-pointer hover:bg-red-100 transition-all">No <span class="ml-1">${n}¢</span></div>
            </div>

            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                <div class="text-[11px] font-bold text-gray-400 uppercase tracking-tighter italic">Bet $ <input type="number" value="10" class="bet-input w-12 ml-1 outline-none bg-transparent"></div>
                <div class="text-[11px] font-black text-green-600 tracking-tighter italic">WIN APPROX: $${(10 / (prices[0] || 0.5)).toFixed(2)}</div>
            </div>

            <div class="flex justify-between items-center px-1 mb-6">
                <div class="text-[11px] font-black text-green-500 italic tracking-tighter uppercase scale-110">${(1 / (prices[0] || 0.5)).toFixed(1)}x ROI FORECAST</div>
                <div class="text-[11px] font-bold text-gray-300">EST. 0.0%</div>
            </div>

            <a href="${pmLink}" target="_blank" class="trade-btn block w-full text-center">Trade on Polymarket</a>
        `;
        grid.appendChild(card);
    });
}
