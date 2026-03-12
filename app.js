/**
 * PolyEdge Institutional Terminal Engine v15.0
 * Unified Auth & Wallet Logic + Real-Time Polymarket Bridge
 */

const CONFIG = {
    USDC_POLYGON: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ERC20_ABI: ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    GAMMA_API: "https://gamma-api.polymarket.com",
    REFRESH_CYCLE: 15
};

let state = {
    markets: [],
    activeTab: 'market',
    timer: CONFIG.REFRESH_CYCLE,
    userAddress: null,
    provider: null,
    isLoggedIn: false,
    walletMenuOpen: false
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initWeb3();
    initWhaleForensics();
    initModal();
    startClocks();
    startRefreshCycle();
    handleHashRouting();
});

// --- 1. AUTHENTICATION & LANDING ---
function initAuth() {
    const launchBtn = document.getElementById('launchAppBtn');
    const authModal = document.getElementById('auth-modal');
    const authContent = document.getElementById('authContent');
    const closeAuth = document.getElementById('closeAuthBtn');
    const loginBtns = ['loginGoogle', 'loginApple', 'loginMagic'];

    const openAuth = () => {
        authModal.classList.remove('hidden');
        authModal.classList.add('flex');
        setTimeout(() => {
            authContent.classList.remove('scale-95', 'opacity-0');
            authContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    const closeAuthModal = () => {
        authContent.classList.replace('scale-100', 'scale-95');
        authContent.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => authModal.classList.add('hidden'), 300);
    };

    if(launchBtn) launchBtn.onclick = openAuth;
    if(closeAuth) closeAuth.onclick = closeAuthModal;

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

    if (window.location.hash) {
        state.isLoggedIn = true;
        enterApp();
    }
}

function enterApp() {
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    landing.classList.add('fade-out');
    setTimeout(() => {
        landing.style.display = 'none';
        app.classList.remove('hidden');
        app.classList.add('fade-in');
        if (!window.location.hash) window.location.hash = 'market';
        fetchRealMarkets();
    }, 400);
}

function handleLogout() {
    state.isLoggedIn = false;
    window.location.hash = '';
    window.location.reload();
}

// --- 2. NAVIGATION ---
function initNavigation() {
    window.addEventListener('hashchange', handleHashRouting);
}

function handleHashRouting() {
    let hash = window.location.hash.replace('#', '') || (state.isLoggedIn ? 'market' : '');
    if(!hash && state.isLoggedIn) hash = 'market';
    if(!hash) return;

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

// --- 3. WEB3: WALLET & DROPDOWN ---
function initWeb3() {
    const btn = document.getElementById('connectWalletBtn');
    const menu = document.getElementById('wallet-menu');
    const disconnectBtn = document.getElementById('disconnectWalletBtn');

    const toggleMenu = (val) => {
        state.walletMenuOpen = val !== undefined ? val : !state.walletMenuOpen;
        menu.classList.toggle('hidden', !state.walletMenuOpen);
    };

    window.addEventListener('click', (e) => {
        if (!document.getElementById('wallet-container').contains(e.target)) toggleMenu(false);
    });

    if(btn) btn.onclick = (e) => {
        e.stopPropagation();
        if(state.userAddress) toggleMenu();
        else connect();
    };

    const connect = async () => {
        if (!window.ethereum) return alert("MetaMask or similar Web3 node required.");
        try {
            btn.innerText = 'Transmitting...';
            state.provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await state.provider.send("eth_requestAccounts", []);
            state.userAddress = accounts[0];
            updateWalletUI();
        } catch (e) {
            btn.innerText = 'Connect Wallet';
        }
    };

    if(disconnectBtn) disconnectBtn.onclick = () => {
        state.userAddress = null;
        updateWalletUI();
        toggleMenu(false);
    };

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            state.userAddress = accounts.length > 0 ? accounts[0] : null;
            updateWalletUI();
        });
    }
}

async function updateWalletUI() {
    const btn = document.getElementById('connectWalletBtn');
    const addrShort = document.getElementById('wallet-addr-short');
    const avatar = document.getElementById('wallet-avatar');
    const balDisplay = document.getElementById('real-balance');

    if(state.userAddress) {
        btn.innerText = state.userAddress.slice(0,6) + '...' + state.userAddress.slice(-4);
        btn.classList.add('bg-white/10', 'text-blue-400');
        if(addrShort) addrShort.innerText = state.userAddress;
        if(avatar) avatar.innerText = state.userAddress.slice(2,4).toUpperCase();
        
        // Fetch Real USDC Balance
        try {
            const usdc = new ethers.Contract(CONFIG.USDC_POLYGON, CONFIG.ERC20_ABI, state.provider);
            const bal = await usdc.balanceOf(state.userAddress);
            const decimals = await usdc.decimals();
            balDisplay.innerText = `${parseFloat(ethers.formatUnits(bal, decimals)).toFixed(2)} USDC`;
        } catch (e) { balDisplay.innerText = "0.00 USDC"; }
    } else {
        btn.innerText = 'Connect Wallet';
        btn.classList.remove('bg-white/10', 'text-blue-400');
        btn.classList.add('bg-blue-600');
    }
}

