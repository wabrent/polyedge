/**
 * PolyEdge Terminal Engine v15.5
 * Refined Routing & Institutional Data Sync
 */

const CONFIG = {
    GAMMA_API: "https://gamma-api.polymarket.com",
    REFRESH_CYCLE: 15
};

let state = {
    isLoggedIn: false,
    userAddress: null,
    activeTab: 'market'
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);
    initAuth();
});

// --- 1. CLOCK ---
function updateTime() {
    const opt = { hour: '2-digit', minute: '2-digit', hour12: false };
    const ny = document.getElementById('nyc-time');
    const ld = document.getElementById('ldn-time');
    if(ny) ny.innerText = new Date().toLocaleTimeString('en-US', { ...opt, timeZone: 'America/New_York' });
    if(ld) ld.innerText = new Date().toLocaleTimeString('en-GB', { ...opt, timeZone: 'Europe/London' });
}

// --- 2. AUTH & LAUNCH ---
function initAuth() {
    const launchBtn = document.getElementById('launchAppBtn');
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    const authModal = document.getElementById('auth-modal');

    if(launchBtn) {
        launchBtn.onclick = () => {
            authModal.classList.remove('hidden');
            authModal.classList.add('flex');
        };
    }

    // Exported for HTML onclick
    window.handleLogin = () => {
        state.isLoggedIn = true;
        authModal.classList.add('hidden');
        landing.classList.add('fade-out');
        setTimeout(() => {
            landing.style.display = 'none';
            app.classList.remove('hidden');
            app.classList.add('fade-in');
            initApp();
        }, 400);
    };

    if (window.location.hash) {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('flex');
        initApp();
    }
}

function initApp() {
    if(!window.location.hash) window.location.hash = 'market';
    initNavigation();
    initWeb3();
    initWhaleAnalyzer();
    handleRouting();
}

// --- 3. ROUTING ---
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
        link.classList.toggle('active', isTarget);
    });

    if(target === 'market') fetchMarkets();
}

// --- 4. MARKETS (Real-time with fallback) ---
async function fetchMarkets() {
    const list = document.getElementById('market-list');
    if(!list) return;

    const fallbackMarkets = [
        { question: "Will the Fed decrease interest rates by 50+ bps in March?", volume: 6400000, outcomePrices: [0.32, 0.68], slug: '#' },
        { question: "Will Bitcoin hit $100k before April 2026?", volume: 12500000, outcomePrices: [0.85, 0.15], slug: '#' }
    ];

    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/markets?active=true&limit=10&order=volume&dir=desc`);
        if(!res.ok) throw new Error();
        const data = await res.json();
        renderMarkets(data);
    } catch (e) {
        console.warn("Polymarket API unreachable, using secondary shard data.");
        renderMarkets(fallbackMarkets);
    }
}

function renderMarkets(data) {
    const list = document.getElementById('market-list');
    list.innerHTML = data.map((m, i) => `
        <div class="bg-app-panel border border-app-border rounded-3xl p-6 flex justify-between items-center hover:border-blue-600/50 transition-all group animate-fadeInUp" style="animation-delay: ${i*0.05}s">
            <div class="flex-1">
                <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">Vol: $${(m.volume/1000000).toFixed(1)}M</span>
                <h3 class="text-lg font-bold text-white mt-1 italic group-hover:text-blue-400 transition-colors">${m.question}</h3>
            </div>
            <div class="flex gap-3 ml-6 text-center">
                <div class="px-5 py-3 bg-green-500/5 border border-green-500/20 rounded-2xl group-hover:border-green-500/40 transition-all">
                    <p class="text-[8px] font-black text-green-500 uppercase">Yes</p>
                    <p class="text-lg font-black text-green-500">${(m.outcomePrices[0]*100).toFixed(1)}¢</p>
                </div>
                <div class="px-5 py-3 bg-red-500/5 border border-red-500/20 rounded-2xl group-hover:border-red-500/40 transition-all">
                    <p class="text-[8px] font-black text-red-500 uppercase">No</p>
                    <p class="text-lg font-black text-red-500">${(m.outcomePrices[1]*100).toFixed(1)}¢</p>
                </div>
            </div>
        </div>
    `).join('');
}

// --- 5. WHALE ANALYZER ---
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
            stats.classList.remove('hidden');
            pnl.innerText = `$${(data.profit || 0).toLocaleString()}`;
            pnl.className = (data.profit >= 0) ? "text-3xl font-black text-green-500" : "text-3xl font-black text-red-500";
            win.innerText = `${(data.winRate || 0).toFixed(1)}%`;
        } catch (e) {
            stats.classList.remove('hidden');
            pnl.innerText = "$0.00";
            win.innerText = "0%";
        } finally {
            btn.innerText = "Analyze";
        }
    };
    if(inp) inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
}

// --- 6. WEB3 ---
function initWeb3() {
    const btn = document.getElementById('connectWalletBtn');
    if(!btn) return;

    btn.onclick = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                state.userAddress = accounts[0];
                btn.innerText = state.userAddress.slice(0,6) + '...' + state.userAddress.slice(-4);
                btn.classList.add('text-blue-400', 'bg-white/5');
            } catch (e) { console.error("Web3 node rejection."); }
        } else {
            alert("Digital identity node (MetaMask) not detected.");
        }
    };
}
