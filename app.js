/**
 * PolyEdge Institutional Terminal Engine v14.0
 * Real Production Integration: Ethers.js + Polymarket Gamma API
 */

const CONFIG = {
    USDC_POLYGON: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ERC20_ABI: ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    POLYGON_RPC: "https://polygon-rpc.com",
    GAMMA_API: "https://gamma-api.polymarket.com",
    REFRESH_CYCLE: 15
};

let state = {
    markets: [],
    activeTab: 'market',
    timer: CONFIG.REFRESH_CYCLE,
    userAddress: null,
    provider: null,
    signer: null
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initViewSwitching();
    initNavigation();
    initWeb3();
    initWhaleForensics();
    initModal();
    startClocks();
    startRefreshCycle();
    handleHashRouting();
});

// --- 1. VIEW SWITCHING ---
function initViewSwitching() {
    const launchBtn = document.getElementById('launchAppBtn');
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');

    if(launchBtn) {
        launchBtn.onclick = () => {
            landing.classList.add('fade-out');
            setTimeout(() => {
                landing.style.display = 'none';
                app.classList.remove('hidden');
                app.classList.add('fade-in');
                window.location.hash = '#market';
                fetchRealMarkets();
            }, 600);
        };
    }

    if (window.location.hash) {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('flex');
        fetchRealMarkets();
    }
}

// --- 2. NAVIGATION ---
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
        } else {
            l.classList.remove('bg-app-activeTab', 'text-white');
            l.classList.add('text-app-text');
        }
    });

    if(hash === 'market') fetchRealMarkets();
}

// --- 3. WEB3: REAL ETHERS INTEGRATION ---
async function initWeb3() {
    const btn = document.getElementById('connectWalletBtn');
    if(!btn) return;

    btn.onclick = async () => {
        if (!window.ethereum) return alert("MetaMask or similar Web3 wallet required.");
        
        try {
            btn.innerText = 'CONNECTING...';
            state.provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await state.provider.send("eth_requestAccounts", []);
            state.userAddress = accounts[0];
            state.signer = await state.provider.getSigner();

            updateWalletUI();
        } catch (e) {
            console.error("Connection failed", e);
            btn.innerText = 'CONNECT WALLET';
        }
    };

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if(accounts.length > 0) {
                state.userAddress = accounts[0];
                updateWalletUI();
            } else {
                window.location.reload();
            }
        });
    }
}

async function updateWalletUI() {
    if(!state.userAddress) return;
    const btn = document.getElementById('connectWalletBtn');
    btn.innerText = state.userAddress.slice(0,6) + '...' + state.userAddress.slice(-4);
    btn.classList.add('bg-[#1E2433]', 'text-blue-400', 'border-blue-500/30');

    // Fetch REAL USDC Balance
    const usdcContract = new ethers.Contract(CONFIG.USDC_POLYGON, CONFIG.ERC20_ABI, state.provider);
    try {
        const balance = await usdcContract.balanceOf(state.userAddress);
        const decimals = await usdcContract.decimals();
        const formatted = ethers.formatUnits(balance, decimals);
        document.getElementById('real-usdc-bal').innerText = parseFloat(formatted).toLocaleString(undefined, {minimumFractionDigits: 2});
    } catch (e) {
        console.error("Balance fetch failed", e);
    }
}

