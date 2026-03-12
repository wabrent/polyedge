/**
 * PolyEdge Pro Terminal Engine v13.0
 * Authentication & Private State Management
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
    filters: { roi: 5, liq: 10000 },
    userAddress: null,
    isLoggedIn: false,
    walletMenuOpen: false
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initViewSwitching();
    initNavigation();
    initControls();
    initModal();
    initWeb3();
    initWhaleAnalyzer();
    startClocks();
    startRefreshCycle();
    handleHashRouting();
    fetchData();
});

// --- 1. AUTHENTICATION ---
function initAuth() {
    const authModal = document.getElementById('auth-modal');
    const authContent = document.getElementById('auth-content');
    const loginBtns = ['loginGoogle', 'loginApple', 'loginMagic'];

    loginBtns.forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.onclick = () => {
            state.isLoggedIn = true;
            closeAuthModal();
            enterApp();
        };
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = handleLogout;

    window.openAuthModal = () => {
        authModal.classList.remove('hidden');
        authModal.classList.add('flex');
        setTimeout(() => {
            authContent.classList.remove('scale-95', 'opacity-0');
            authContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    window.closeAuthModal = () => {
        authContent.classList.replace('scale-100', 'scale-95');
        authContent.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => authModal.classList.add('hidden'), 300);
    };
}

function handleLogout() {
    state.isLoggedIn = false;
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('landing-view').classList.remove('hidden');
    window.location.hash = '';
}

function enterApp() {
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    landing.classList.add('fade-out');
    setTimeout(() => {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('fade-in');
        window.location.hash = '#market';
    }, 400);
}

// --- 2. VIEW SWITCHING ---
function initViewSwitching() {
    const launchBtn = document.getElementById('launchAppBtn');
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');

    if(launchBtn) {
        launchBtn.onclick = () => {
            if(!state.isLoggedIn) openAuthModal();
            else enterApp();
        };
    }

    const currentHash = window.location.hash.replace('#', '');
    if (currentHash) {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('flex');
        state.isLoggedIn = true; // Auto-login if hash exists (simulated)
    }
}

// --- 3. NAVIGATION ---
function initNavigation() {
    window.addEventListener('hashchange', handleHashRouting);
}

function handleHashRouting() {
    let hash = window.location.hash.replace('#', '') || 'market';
    state.activeTab = hash;
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById('content-' + hash);
    if(target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.dataset.target === hash) {
            l.classList.add('bg-app-activeTab', 'text-white');
            l.classList.remove('text-app-text');
            const pt = document.getElementById('page-title');
            const ps = document.getElementById('page-subtitle');
            if(pt) pt.innerText = l.dataset.title;
            if(ps) ps.innerText = l.dataset.subtitle;
        } else {
            l.classList.remove('bg-app-activeTab', 'text-white');
            l.classList.add('text-app-text');
        }
    });

    render();
}

// --- 4. CONTROLS ---
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

// --- 5. MODAL SYSTEM ---
function initModal() {
    const modal = document.getElementById('copyTradeModal');
    const content = document.getElementById('modalContent');
    const close = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const sign = document.getElementById('confirmTxBtn');

    window.openAlphaModal = (name, img) => {
        const mn = document.getElementById('modalWhaleName');
        const mi = document.getElementById('modalWhaleImg');
        if(mn) mn.innerText = name;
        if(mi) mi.src = img || `https://ui-avatars.com/api/?name=${name}&background=3B82F6&color=fff`;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    const closeModal = () => {
        content.classList.replace('scale-100', 'scale-95');
        content.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    if(close) close.onclick = closeModal;
    if(backdrop) backdrop.onclick = closeModal;

    if(sign) sign.onclick = () => {
        sign.innerHTML = `<span class="animate-spin mr-2 text-[10px]">◌</span> Confirming Wallet...`;
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

// --- 6. WEB3 & WALLET MENU ---
function initWeb3() {
    const btn = document.getElementById('connectWalletBtn');
    const menu = document.getElementById('wallet-menu');
    const disconnectBtn = document.getElementById('disconnectWalletBtn');
    const balFull = document.getElementById('wallet-balance-full');
    const addrFull = document.getElementById('wallet-address-full');
    const icon = document.getElementById('wallet-icon');

    const toggleMenu = (val) => {
        state.walletMenuOpen = val !== undefined ? val : !state.walletMenuOpen;
        menu.classList.toggle('hidden', !state.walletMenuOpen);
    };

    window.addEventListener('click', () => toggleMenu(false));
    if(btn) btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if(state.userAddress) toggleMenu();
        else connect();
    });

    const connect = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                btn.innerText = 'Connecting...';
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                state.userAddress = accounts[0];
                updateWalletUI();
            } catch (e) { btn.innerText = 'Connect'; }
        } else { alert('MetaMask not detected'); }
    };

    function updateWalletUI() {
        if(state.userAddress) {
            const fmt = state.userAddress.slice(0, 6) + '...' + state.userAddress.slice(-4);
            btn.innerText = fmt;
            btn.classList.replace('bg-blue-600', 'bg-white/10');
            btn.classList.add('text-blue-400');
            if(addrFull) addrFull.innerText = state.userAddress;
            if(icon) icon.innerText = state.userAddress.slice(2,4).toUpperCase();
            if(balFull) balFull.innerText = '12,450.00';
        } else {
            btn.innerText = 'Connect';
            btn.classList.replace('bg-white/10', 'bg-blue-600');
            btn.classList.remove('text-blue-400');
            toggleMenu(false);
        }
    }

    if(disconnectBtn) disconnectBtn.onclick = () => {
        state.userAddress = null;
        updateWalletUI();
    };

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            state.userAddress = accounts.length > 0 ? accounts[0] : null;
            updateWalletUI();
        });
    }
}

// --- 7. WHALE ANALYZER ---
function initWhaleAnalyzer() {
    const btn = document.getElementById('analyzeBtn');
    const inp = document.getElementById('whaleInput');
    const es = document.getElementById('whaleEmptyState');
    const dc = document.getElementById('whaleDataContainer');
    const dp = document.getElementById('dynamicProfit');

    if(btn) {
        btn.onclick = () => {
            const val = inp.value.trim();
            if(!val) { inp.classList.add('border-red-500'); setTimeout(()=>inp.classList.remove('border-red-500'), 1000); return; }
            
            btn.innerHTML = `<span class="animate-spin mr-2 text-[10px]">◌</span> Fetching...`;
            dc.classList.add('opacity-0');
            
            setTimeout(() => {
                btn.innerHTML = 'Analyze';
                if(es) es.classList.add('hidden');
                if(dc) dc.classList.remove('hidden');
                const profit = Math.floor(Math.random() * 200000) + 50000;
                if(dp) dp.innerText = `+$${profit.toLocaleString()}`;
                setTimeout(() => dc.classList.remove('opacity-0'), 50);
            }, 1500);
        };
        if(inp) inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
    }
}

// --- 8. DATA ENGINE ---
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

function render() {
    if(state.activeTab === 'market') renderMarketList();
    if(state.activeTab === 'scanner') renderScannerList();
}

function renderMarketList() {
    const list = document.getElementById('market-list');
    if(!list) return;
    state.filtered = state.markets.sort((a,b) => b.vol - a.vol);
    list.innerHTML = '';
    state.filtered.slice(0, 15).forEach((m, i) => {
        const whale = { name: ['0xMacroGenius', 'PolyWhale_V2', 'AlphaKing'][i%3], img: `https://ui-avatars.com/api/?name=${i}&background=3B82F6&color=fff` };
        list.innerHTML += `
            <div class="bg-app-panel border border-app-border rounded-3xl p-6 flex flex-col xl:flex-row gap-8 hover:border-[#3B82F6]/30 transition-all group animate-fadeInUp" style="animation-delay: ${i*0.1}s">
                <div class="flex-1 space-y-6">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-400 font-black text-xl italic">${m.title.charAt(0)}</div>
                        <div>
                            <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">Smart Score: ${m.smartScore}</span>
                            <h3 class="text-xl font-bold text-white mt-1 leading-snug group-hover:text-app-accent transition-colors">${m.title}</h3>
                        </div>
                    </div>
                    <div class="flex gap-6 text-xs text-app-text font-bold uppercase tracking-wider">
                        <span>Vol: <b class="text-white">$${formatCompact(m.vol)}</b></span>
                        <span>Liq: <b class="text-white">$${formatCompact(m.liq)}</b></span>
                        <span class="text-blue-500">Ends: ${m.ends}d</span>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button class="flex-1 bg-green-500/10 border border-green-500/20 hover:border-green-500/40 rounded-2xl py-4 flex justify-between px-6 items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-xs font-black uppercase text-green-500">YES</span><span class="text-xl font-black text-green-500">${m.price.toFixed(1)}¢</span></button>
                        <button class="flex-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-2xl py-4 flex justify-between px-6 items-center transition-all" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')"><span class="text-xs font-black uppercase text-red-500">NO</span><span class="text-xl font-black text-red-500">${(100-m.price).toFixed(1)}¢</span></button>
                    </div>
                </div>
                <div class="w-full xl:w-[320px] bg-black/20 rounded-2xl border border-white/5 p-5 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Top Whale Move</p>
                        <div class="flex items-center gap-3">
                            <img src="${whale.img}" class="w-10 h-10 rounded-full">
                            <div><p class="text-sm font-bold text-white">${whale.name}</p><p class="text-[10px] text-green-500 font-bold">+$45,000 Position</p></div>
                        </div>
                    </div>
                    <button onclick="window.openAlphaModal('${whale.name}', '${whale.img}')" class="mt-6 w-full bg-blue-600 text-white font-black uppercase py-3 rounded-xl hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-95">1-Click Copy</button>
                </div>
            </div>`;
    });
}

function renderScannerList() {
    const list = document.getElementById('scanner-list');
    if(!list) return;
    state.filtered = state.markets.filter(m => m.roi >= state.filters.roi).sort((a,b) => b.roi - a.roi);
    list.innerHTML = '';
    state.filtered.slice(0, 30).forEach((m, i) => {
        list.innerHTML += `
            <div class="flex items-center bg-app-panel border border-app-border rounded-xl p-4 hover:border-gray-600 cursor-pointer transition-all animate-fadeInUp" style="animation-delay: ${i*0.02}s" onclick="window.open('https://polymarket.com/market/${m.slug}', '_blank')">
                <div class="w-10 text-gray-500 font-bold text-xs">#${i+1}</div>
                <div class="flex-1 min-w-0"><h3 class="text-[15px] font-bold text-white mb-0.5 truncate pr-4">${m.title}</h3><div class="flex gap-4 text-[10px] text-app-text uppercase font-black"><span>LIQ: $${formatCompact(m.liq)}</span><span>ENDS: ${m.ends}d</span></div></div>
                <div class="w-32 text-right pr-6 border-r border-app-border"><div class="text-[16px] font-black text-green-500">${m.roi.toFixed(1)}x</div><div class="text-[9px] text-app-text uppercase font-bold mt-0.5">ROI Possible</div></div>
                <button class="ml-6 bg-blue-600 text-white text-[11px] font-black py-2 px-6 rounded-lg hover:bg-blue-500 transition-all uppercase whitespace-nowrap">Trade</button>
            </div>`;
    });
}

// --- UTILS ---
function startClocks() {
    const update = () => {
        const now = new Date();
        const f = (tz) => now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute:'2-digit', timeZone: tz });
        const ny = document.getElementById('clock-nyc');
        const ld = document.getElementById('clock-ldn');
        if(ny) ny.innerText = f('America/New_York');
        if(ld) ld.innerText = f('Europe/London');
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

function deployFallback() {
    state.markets = [{ title:'BTC hit $100k?', liq:12000000, vol:8000000, roi:6.6, price:15.0, ends:14, slug:'#', smartScore:94, bias:12.4 }];
    render();
}
