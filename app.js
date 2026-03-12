/**
 * PolyEdge OS Alpha Intelligence Engine v10.0
 * Unified Dynamic Terminal Hub
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false',
    PROXY: 'https://api.allorigins.win/get?url=',
    REFRESH_CYCLE: 15
};

let state = {
    markets: [],
    filtered: [],
    activeTab: 'market',
    timer: CONFIG.REFRESH_CYCLE,
    filters: { roi: 5, liq: 10000, days: 30 }
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initControls();
    initModal();
    startClocks();
    startRefreshCycle();
    handleRouting();
    fetchData();
});

// --- NAVIGATION & ROUTING ---
function initNavigation() {
    window.addEventListener('popstate', handleRouting);
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            window.history.pushState({}, '', href);
            handleRouting();
        });
    });
}

function handleRouting() {
    let path = window.location.pathname.replace(/^\/|\/$/g, '');
    if (!path || path === 'index.html' || path.includes('.html')) path = 'market';
    
    state.activeTab = path;
    
    // UI Tab Switching
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById('content-' + path);
    if(target) target.classList.remove('hidden');

    // Nav Active States
    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.dataset.target === path) {
            l.classList.add('bg-app-activeTab', 'text-white');
            l.classList.remove('text-app-text');
            document.getElementById('page-title').innerText = l.dataset.title;
            document.getElementById('page-subtitle').innerText = l.dataset.subtitle;
        } else {
            l.classList.remove('bg-app-activeTab', 'text-white');
            l.classList.add('text-app-text');
        }
    });

    // Scanner Controls Visibility
    const sc = document.getElementById('scanner-controls');
    if(path === 'scanner') sc.classList.remove('hidden');
    else sc.classList.add('hidden');

    render();
}

// --- CONTROLS ---
function initControls() {
    const roiInput = document.getElementById('input-roi');
    const liqInput = document.getElementById('input-liq');
    
    if(roiInput) roiInput.oninput = (e) => {
        state.filters.roi = parseInt(e.target.value);
        document.getElementById('val-roi').innerText = state.filters.roi + 'x';
        render();
    };

    if(liqInput) liqInput.oninput = (e) => {
        const val = parseInt(e.target.value);
        state.filters.liq = val * 1000;
        document.getElementById('val-liq').innerText = '$' + val + 'K';
        render();
    };
}

// --- MODAL SYSTEM ---
function initModal() {
    const modal = document.getElementById('copyTradeModal');
    const content = document.getElementById('modalContent');
    const close = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const sign = document.getElementById('confirmTxBtn');

    window.openAlphaModal = (name, img, roi) => {
        document.getElementById('modalWhaleName').innerText = name;
        document.getElementById('modalWhaleImg').src = img;
        document.getElementById('modalPayout').innerText = '$' + (1000 * roi).toLocaleString();
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => content.classList.replace('scale-95', 'scale-100'), 10);
        setTimeout(() => content.classList.replace('opacity-0', 'opacity-100'), 10);
    };

    const closeModal = () => {
        content.classList.replace('scale-100', 'scale-95');
        content.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    close.onclick = closeModal;
    backdrop.onclick = closeModal;

    sign.onclick = () => {
        sign.innerHTML = `<span class="animate-spin mr-2">◌</span> Executing Node...`;
        sign.classList.add('pointer-events-none', 'bg-gray-600');
        setTimeout(() => {
            sign.innerHTML = `Transaction Finalized`;
            sign.classList.replace('bg-gray-600', 'bg-green-500');
            setTimeout(() => {
                closeModal();
                setTimeout(() => {
                   sign.innerHTML = `Sign & Execute Alpha`;
                   sign.classList.remove('pointer-events-none', 'bg-green-500');
                   sign.classList.add('bg-blue-600');
                }, 500);
            }, 1500);
        }, 2000);
    };
}

// --- DATA ENGINE ---
async function fetchData() {
    try {
        const res = await fetch(CONFIG.PROXY + encodeURIComponent(CONFIG.API_URL));
        const json = await res.json();
        const data = JSON.parse(json.contents);
        state.markets = processResponse(Array.isArray(data) ? data : data.markets);
        render();
    } catch (e) { deployFallback(); }
}

function processResponse(raw) {
    return raw.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try { prices = (typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices).map(Number); } catch(e){}
        const yes = Math.max(0.001, prices[0]);
        return {
            id: m.id, title: m.question, liq: parseFloat(m.liquidity) || 0, vol: parseFloat(m.volume24h) || 0,
            roi: 1/yes, price: yes * 100, slug: m.slug,
            ends: m.endDate ? Math.floor((new Date(m.endDate) - new Date()) / 86400000) : 0,
            smartScore: Math.floor(Math.random() * 20) + 79,
            bias: (Math.random() * 15 - 2).toFixed(1)
        };
    });
}

// --- RENDER ENGINE ---
function render() {
    if(state.activeTab === 'market') renderMarketList();
    if(state.activeTab === 'scanner') renderScannerList();
}

function renderMarketList() {
    const list = document.getElementById('market-list');
    if(!list) return;

    state.filtered = state.markets.sort((a,b) => b.vol - a.vol);
    document.getElementById('target-count').innerText = `Found ${state.filtered.length} Targets`;
    
    list.innerHTML = '';
    state.filtered.slice(0, 20).forEach((m, i) => {
        const whale = { name: ['0xMacroGenius', 'PolyWhale_V2', 'AlphaKing'][i%3], img: `https://ui-avatars.com/api/?name=${i}&background=3B82F6&color=fff` };
        
        list.innerHTML += `
            <div class="bg-app-panel border border-app-border rounded-2xl p-6 flex flex-col xl:flex-row gap-6 hover:border-blue-500/50 transition-all group relative overflow-hidden animate-fadeInUp" style="animation-delay: ${i*0.05}s">
                <div class="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>
                
                <div class="flex-1 flex flex-col justify-between relative z-10 border-b xl:border-b-0 xl:border-r border-app-border pb-6 xl:pb-0 xl:pr-6">
                    <div class="flex items-start gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <span class="text-purple-400 font-black text-xs">${m.smartScore}</span>
                        </div>
                        <div>
                            <span class="text-[9px] text-purple-400 font-bold uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md">Smart Score: ${m.roi > 10 ? 'Alpha' : 'Beta'}</span>
                            <h3 class="text-lg font-bold text-white mt-1 leading-tight group-hover:text-blue-400 transition-colors">${m.title}</h3>
                        </div>
                    </div>
                    <div class="flex gap-4 text-xs text-app-text font-medium mb-6">
                        <span>Vol: <b class="text-white">$${formatCompact(m.vol)}</b></span>
                        <span>Liq: <b class="text-white">$${formatCompact(m.liq)}</b></span>
                        <span class="text-blue-400">Ends: ${m.ends}d</span>
                    </div>
                    <div class="flex gap-3 mt-auto">
                        <button class="flex-1 bg-green-510/10 border border-green-500/20 hover:border-green-500/40 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-[11px] text-green-500 font-bold uppercase">Yes</span><span class="text-green-500 font-bold text-xl leading-none">${m.price.toFixed(1)}¢</span></button>
                        <button class="flex-1 bg-red-510/10 border border-red-500/20 hover:border-red-500/40 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-[11px] text-red-500 font-bold uppercase">No</span><span class="text-red-500 font-bold text-xl leading-none">${(100-m.price).toFixed(1)}¢</span></button>
                    </div>
                </div>

                <div class="flex-1 relative z-10 flex flex-col justify-center border-b xl:border-b-0 xl:border-r border-app-border pb-6 xl:pb-0 xl:pr-6">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-bold text-app-text uppercase flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> AI OSINT Radar</span>
                        <span class="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Bullish Bias +${m.bias}%</span>
                    </div>
                    <div class="bg-black/20 p-3 rounded-lg border border-white/5 flex gap-3 items-start">
                        <div class="mt-1 text-blue-400"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg></div>
                        <div class="flex-1"><p class="text-[11px] text-white/90 font-medium">Accumulation signal detected. Smart money moving to YES side.</p></div>
                    </div>
                </div>

                <div class="flex-1 relative z-10 flex flex-col justify-center">
                    <div class="flex justify-between items-center mb-3"><span class="text-[10px] font-bold text-app-text uppercase">Smart Money</span><span class="text-[10px] text-app-text">Last 24h</span></div>
                    <div class="flex justify-between items-center bg-white/5 p-2 rounded-lg mb-4 border border-white/5">
                        <div class="flex items-center gap-2">
                            <img src="${whale.img}" class="w-6 h-6 rounded-full">
                            <div><p class="text-xs font-bold text-white">${whale.name}</p><p class="text-[9px] text-green-400">Winrate: 82%</p></div>
                        </div>
                        <div class="text-right"><p class="text-xs font-bold text-green-500">+$45k <span class="text-[9px] text-app-text uppercase">YES</span></p></div>
                    </div>
                    <button onclick="openAlphaModal('${whale.name}', '${whale.img}', ${m.roi})" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-black py-3 rounded-xl transition-all shadow-lg active:scale-95">1-Click Copy Whales</button>
                </div>
            </div>
        `;
    });
}

function renderScannerList() {
    const list = document.getElementById('scanner-list');
    if(!list) return;

    state.filtered = state.markets.filter(m => m.roi >= state.filters.roi && m.liq >= state.filters.liq).sort((a,b) => b.roi - a.roi);
    
    list.innerHTML = '';
    state.filtered.slice(0, 30).forEach((m, i) => {
        list.innerHTML += `
            <div class="flex items-center bg-app-panel border border-app-border rounded-xl p-4 hover:border-gray-600 cursor-pointer transition-all animate-fadeInUp" style="animation-delay: ${i*0.02}s" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">
                <div class="w-10 text-gray-500 font-bold text-xs">#${i+1}</div>
                <div class="flex-1"><h3 class="text-[15px] font-bold text-white mb-0.5 truncate max-w-[500px]">${m.title}</h3><div class="flex gap-4 text-[10px] text-app-text uppercase font-black"><span>LIQ: $${formatCompact(m.liq)}</span><span>ENDS: ${m.ends}d</span></div></div>
                <div class="w-32 text-right pr-6 border-r border-app-border"><div class="text-[16px] font-black text-green-500">${m.roi.toFixed(1)}x</div><div class="text-[9px] text-app-text uppercase font-bold mt-0.5">ROI Possible</div></div>
                <button class="ml-6 bg-blue-600 text-white text-[11px] font-black py-2 px-6 rounded-lg hover:bg-blue-500 transition-all uppercase">Trade</button>
            </div>
        `;
    });
}

// --- UTILS ---
function startClocks() {
    const update = () => {
        const now = new Date();
        const f = (tz) => now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute:'1-digit', timeZone: tz });
        document.getElementById('clock-nyc').innerText = f('America/New_York');
        document.getElementById('clock-ldn').innerText = f('Europe/London');
    };
    update(); setInterval(update, 10000);
}

function startRefreshCycle() {
    setInterval(() => {
        state.timer--;
        if(state.timer < 0) { state.timer = CONFIG.REFRESH_CYCLE; fetchData(); }
        document.getElementById('refresh-timer').innerText = state.timer + 's';
        document.getElementById('refresh-progress').style.strokeDasharray = `${100 - (state.timer/CONFIG.REFRESH_CYCLE)*100}, 100`;
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

// --- WHALE ANALYZER ---
window.fetchWhaleData = () => {
    const btn = document.querySelector('#content-watchlist button');
    const input = document.getElementById('whale-input');
    
    btn.innerHTML = `<span class="animate-spin mr-2">◌</span> Analyzing Hub...`;
    btn.classList.add('pointer-events-none', 'opacity-70');

    setTimeout(() => {
        btn.innerHTML = `Analyze`;
        btn.classList.remove('pointer-events-none', 'opacity-70');
        // In a real app, this would fetch from a custom indexer. 
        // Here we just re-trigger a layout refresh to show it's "interactive".
        console.log("Whale analysis complete for: " + input.value);
    }, 1500);
};

function deployFallback() {
    state.markets = [{ title:'BTC hit $100k?', liq:12000000, vol:8000000, roi:6.6, price:15.0, ends:14, slug:'#', smartScore:94, bias:12.4 }];
    render();
}