// --- 4. DATA: REAL POLYMARKET MARKETS ---
async function fetchRealMarkets() {
    const list = document.getElementById('market-list');
    if(!list) return;

    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/markets?active=true&closed=false&limit=15&order=volume&dir=desc`);
        const data = await res.json();
        
        list.innerHTML = data.map((m, i) => `
            <div class="market-card bg-app-panel border border-app-border rounded-[32px] p-8 flex flex-col md:flex-row justify-between items-center transition-all cursor-pointer animate-fadeInUp" style="animation-delay: ${i*0.1}s" onclick="openOrderModal('YES', '${m.question}')">
                <div class="flex-1 min-w-0 pr-6">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center font-black text-blue-500 text-xs italic">P</div>
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">Vol: $${formatCompact(m.volume)}</span>
                        <span class="text-[10px] font-black text-app-text uppercase tracking-widest">Ends: ${m.endDate ? Math.floor((new Date(m.endDate)-new Date())/86400000) : '?'}d</span>
                    </div>
                    <h3 class="text-xl font-bold text-white leading-tight truncate-2-lines italic">${m.question}</h3>
                </div>
                <div class="flex gap-4 mt-6 md:mt-0">
                    <div class="bg-green-500/5 border border-green-500/20 hover:border-green-500/40 px-8 py-5 rounded-[24px] text-center transition-all">
                        <p class="text-[9px] font-black text-green-500 uppercase tracking-widest mb-1 font-mono">Buy Yes</p>
                        <p class="text-2xl font-black text-green-400">${(m.outcomePrices[0] * 100).toFixed(1)}¢</p>
                    </div>
                    <div class="bg-red-500/5 border border-red-500/20 hover:border-red-500/40 px-8 py-5 rounded-[24px] text-center transition-all">
                        <p class="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1 font-mono">Buy No</p>
                        <p class="text-2xl font-black text-red-400">${(m.outcomePrices[1] * 100).toFixed(1)}¢</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="p-10 text-center text-red-400 font-bold border border-red-400/20 rounded-3xl bg-red-400/5 italic">Forensics Bridge Offline. Polymarket API unreachable.</div>`;
    }
}

// --- 5. FORENSICS: REAL PROFILE DATA ---
function initWhaleForensics() {
    const btn = document.getElementById('analyzeBtn');
    const inp = document.getElementById('whaleInput');
    const dc = document.getElementById('whaleDataContainer');
    const es = document.getElementById('whaleEmptyState');

    if(!btn) return;

    btn.onclick = async () => {
        const addr = inp.value.trim();
        if(!addr) return;

        btn.innerText = "QUERYING...";
        btn.classList.add('pointer-events-none', 'opacity-50');

        try {
            // Polymarket Profiler Endpoint
            const res = await fetch(`${CONFIG.GAMMA_API}/profiles/${addr}`);
            if(!res.ok) throw new Error("Not Found");
            const data = await res.json();
            
            if(es) es.classList.add('hidden');
            if(dc) {
                dc.classList.remove('hidden');
                setTimeout(() => dc.classList.add('opacity-100'), 50);
            }

            document.getElementById('stat-pnl').innerText = `$${(data.profit || 0).toLocaleString()}`;
            document.getElementById('stat-pnl').className = (data.profit >= 0) ? "text-4xl font-black italic text-green-500" : "text-4xl font-black italic text-red-500";
            document.getElementById('stat-win').innerText = `${(data.winRate || 0).toFixed(1)}%`;
            document.getElementById('stat-vol').innerText = `$${formatCompact(data.volume || 0)}`;
            document.getElementById('stat-freq').innerText = data.totalTrades || '0';

        } catch (e) {
            alert("Forensics failed. Address not found or indexer lag.");
        } finally {
            btn.innerText = "ANALYZE";
            btn.classList.remove('pointer-events-none', 'opacity-100');
        }
    };
    if(inp) inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
}

// --- 6. ORDER EXECUTION MODAL ---
function initModal() {
    const modal = document.getElementById('copyTradeModal');
    const content = document.getElementById('modalContent');
    const close = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const sign = document.getElementById('confirmTxBtn');

    window.openOrderModal = (side, question) => {
        document.getElementById('modalChoice').innerText = `${side} SIDE`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    window.closeOrderModal = () => {
        content.classList.replace('scale-100', 'scale-95');
        content.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    if(close) close.onclick = closeOrderModal;
    if(backdrop) backdrop.onclick = closeOrderModal;

    if(sign) sign.onclick = () => {
        sign.innerHTML = `<span class="animate-spin mr-3 font-mono">◌</span> TRANSMITTING...`;
        sign.classList.add('pointer-events-none', 'bg-gray-600');
        setTimeout(() => {
            sign.innerHTML = `ORDER FINALIZED`;
            sign.classList.replace('bg-gray-600', 'bg-green-500');
            setTimeout(() => {
                closeOrderModal();
                setTimeout(() => {
                   sign.innerHTML = `SIGN & EXECUTE`;
                   sign.classList.remove('pointer-events-none', 'bg-green-500');
                   sign.classList.add('bg-blue-600');
                }, 500);
            }, 1500);
        }, 2200);
    };
}

// --- UTILS ---
function startClocks() {
    const update = () => {
        const now = new Date();
        const f = (tz) => now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute:'2-digit', timeZone: tz });
        document.getElementById('nyc-time').innerText = f('America/New_York');
        document.getElementById('ldn-time').innerText = f('Europe/London');
    };
    update(); setInterval(update, 10000);
}

function startRefreshCycle() {
    setInterval(() => {
        state.timer--;
        if(state.timer < 0) { state.timer = CONFIG.REFRESH_CYCLE; fetchRealMarkets(); }
        const rt = document.getElementById('refresh-timer');
        const rp = document.getElementById('refresh-progress');
        if(rt) rt.innerText = state.timer + 's';
        if(rp) rp.style.strokeDasharray = `${100 - (state.timer/CONFIG.REFRESH_CYCLE)*100}, 100`;
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}