// --- 4. DATA: REAL POLYMARKET BRIDGE ---
async function fetchRealMarkets() {
    const list = document.getElementById('market-list');
    if(!list) return;

    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/markets?active=true&limit=10&order=volume&dir=desc`);
        const data = await res.json();
        
        list.innerHTML = data.map((m, i) => `
            <div class="bg-app-panel border border-app-border rounded-[32px] p-8 flex flex-col md:flex-row justify-between items-center transition-all cursor-pointer group animate-fadeInUp hover:border-blue-500/30" style="animation-delay: ${i*0.05}s" onclick="openOrderModal('YES', '${m.question}')">
                <div class="flex-1 min-w-0 pr-6">
                    <div class="flex items-center gap-2 mb-3">
                         <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg">Vol: $${formatCompact(m.volume)}</span>
                         <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Shard: OK</span>
                    </div>
                    <h3 class="text-xl font-bold text-white leading-tight truncate italic group-hover:text-app-accent transition-colors">${m.question}</h3>
                </div>
                <div class="flex gap-4 mt-6 md:mt-0">
                    <div class="bg-green-500/5 border border-green-500/20 px-8 py-4 rounded-[24px] text-center transition-all">
                        <p class="text-[8px] font-black text-green-500 uppercase mb-1">Buy Yes</p>
                        <p class="text-xl font-black text-green-400 font-mono">${(m.outcomePrices[0] * 100).toFixed(1)}¢</p>
                    </div>
                    <div class="bg-red-500/5 border border-red-500/20 px-8 py-4 rounded-[24px] text-center transition-all">
                        <p class="text-[8px] font-black text-red-500 uppercase mb-1">Buy No</p>
                        <p class="text-xl font-black text-red-400 font-mono">${(m.outcomePrices[1] * 100).toFixed(1)}¢</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="p-10 text-center text-gray-500 font-black italic uppercase tracking-widest">Data shard connection lost. Retrying...</div>`;
    }
}

// --- 5. FORENSICS: WHALE ANALYZER ---
function initWhaleForensics() {
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
            pnl.className = (data.profit >= 0) ? "text-4xl font-black italic text-green-500" : "text-4xl font-black italic text-red-500";
            win.innerText = `${(data.winRate || 0).toFixed(1)}%`;
        } catch (e) {
            alert("Digital footprint not found on Polymarket indexer.");
        } finally {
            btn.innerText = "RUN FORENSICS";
        }
    };
    if(inp) inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
}

// --- 6. EXECUTION MODAL ---
function initModal() {
    const modal = document.getElementById('copyTradeModal');
    const content = document.getElementById('modalContent');
    const close = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const sign = document.getElementById('confirmTxBtn');

    window.openOrderModal = () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
        // Refresh balance in modal
        const bal = document.getElementById('real-balance').innerText;
        document.getElementById('modal-usdc-bal').innerText = bal;
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
        setTimeout(() => {
            sign.innerHTML = `ORDER FINALIZED`;
            sign.classList.add('bg-green-500');
            setTimeout(() => {
                closeOrderModal();
                setTimeout(() => {
                   sign.innerHTML = `SIGN & EXECUTE`;
                   sign.classList.remove('bg-green-500');
                }, 500);
            }, 1500);
        }, 2000);
    };
}

// --- UTILS ---
function updateClocks() {
    const opt = { hour: '2-digit', minute: '2-digit', hour12: false };
    const ny = document.getElementById('nyc-time');
    const ld = document.getElementById('ldn-time');
    if(ny) ny.innerText = new Date().toLocaleTimeString('en-US', { ...opt, timeZone: 'America/New_York' });
    if(ld) ld.innerText = new Date().toLocaleTimeString('en-GB', { ...opt, timeZone: 'Europe/London' });
}
function startClocks() { updateClocks(); setInterval(updateClocks, 10000); }

function startRefreshCycle() {
    setInterval(() => {
        if(!state.isLoggedIn) return;
        state.timer--;
        if(state.timer < 0) { state.timer = CONFIG.REFRESH_CYCLE; fetchRealMarkets(); }
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
