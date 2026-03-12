/**
 * PolyEdge OS Alpha Intelligence Engine v11.0
 * Hash-Based Unified Terminal Hub
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
    handleHashRouting();
    fetchData();
});

// --- NAVIGATION & HASH ROUTING ---
function initNavigation() {
    window.addEventListener('hashchange', handleHashRouting);
    
    // Smooth scroll and handle link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            // Hash propagation handles routing
        });
    });
}

function handleHashRouting() {
    let hash = window.location.hash.replace('#', '') || 'market';
    state.activeTab = hash;
    
    // UI Tab Switching
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById('content-' + hash);
    if(target) target.classList.remove('hidden');

    // Nav Active States
    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.dataset.target === hash) {
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
    if(hash === 'scanner') sc.classList.remove('hidden');
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

    if(close) close.onclick = closeModal;
    if(backdrop) backdrop.onclick = closeModal;

    if(sign) sign.onclick = () => {
        sign.innerHTML = `<span class="animate-spin mr-2">◌</span> Executing Alpha...`;
        sign.classList.add('pointer-events-none', 'bg-gray-600');
        setTimeout(() => {
            sign.innerHTML = `Alpha Finalized`;
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
    const count = document.getElementById('target-count');
    if(count) count.innerText = `Found ${state.filtered.length} Targets`;
    
    list.innerHTML = '';
    state.filtered.slice(0, 15).forEach((m, i) => {
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
                        <button class="flex-1 bg-green-500/10 border border-green-500/20 hover:border-green-500/40 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-[11px] text-green-500 font-bold uppercase">Yes</span><span class="text-green-500 font-bold text-xl leading-none">${m.price.toFixed(1)}¢</span></button>
                        <button class="flex-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl p-3 flex justify-between items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-[11px] text-red-500 font-bold uppercase">No</span><span class="text-red-500 font-bold text-xl leading-none">${(100-m.price).toFixed(1)}¢</span></button>
                    </div>
                </div>

                <div class="flex-1 relative z-10 flex flex-col justify-center border-b xl:border-b-0 xl:border-r border-app-border pb-6 xl:pb-0 xl:pr-6">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-bold text-app-text uppercase flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> AI OSINT Radar</span>
                        <span class="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Bullish Bias +${m.bias}%</span>
                    </div>
                    <div class="bg-black/20 p-3 rounded-lg border border-white/5 flex gap-3 items-start">
                        <div class="mt-1 text-blue-400"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg></div>
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

// --- WHALE ANALYZER ---
window.fetchWhaleData = () => {
    const btn = document.querySelector('#content-watchlist button');
    if(!btn) return;
    btn.innerHTML = `<span class="animate-spin mr-2">◌</span> Analyzing Hub...`;
    btn.classList.add('pointer-events-none', 'opacity-70');
    setTimeout(() => {
        btn.innerHTML = `Analyze`;
        btn.classList.remove('pointer-events-none', 'opacity-70');
    }, 1500);
};

// --- UTILS ---
function startClocks() {
    const update = () => {
        const now = new Date();
        const f = (tz) => now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute:'2-digit', timeZone: tz });
        const ct_nyc = document.getElementById('clock-nyc');
        const ct_ldn = document.getElementById('clock-ldn');
        if(ct_nyc) ct_nyc.innerText = f('America/New_York');
        if(ct_ldn) ct_ldn.innerText = f('Europe/London');
    };
    update(); setInterval(update, 10000);
}

function startRefreshCycle() {
    setInterval(() => {
        state.timer--;
        if(state.timer < 0) { state.timer = CONFIG.REFRESH_CYCLE; fetchData(); }
        const rt = document.getElementById('refresh-timer');
        const rp = document.getElementById('refresh-progress');
        if(rt) rt.innerText = state.timer + 's';
        if(rp) rp.style.strokeDasharray = `${100 - (state.timer/CONFIG.REFRESH_CYCLE)*100}, 100`;
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

// --- 3. WEB3 ЛОГИКА КОШЕЛЬКА (MetaMask) ---
const connectBtn = document.getElementById('connectWalletBtn');
const walletBalanceDisplay = document.getElementById('walletBalance');
let userAddress = null;

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            connectBtn.innerText = 'Connecting...';
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAddress = accounts[0];
            const formattedAddress = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
            
            connectBtn.innerText = formattedAddress;
            connectBtn.classList.remove('bg-white', 'text-black');
            connectBtn.classList.add('bg-[#1E2433]', 'text-blue-400', 'border', 'border-blue-500/30');

            if(walletBalanceDisplay) walletBalanceDisplay.innerText = '12,450.00';

        } catch (error) {
            console.error("Пользователь отклонил запрос", error);
            connectBtn.innerText = 'Connect';
        }
    } else {
        alert('Please install MetaMask or Rabby Wallet to use PolyEdge!');
    }
}

if(connectBtn) {
    connectBtn.addEventListener('click', connectWallet);
}

if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            connectBtn.innerText = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        } else {
            connectBtn.innerText = 'Connect';
            connectBtn.classList.add('bg-white', 'text-black');
            connectBtn.classList.remove('bg-[#1E2433]', 'text-blue-400', 'border', 'border-blue-500/30');
            if(walletBalanceDisplay) walletBalanceDisplay.innerText = '0.00';
        }
    });
}
