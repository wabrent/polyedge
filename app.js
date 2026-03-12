/**
 * PolyEdge Alpha Intelligence Engine v9.0
 * Advanced AI-integrated trading terminal for Polymarket Builders.
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false',
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

            navLinks.forEach(l => l.classList.remove('bg-app-activeTab', 'text-white'));
            link.classList.add('bg-app-activeTab', 'text-white');

            title.innerText = link.dataset.title;
            subtitle.innerText = link.dataset.subtitle;

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

    if(roiInput) roiInput.oninput = (e) => {
        state.filters.roi = parseInt(e.target.value);
        document.getElementById('val-roi').innerText = state.filters.roi + 'x';
        applyFiltersAndRender();
    };

    if(liqInput) liqInput.oninput = (e) => {
        const val = parseInt(e.target.value);
        state.filters.liq = val * 1000;
        document.getElementById('val-liq').innerText = '$' + val + 'K';
        applyFiltersAndRender();
    };

    if(searchInput) searchInput.oninput = (e) => {
        state.query = e.target.value.toLowerCase();
        applyFiltersAndRender();
    };
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

        // Mocking advanced AI Intelligence data
        const smartScore = Math.floor(Math.random() * 30) + 70; // 70-99
        const bias = (Math.random() * 20 - 5).toFixed(1); // -5% to +15%
        
        return {
            id: m.id,
            title: m.question,
            liq: parseFloat(m.liquidity) || 0,
            vol: parseFloat(m.volume24h) || 0,
            roi: roi,
            price: yes * 100,
            ends: m.endDate ? Math.floor((new Date(m.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
            slug: m.slug,
            smartScore,
            bias
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

    if(state.activeTab === 'scanner') {
        state.filtered.sort((a,b) => b.roi - a.roi);
    } else {
        state.filtered.sort((a,b) => b.vol - a.vol);
    }

    render();
}

// --- RENDERING ALPHA CARDS ---
function render() {
    const container = document.getElementById('content-container');
    const count = document.getElementById('target-count');
    if(!container) return;

    count.innerText = `Found ${state.filtered.length} targets`;
    container.innerHTML = '';

    state.filtered.slice(0, 15).forEach((m, i) => {
        const endText = m.ends < 0 ? 'Ended' : `${m.ends}d`;
        const biasColor = m.bias > 0 ? 'text-green-400' : 'text-red-400';
        const biasBg = m.bias > 0 ? 'bg-green-400/10' : 'bg-red-400/10';
        const biasSign = m.bias > 0 ? '+' : '';

        container.innerHTML += `
            <div class="bg-app-panel border border-app-border rounded-2xl p-6 flex flex-col xl:flex-row gap-6 hover:border-[#3B82F6]/50 transition-all group relative overflow-hidden animate-fadeInUp mb-4">
                
                <div class="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>

                <!-- COLUMN 1: MARKET CORE -->
                <div class="flex-1 flex flex-col justify-between relative z-10 border-b xl:border-b-0 xl:border-r border-app-border pb-6 xl:pb-0 xl:pr-6">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <span class="text-purple-400 font-black text-xs">${m.smartScore}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-purple-400 font-bold uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md">Smart Score: ${m.roi > 10 ? 'Alpha' : 'Beta'}</span>
                                <h3 class="text-lg font-bold text-white mt-1 leading-tight group-hover:text-blue-400 transition-colors">${m.title}</h3>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-5 text-xs text-app-text font-medium mb-6">
                        <span class="flex items-center gap-1.5"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg> Vol: <b class="text-white">$${formatCompact(m.vol)}</b></span>
                        <span class="flex items-center gap-1.5"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Liq: <b class="text-white">$${formatCompact(m.liq)}</b></span>
                        <span class="flex items-center gap-1.5 text-blue-400"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Ends: ${endText}</span>
                    </div>

                    <div class="flex gap-3 mt-auto">
                        <button class="flex-1 bg-green-500/10 border border-green-500/20 hover:border-green-500/50 hover:bg-green-500/20 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">
                            <span class="text-[11px] text-green-500 font-bold tracking-widest uppercase">Yes</span>
                            <span class="text-green-500 font-bold text-xl leading-none">${m.price.toFixed(1)}¢</span>
                        </button>
                        <button class="flex-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/20 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">
                            <span class="text-[11px] text-red-500 font-bold tracking-widest uppercase">No</span>
                            <span class="text-red-500 font-bold text-xl leading-none">${(100-m.price).toFixed(1)}¢</span>
                        </button>
                    </div>
                </div>

                <!-- COLUMN 2: AI OSINT RADAR -->
                <div class="flex-1 relative z-10 flex flex-col justify-center border-b xl:border-b-0 xl:border-r border-app-border pb-6 xl:pb-0 xl:pr-6">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-bold text-app-text uppercase tracking-widest flex items-center gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> AI OSINT Radar
                        </span>
                        <span class="text-[10px] font-mono ${biasColor} ${biasBg} px-2 py-0.5 rounded">${m.bias > 0 ? 'Bullish' : 'Bearish'} Bias ${biasSign}${m.bias}%</span>
                    </div>
                    
                    <div class="space-y-3">
                        <div class="flex gap-3 items-start bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <div class="mt-1 text-blue-400"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg></div>
                            <div>
                                <p class="text-[11px] text-white/90 leading-snug">"Insider movements detected on Polygon scan. Whale accumulation signal active."</p>
                                <p class="text-[9px] text-app-text mt-1">Impact: <span class="text-green-400">High (YES)</span> • 14 mins ago</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUMN 3: WHALES & COPY -->
                <div class="flex-1 relative z-10 flex flex-col justify-center h-full">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-bold text-app-text uppercase tracking-widest">Smart Money Activity</span>
                        <span class="text-[10px] text-app-text">Last 24h</span>
                    </div>
                    
                    <div class="space-y-2 mb-4 flex-grow">
                        <div class="flex justify-between items-center group/whale cursor-pointer bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all">
                            <div class="flex items-center gap-2">
                                <img src="https://ui-avatars.com/api/?name=0x&background=3B82F6&color=fff&rounded=true&size=32" class="w-6 h-6 rounded-full">
                                <div>
                                    <p class="text-xs font-bold text-white group-hover/whale:text-blue-400">0xMacroGenius</p>
                                    <p class="text-[9px] text-green-400">Winrate: 82% (Macro)</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-xs font-bold text-green-500">+$45k <span class="text-[9px] text-app-text uppercase">YES</span></p>
                            </div>
                        </div>
                    </div>

                    <button class="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex justify-center items-center gap-2">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        1-Click Copy Whales
                    </button>
                </div>
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
        if(label) label.innerText = state.timer + 's';
        if(bar) {
            const offset = (state.timer / CONFIG.REFRESH_CYCLE) * 100;
            bar.style.strokeDasharray = `${100 - offset}, 100`;
        }
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

function deployFallback() {
    state.markets = [
        { title: 'Will Bitcoin hit $100k by March 31?', liq: 12000000, vol: 8500000, roi: 6.6, price: 15.0, ends: 14, slug: '#', smartScore: 94, bias: 12.4 },
        { title: 'Trump win 2024 Presidential Election?', liq: 156000000, vol: 82000000, roi: 1.8, price: 54.0, ends: 230, slug: '#', smartScore: 82, bias: -2.1 }
    ];
    applyFiltersAndRender();
}
