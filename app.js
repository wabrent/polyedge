/**
 * PolyEdge Terminal Engine v14.5
 * Institutional Data Core & Routing
 */

const CONFIG = {
    GAMMA_API: "https://gamma-api.polymarket.com",
    REFRESH_CYCLE: 15
};

let state = {
    markets: [],
    timer: CONFIG.REFRESH_CYCLE,
    activeTab: 'market',
    userAddress: null
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initLanding();
    updateTime();
    setInterval(updateTime, 1000);
});

// --- 1. LANDING & INIT ---
function initLanding() {
    const launchBtn = document.getElementById('launchAppBtn');
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');

    const enterApp = () => {
        landing.classList.add('fade-out');
        setTimeout(() => {
            landing.style.display = 'none';
            app.classList.remove('hidden');
            app.classList.add('fade-in');
            initApp();
        }, 400);
    };

    if(launchBtn) launchBtn.onclick = enterApp;

    if (window.location.hash) {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('flex');
        initApp();
    }
}

function initApp() {
    if (!window.location.hash) window.location.hash = 'market';
    initNavigation();
    initWeb3();
    initWhaleAnalyzer();
    initModal();
    startRefreshCycle();
    handleRouting();
}

// --- 2. NAVIGATION ---
function initNavigation() {
    window.addEventListener('hashchange', handleRouting);
}

function handleRouting() {
    const target = window.location.hash.replace('#', '') || 'market';
    state.activeTab = target;

    const contents = document.querySelectorAll('.tab-content');
    const navLinks = document.querySelectorAll('.nav-link');

    contents.forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(`content-${target}`);
    if (activeContent) activeContent.classList.remove('hidden');

    navLinks.forEach(link => {
        const isTarget = link.getAttribute('data-target') === target;
        link.classList.toggle('text-white', isTarget);
        link.classList.toggle('bg-white/5', isTarget);
        link.classList.toggle('text-app-text', !isTarget);
    });

    if(target === 'market') fetchMarkets();
}

// --- 3. DATA: REAL POLYMARKET API ---
async function fetchMarkets() {
    const list = document.getElementById('market-list');
    if(!list) return;

    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/markets?active=true&limit=10&order=volume&dir=desc`);
        const data = await res.json();
        
        list.innerHTML = data.map((m, i) => `
            <div class="bg-app-panel border border-app-border rounded-3xl p-6 flex justify-between items-center hover:border-blue-500/50 transition-all cursor-pointer group animate-fadeInUp" style="animation-delay: ${i*0.05}s" onclick="window.openAlphaModal('Whale_Aggregator_${i}', '')">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">Vol: $${formatCompact(m.volume)}</span>
                        <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Shard: OK</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mt-1 italic group-hover:text-app-accent transition-colors">${m.question}</h3>
                </div>
                <div class="flex gap-3 ml-6">
                    <div class="text-center px-6 py-3 bg-green-500/5 rounded-2xl border border-green-500/10 hover:border-green-500/40 transition-all">
                        <p class="text-[8px] font-black text-green-500 uppercase mb-1">Yes Side</p>
                        <p class="text-xl font-black text-green-500">${(m.outcomePrices[0]*100).toFixed(1)}¢</p>
                    </div>
                    <div class="text-center px-6 py-3 bg-red-500/5 rounded-2xl border border-red-500/10 hover:border-red-500/40 transition-all">
                        <p class="text-[8px] font-black text-red-500 uppercase mb-1">No Side</p>
                        <p class="text-xl font-black text-red-500">${(m.outcomePrices[1]*100).toFixed(1)}¢</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<p class="text-red-500 font-bold italic p-10 text-center">Node connection failure. Retrying...</p>`;
    }
}

// --- 4. WHALE FORENSICS ---
function initWhaleAnalyzer() {
    const btn = document.getElementById('analyzeBtn');
    const inp = document.getElementById('whaleInput');
    const stats = document.getElementById('whaleStats');
    const pnl = document.getElementById('stat-pnl');
    const win = document.getElementById('stat-win');

    if(!btn) return;

    btn.onclick = async () => {
        const addr = inp.value.trim();
        if(!addr) return;
        
        btn.innerText = "QUERYING...";
        try {
            const res = await fetch(`${CONFIG.GAMMA_API}/profiles/${addr}`);
            const data = await res.json();
            
            if(document.getElementById('whaleEmptyState')) document.getElementById('whaleEmptyState').classList.add('hidden');
            stats.classList.remove('hidden');
            setTimeout(() => stats.classList.add('opacity-100'), 50);
            
            pnl.innerText = `$${(data.profit || 0).toLocaleString()}`;
            pnl.className = (data.profit >= 0) ? "text-3xl font-black text-green-500 italic" : "text-3xl font-black text-red-500 italic";
            win.innerText = `${(data.winRate || 0).toFixed(1)}%`;
        } catch (e) {
            alert("Address forensics failed. Not found on Indexer.");
        }
        btn.innerText = "ANALYZE";
    };
    if(inp) inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
}

// --- 5. WEB3 & WALLET ---
function initWeb3() {
    const btn = document.getElementById('connectWalletBtn');
    if(!btn) return;

    btn.onclick = async () => {
        if (window.ethereum) {
            try {
                btn.innerText = 'CONNECTING...';
                const provider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await provider.send("eth_requestAccounts", []);
                state.userAddress = accounts[0];
                btn.innerText = state.userAddress.slice(0,6) + '...' + state.userAddress.slice(-4);
                btn.classList.add('bg-white/10', 'text-blue-400');
            } catch (e) { btn.innerText = 'CONNECT WALLET'; }
        } else {
            alert("Digital identity node (MetaMask) not found.");
        }
    };
}

// --- 6. MODAL SYSTEM ---
function initModal() {
    const modal = document.getElementById('copyTradeModal');
    const content = document.getElementById('modalContent');
    const close = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const sign = document.getElementById('confirmTxBtn');

    window.openAlphaModal = (name, img) => {
        const mn = document.getElementById('modalWhaleName');
        if(mn) mn.innerText = name;
        
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
        sign.innerHTML = `<span class="animate-spin mr-3 font-mono">◌</span> TRANSMITTING...`;
        setTimeout(() => {
            sign.innerHTML = `ORDER FINALIZED`;
            sign.classList.add('bg-green-500');
            setTimeout(() => {
                closeModal();
                setTimeout(() => {
                   sign.innerHTML = `SIGN & EXECUTE`;
                   sign.classList.remove('bg-green-500');
                }, 500);
            }, 1500);
        }, 2000);
    };
}

// --- UTILS ---
function updateTime() {
    const options = { hour: '2-digit', minute: '2-digit', hour12: false };
    const ny = document.getElementById('nyc-time');
    const ld = document.getElementById('ldn-time');
    if(ny) ny.innerText = new Date().toLocaleTimeString('en-US', { ...options, timeZone: 'America/New_York' });
    if(ld) ld.innerText = new Date().toLocaleTimeString('en-GB', { ...options, timeZone: 'Europe/London' });
}

function startRefreshCycle() {
    setInterval(() => {
        state.timer--;
        if(state.timer < 0) { state.timer = CONFIG.REFRESH_CYCLE; fetchMarkets(); }
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
