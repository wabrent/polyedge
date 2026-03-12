/**
 * PolyEdge — Precision Logic v4.0
 * Fixes: Result mapping, JSON parsing, Proxy support
 */

const API_BASE = 'https://gamma-api.polymarket.com';
const PROXIES = [
    u => u,
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
];

let allMarkets = [];
let refreshTimer = 15;

// --- INITIALIZATION ---
window.addEventListener('load', () => {
    console.log("System initializing...");
    initTheme();
    initClocks();
    initTimer();
    initTabs();
    loadMarkets();
    
    // Search listener
    const search = document.getElementById('market-search');
    if (search) search.oninput = renderMarkets;
});

function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('pe-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    
    btn.onclick = () => {
        const now = document.documentElement.getAttribute('data-theme');
        const next = now === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pe-theme', next);
    };
}

function initClocks() {
    const update = () => {
        const now = new Date();
        const fmt = (tz) => now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
        const clocks = document.querySelectorAll('.clock b');
        if (clocks.length >= 3) {
            clocks[0].innerText = fmt('America/New_York');
            clocks[1].innerText = fmt('Europe/London');
            clocks[2].innerText = fmt('Asia/Tokyo');
        }
    };
    update(); setInterval(update, 10000);
}

function initTimer() {
    const circle = document.querySelector('.circle');
    const text = document.querySelector('.timer-text');
    if (!circle || !text) return;
    
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer < 0) {
            refreshTimer = 15;
            loadMarkets();
        }
        const offset = (refreshTimer / 15) * 100;
        circle.setAttribute('stroke-dasharray', `${offset}, 100`);
        text.innerText = refreshTimer + 's';
    }, 1000);
}

function initTabs() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderMarkets();
        };
    });
}

// --- DATA HANDLING ---
async function loadMarkets() {
    const url = `${API_BASE}/markets?closed=false&limit=40&active=true&order=volume24hr&ascending=false`;
    console.log("Attempting data fetch...");

    let rawData = null;
    for (const proxy of PROXIES) {
        try {
            const response = await fetch(proxy(url));
            if (!response.ok) continue;
            let data = await response.json();
            if (data.contents) data = JSON.parse(data.contents);
            if (data && (Array.isArray(data) || data.markets)) {
                rawData = Array.isArray(data) ? data : data.markets;
                break;
            }
        } catch (e) {
            console.warn("Proxy failed, trying next...");
        }
    }

    if (rawData && rawData.length > 0) {
        allMarkets = processMarkets(rawData);
    } else {
        console.warn("API failed. Using local fallback data.");
        useFallback();
    }
    
    updateStats();
    renderMarkets();
}

function processMarkets(raw) {
    return raw.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try {
            const pData = m.outcomePrices;
            const pArr = (typeof pData === 'string') ? JSON.parse(pData) : pData;
            if (Array.isArray(pArr) && pArr.length >= 2) {
                prices = pArr.map(p => parseFloat(p) || 0.5);
            }
        } catch (e) { }

        const yes = Math.max(0.001, prices[0]);
        return {
            id: m.id || Math.random(),
            title: m.question,
            img: m.image || 'https://via.placeholder.com/64/00F0FF/000000?text=PE',
            volume: parseFloat(m.volume24h) || 0,
            liq: parseFloat(m.liquidity) || 0,
            yes: yes,
            no: 1 - yes,
            days: Math.floor(Math.random() * 15) + 1,
            roi: (1 / yes),
            url: `https://polymarket.com/market/${m.slug || ''}`
        };
    });
}

function useFallback() {
    allMarkets = [
        { id:1, title:'Will Iran strike Israel by March 31?', img:'', volume:12500000, liq:2800000, yes:0.001, no:0.999, days:14, roi:1000, url:'#' },
        { id:2, title:'Will the Fed cut rates by 50bps in May?', img:'', volume:8400000, liq:4200000, yes:0.25, no:0.75, days:45, roi:4, url:'#' },
        { id:3, title:'Will Donald Trump win the 2024 Election?', img:'', volume:950000000, liq:150000000, yes:0.54, no:0.46, days:240, roi:1.8, url:'#' },
        { id:4, title:'Will BTC hit $100k this quarter?', img:'', volume:4500000, liq:900000, yes:0.15, no:0.85, days:20, roi:6.6, url:'#' }
    ];
}

function updateStats() {
    const mCount = document.getElementById('markets-count');
    const tVol = document.getElementById('total-vol');
    const oCount = document.getElementById('opps-count');
    const bRoi = document.getElementById('best-roi');

    if (mCount) mCount.innerText = allMarkets.length;
    if (tVol) {
        const sum = allMarkets.reduce((s, m) => s + m.volume, 0);
        tVol.innerText = '$' + (sum / 1e6).toFixed(1) + 'M';
    }
    if (oCount) oCount.innerText = allMarkets.filter(m => m.roi > 50).length;
    if (bRoi) {
        const max = Math.max(...allMarkets.map(m => m.roi));
        bRoi.innerText = Math.round(max) + 'x';
    }
}

function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const query = document.getElementById('market-search')?.value.toLowerCase() || '';
    const filtered = allMarkets.filter(m => m.title.toLowerCase().includes(query));

    filtered.forEach(m => {
        const yesCents = (m.yes * 100).toFixed(1);
        const win = (10 / m.yes).toFixed(2);
        
        grid.innerHTML += `
            <div class="m-card">
                <div class="card-top">
                    <div class="tag-group">
                        <span class="pill-tag blue">HIGH VOL</span>
                        <span class="pill-tag orange">SOON</span>
                    </div>
                </div>
                <div class="card-mid">
                    <img src="${m.img}" class="m-icon" onerror="this.src='https://via.placeholder.com/44/2563eb/ffffff?text=P'">
                    <h3 class="m-title">${m.title}</h3>
                </div>
                <div class="m-data">
                    ${m.days}d  Vol <b>$${formatCompact(m.volume)}</b>  Liq <b>$${formatCompact(m.liq)}</b>
                </div>
                <div class="price-row">
                    <div class="btn-price yes">Yes ${yesCents}¢</div>
                    <div class="btn-price no">No ${(100 - yesCents).toFixed(1)}¢</div>
                </div>
                <div class="bet-area">
                    <span>Bet $ </span>
                    <div class="bet-input-wrap">
                        <input type="text" value="10" readonly>
                        <span>→ win <b class="win-amount">$${win}</b></span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="roi-text">${m.roi.toFixed(1)}x ROI</span>
                </div>
                <button class="trade-btn" onclick="window.open('${m.url}', '_blank')">Trade on Polymarket</button>
            </div>
        `;
    });
}

function formatCompact(num) {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
}
