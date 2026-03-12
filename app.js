/**
 * PolyEdge Opportunity Engine v6.2
 * High-performance market scanner and data aggregator
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?closed=false&limit=100&active=true&order=volume24hr&ascending=false',
    PROXY: 'https://api.allorigins.win/get?url=',
    REFRESH_INTERVAL: 15
};

let state = {
    markets: [],
    filtered: [],
    timer: CONFIG.REFRESH_INTERVAL,
    activeTab: 'scanner',
    filters: {
        roi: 3,
        liq: 10000,
        days: 30
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    fetchData();
    startClocks();
    startRefreshTimer();
});

function initUI() {
    // Sliders
    const roiInput = document.getElementById('input-roi');
    const liqInput = document.getElementById('input-liq');
    const daysInput = document.getElementById('input-days');

    roiInput.oninput = (e) => {
        state.filters.roi = parseInt(e.target.value);
        document.getElementById('val-roi').innerText = state.filters.roi + 'x';
        applyFilters();
    };

    liqInput.oninput = (e) => {
        state.filters.liq = parseInt(e.target.value) * 1000;
        document.getElementById('val-liq').innerText = '$' + (state.filters.liq / 1000) + 'K';
        applyFilters();
    };

    daysInput.oninput = (e) => {
        state.filters.days = parseInt(e.target.value);
        document.getElementById('val-days').innerText = state.filters.days + 'd';
        applyFilters();
    };

    // Scan Button
    document.getElementById('btn-scan').onclick = fetchData;

    // Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active', 'bg-[#23283B]', 'text-white'));
            item.classList.add('active', 'bg-[#23283B]', 'text-white');
            state.activeTab = item.dataset.tab;
            updateViewHeader();
            applyFilters();
        };
    });
}

// --- DATA FETCHING ---
async function fetchData() {
    log("SYSTEM_NODE: Syncing with Gamma Protocol...");
    try {
        const response = await fetch(CONFIG.PROXY + encodeURIComponent(CONFIG.API_URL));
        if (!response.ok) throw new Error("GATEWAY_OFFLINE");
        
        const json = await response.json();
        const raw = JSON.parse(json.contents);
        
        state.markets = processMarkets(Array.isArray(raw) ? raw : (raw.markets || []));
        log(`SUCCESS: Detected ${state.markets.length} active nodes.`);
        applyFilters();
    } catch (err) {
        log(`CRITICAL: ${err.message}. Deploying recovery cache.`, "error");
        deployFallback();
    }
}

function processMarkets(data) {
    return data.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try {
            const parsed = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(parsed)) prices = parsed.map(Number);
        } catch(e) {}

        const yesPrice = Math.max(0.001, prices[0]);
        const roi = 1 / yesPrice;
        
        return {
            title: m.question,
            liq: parseFloat(m.liquidity) || 0,
            vol24h: parseFloat(m.volume24h) || 0,
            roi: roi,
            price: yesPrice * 100,
            days: Math.floor((new Date(m.endDate) - new Date()) / (1000 * 60 * 60 * 24)),
            url: `https://polymarket.com/market/${m.slug}`
        };
    });
}

function applyFilters() {
    state.filtered = state.markets.filter(m => {
        if (state.activeTab === 'scanner') {
            return m.roi >= state.filters.roi && 
                   m.liq >= state.filters.liq && 
                   (m.days <= state.filters.days || m.days < 0);
        }
        return true;
    });

    // Sort by Opportunity Score (Volume * ROI / DaysRemaining)
    state.filtered.sort((a, b) => {
        const scoreA = (a.vol24h * a.roi) / (Math.max(1, a.days));
        const scoreB = (b.vol24h * b.roi) / (Math.max(1, b.days));
        return scoreB - scoreA;
    });

    render();
}

// --- RENDERING ---
function render() {
    const list = document.getElementById('market-list');
    const count = document.getElementById('target-count');
    if (!list) return;

    count.innerText = `Found ${state.filtered.length} targets`;
    list.innerHTML = '';

    state.filtered.slice(0, 40).forEach((m, i) => {
        const dayText = m.days < 0 ? 'Ended' : `${m.days}d`;
        list.innerHTML += `
            <div class="flex items-center bg-app-panel border border-transparent hover:border-app-border rounded-xl p-4 transition-all group cursor-pointer" onclick="window.open('${m.url}', '_blank')">
                <div class="w-10 text-app-textDark font-bold text-sm">#${i + 1}</div>
                <div class="flex-1 px-4">
                    <h3 class="text-[15px] font-bold text-white mb-1 group-hover:text-app-blue transition-colors truncate max-w-[600px]">${m.title}</h3>
                    <div class="flex gap-4 text-[11px] text-app-text font-medium">
                        <span>Liq: $${formatCompact(m.liq)}</span>
                        <span>Vol 24h: $${formatCompact(m.vol24h)}</span>
                        <span>Ends: ${dayText}</span>
                    </div>
                </div>
                <div class="w-28 text-right pr-6 border-r border-app-border">
                    <div class="text-[15px] font-bold text-app-green">${m.roi.toFixed(1)}x</div>
                    <div class="text-[10px] text-app-text font-semibold uppercase mt-0.5">ROI</div>
                </div>
                <div class="w-24 text-right pr-6">
                    <div class="text-[15px] font-bold text-white">${m.price.toFixed(1)}¢</div>
                    <div class="text-[10px] text-app-text font-semibold uppercase mt-0.5">Entry</div>
                </div>
                <button class="bg-app-blue hover:bg-app-blueHover text-white text-[13px] font-semibold py-2 px-5 rounded-lg transition-colors">
                    Trade
                </button>
            </div>
        `;
    });
}

// --- UTILS ---
function updateViewHeader() {
    const title = document.getElementById('view-title');
    const desc = document.getElementById('view-desc');
    const controls = document.getElementById('scanner-controls');
    
    if (state.activeTab === 'scanner') {
        title.innerText = "Opportunity Scanner";
        desc.innerText = "Find high-potential markets based on ROI, liquidity, and time horizon.";
        controls.style.display = 'flex';
    } else {
        title.innerText = state.activeTab.charAt(0).toUpperCase() + state.activeTab.slice(1);
        desc.innerText = `Active filtering for ${state.activeTab} nodes...`;
        controls.style.display = 'none';
    }
}

function startClocks() {
    const update = () => {
        const now = new Date();
        const opt = (tz) => now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
        document.getElementById('clock-nyc').innerText = opt('America/New_York');
        document.getElementById('clock-ldn').innerText = opt('Europe/London');
        document.getElementById('clock-tko').innerText = opt('Asia/Tokyo');
    };
    update();
    setInterval(update, 10000);
}

function startRefreshTimer() {
    const bar = document.getElementById('refresh-progress');
    const label = document.getElementById('refresh-timer');
    
    setInterval(() => {
        state.timer--;
        if (state.timer < 0) {
            state.timer = CONFIG.REFRESH_INTERVAL;
            fetchData();
        }
        label.innerText = state.timer + 's';
        const offset = (state.timer / CONFIG.REFRESH_INTERVAL) * 100;
        bar.style.strokeDasharray = `${offset}, 100`;
    }, 1000);
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

function log(msg, type = "info") {
    const content = document.getElementById('log-content');
    if (!content) return;
    const entry = document.createElement('div');
    entry.className = "mb-1";
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    entry.innerHTML = `<span class="opacity-50">[${timestamp}]</span> <span class="${type === 'error' ? 'text-app-red' : 'text-app-blue'}">${msg}</span>`;
    content.prepend(entry);
}

function deployFallback() {
    state.markets = [
        { title: 'Will the Fed decrease rates by 50+ bps?', liq: 6100000, vol24h: 5500000, roi: 666.7, price: 0.1, days: 7, url: '#' },
        { title: 'Will Trump say "Jesus" this week?', liq: 2100000, vol24h: 3500000, roi: 1000, price: 0.1, days: 0, url: '#' },
        { title: 'Will Bitcoin hit $84,000 on March 11?', liq: 344000, vol24h: 555000, roi: 2000, price: 0.1, days: 1, url: '#' }
    ];
    applyFilters();
}
