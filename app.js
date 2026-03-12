/**
 * PolyEdge Terminal Engine v8.0
 * High-performance trading terminal integration
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false',
    PROXY: 'https://api.allorigins.win/get?url=',
    REFRESH_CYCLE: 15
};

let state = {
    markets: [],
    filtered: [],
    activeTab: 'markets',
    query: '',
    timer: CONFIG.REFRESH_CYCLE,
    filters: {
        roi: 5,
        liq: 10000
    }
};

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initControls();
    startClocks();
    startRefreshCycle();
    fetchData();
});

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const scannerControls = document.getElementById('scanner-controls');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            state.activeTab = link.dataset.target;

            // UI Buttons
            navLinks.forEach(l => l.classList.remove('bg-app-activeTab', 'text-white'));
            link.classList.add('bg-app-activeTab', 'text-white');

            // View Metadata
            title.innerText = link.dataset.title;
            subtitle.innerText = link.dataset.subtitle;

            // Visibility Logic
            if(state.activeTab === 'scanner') {
                scannerControls.classList.remove('hidden');
                scannerControls.classList.add('flex');
            } else {
                scannerControls.classList.add('hidden');
                scannerControls.classList.remove('flex');
            }

            applyFiltersAndRender();
        });
    });
}

function initControls() {
    const roiInput = document.getElementById('input-roi');
    const liqInput = document.getElementById('input-liq');
    const searchInput = document.getElementById('search-input');

    roiInput.oninput = (e) => {
        state.filters.roi = parseInt(e.target.value);
        document.getElementById('val-roi').innerText = state.filters.roi + 'x';
        applyFiltersAndRender();
    };

    liqInput.oninput = (e) => {
        const val = parseInt(e.target.value);
        state.filters.liq = val * 1000;
        document.getElementById('val-liq').innerText = '$' + val + 'K';
        applyFiltersAndRender();
    };

    searchInput.oninput = (e) => {
        state.query = e.target.value.toLowerCase();
        applyFiltersAndRender();
    };

    document.getElementById('btn-scan')?.addEventListener('click', fetchData);
}

// --- DATA ENGINE ---
async function fetchData() {
    try {
        const response = await fetch(CONFIG.PROXY + encodeURIComponent(CONFIG.API_URL));
        const json = await response.json();
        const data = JSON.parse(json.contents);
        
        state.markets = processMarkets(Array.isArray(data) ? data : data.markets);
        applyFiltersAndRender();
    } catch (err) {
        console.error("Link Fail. Using local cache.");
        deployFallback();
    }
}

function processMarkets(raw) {
    return raw.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try {
            const p = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(p)) prices = p.map(Number);
        } catch(e) {}

        const yes = Math.max(0.001, prices[0]);
        const roi = 1 / yes;

        return {
            id: m.id,
            title: m.question,
            liq: parseFloat(m.liquidity) || 0,
            vol: parseFloat(m.volume24h) || 0,
            roi: roi,
            price: yes * 100,
            ends: m.endDate ? Math.floor((new Date(m.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
            slug: m.slug
        };
    });
}

function applyFiltersAndRender() {
    state.filtered = state.markets.filter(m => {
        const matchSearch = m.title.toLowerCase().includes(state.query);
        if(!matchSearch) return false;

        if(state.activeTab === 'scanner') {
            return m.roi >= state.filters.roi && m.liq >= state.filters.liq;
        }
        return true;
    });

    // Sorting: Best ROI first for Scanner, Volume for Markets
    if(state.activeTab === 'scanner') {
        state.filtered.sort((a,b) => b.roi - a.roi);
    } else {
        state.filtered.sort((a,b) => b.vol - a.vol);
    }

    render();
}

// --- RENDERING ---
function render() {
    const container = document.getElementById('content-container');
    const count = document.getElementById('target-count');
    if(!container) return;

    count.innerText = `Found ${state.filtered.length} targets`;
    container.innerHTML = '';

    state.filtered.slice(0, 40).forEach((m, i) => {
        const endText = m.ends < 0 ? 'Ended' : `${m.ends}d`;
        container.innerHTML += `
            <div class="flex items-center bg-app-panel border border-app-border rounded-xl p-5 hover:border-gray-600 transition-all cursor-pointer animate-fadeInUp" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">
                <div class="w-10 text-gray-600 font-black text-sm">#${i + 1}</div>
                <div class="flex-1 px-4">
                    <h3 class="text-[15px] font-bold text-white mb-1 group-hover:text-app-accent truncate max-w-[650px]">${m.title}</h3>
                    <div class="flex gap-4 text-[11px] text-app-text font-bold">
                        <span>LIQ: $${formatCompact(m.liq)}</span>
                        <span>VOL 24H: $${formatCompact(m.vol)}</span>
                        <span>ENDS: ${endText}</span>
                    </div>
                </div>
                <div class="w-28 text-right pr-8 border-r border-app-border">
                    <div class="text-[17px] font-black text-app-green">${m.roi.toFixed(1)}x</div>
                    <div class="text-[10px] text-app-text font-bold uppercase tracking-widest mt-0.5">ROI</div>
                </div>
                <div class="w-24 text-right pr-8">
                    <div class="text-[17px] font-black text-white">${m.price.toFixed(1)}¢</div>
                    <div class="text-[10px] text-app-text font-bold uppercase tracking-widest mt-0.5">Entry</div>
                </div>
                <button class="bg-app-accent hover:opacity-80 text-white text-[13px] font-black py-2.5 px-6 rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-900/20">
                    Trade
                </button>
            </div>
        `;
    });
}

// --- UTILS ---
function startClocks() {
    const update = () => {
        const now = new Date();
        const f = (tz) => now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute:'2-digit', timeZone: tz });
        document.getElementById('clock-nyc').innerText = f('America/New_York');
        document.getElementById('clock-ldn').innerText = f('Europe/London');
        document.getElementById('clock-tko').innerText = f('Asia/Tokyo');
    };
    update();
    setInterval(update, 10000);
}

function startRefreshCycle() {
    const bar = document.getElementById('refresh-progress');
    const label = document.getElementById('refresh-timer');
    
    setInterval(() => {
        state.timer--;
        if(state.timer < 0) {
            state.timer = CONFIG.REFRESH_CYCLE;
            fetchData();
        }
        label.innerText = state.timer + 's';
        const offset = (state.timer / CONFIG.REFRESH_CYCLE) * 100;
        bar.style.strokeDasharray = `${100 - offset}, 100`;
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

function deployFallback() {
    state.markets = [
        { title: 'Will Bitcoin hit $100k by March 31?', liq: 12000000, vol: 8500000, roi: 6.6, price: 15.0, ends: 14, slug: '#' },
        { title: 'Trump win 2024 Presidential Election?', liq: 156000000, vol: 82000000, roi: 1.8, price: 54.0, ends: 230, slug: '#' }
    ];
    applyFiltersAndRender();
}
