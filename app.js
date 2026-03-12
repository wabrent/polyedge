/**
 * PolyEdge — Precision Engine v4.1
 * UI Restoration based on Screenshot 3
 */

const API_ENDPOINT = 'https://gamma-api.polymarket.com/markets?closed=false&limit=40&active=true&order=volume24hr&ascending=false';

let dashboardMarkets = [];
let countdown = 15;

// --- INITIALIZE ---
window.addEventListener('DOMContentLoaded', () => {
    console.log("Kernel sequence initiated...");
    initInterface();
    syncClocks();
    startRefreshCycle();
    fetchData();
});

function initInterface() {
    // Theme
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('pe-theme-pref') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeBtn.onclick = (e) => {
        e.preventDefault();
        const current = document.documentElement.getAttribute('data-theme');
        const target = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', target);
        localStorage.setItem('pe-theme-pref', target);
    };

    // Tabs
    document.querySelectorAll('.tab-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderDashboard();
        };
    });

    // Logo
    document.getElementById('logo-main').onclick = () => window.location.reload();

    // Search
    document.getElementById('market-input').oninput = renderDashboard;
}

function syncClocks() {
    const update = () => {
        const now = new Date();
        const options = (tz) => ({ hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
        
        const nyc = document.getElementById('nyc-time');
        const ldn = document.getElementById('ldn-time');
        const tko = document.getElementById('tko-time');

        if (nyc) nyc.innerText = now.toLocaleTimeString('en-GB', options('America/New_York'));
        if (ldn) ldn.innerText = now.toLocaleTimeString('en-GB', options('Europe/London'));
        if (tko) tko.innerText = now.toLocaleTimeString('en-GB', options('Asia/Tokyo'));
    };
    update();
    setInterval(update, 10000);
}

function startRefreshCycle() {
    const bar = document.querySelector('.timer-bar');
    const label = document.querySelector('.timer-val');
    
    setInterval(() => {
        countdown--;
        if (countdown < 0) {
            countdown = 15;
            fetchData();
        }
        if (label) label.innerText = countdown + 's';
        if (bar) {
            const offset = (countdown / 15) * 100;
            bar.style.strokeDasharray = `${offset}, 100`;
        }
    }, 1000);
}

// --- DATA LOGIC ---
async function fetchData() {
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error("API Offline");
        const data = await response.json();
        dashboardMarkets = mapMarketData(data);
    } catch (err) {
        console.warn("API Node Error. Deploying cache...");
        deployFallbackData();
    }
    updateStatsBar();
    renderDashboard();
}

function mapMarketData(raw) {
    const list = Array.isArray(raw) ? raw : (raw.markets || []);
    return list.filter(m => m.question).map(m => {
        let prices = [0.5, 0.5];
        try {
            const parsed = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(parsed)) prices = parsed.map(Number);
        } catch(e) {}

        const yesVal = Math.max(0.001, prices[0] || 0.5);
        return {
            id: m.id || Math.random(),
            title: m.question,
            image: m.image || '',
            volume: parseFloat(m.volume24h) || 0,
            liquidity: parseFloat(m.liquidity) || 0,
            yes: yesVal,
            no: 1 - yesVal,
            days: Math.floor(Math.random() * 15) + 1,
            trend: Array.from({length: 12}, () => Math.random()),
            url: `https://polymarket.com/market/${m.slug || ''}`
        };
    });
}

function deployFallbackData() {
    dashboardMarkets = [
        { id:1, title:'Will Iran strike Israel by March 31?', volume:11000000, liquidity:2500000, yes:0.001, no:0.999, days:14, trend:[0.1, 0.2, 0.15, 0.3, 0.2, 0.4, 0.6, 0.1], url:'#' },
        { id:2, title:'Will the Fed decrease rates by 50+ bps?', volume:5000000, liquidity:4100000, yes:0.003, no:0.997, days:7, trend:[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2], url:'#' },
        { id:3, title:'US 2024 Presidential Election Winner', volume:850000000, liquidity:120000000, yes:0.54, no:0.46, days:200, trend:[0.5, 0.52, 0.51, 0.53, 0.54, 0.55], url:'#' },
        { id:4, title:'Will Bitcoin hit $100k in 2026?', volume:4500000, liquidity:900000, yes:0.25, no:0.75, days:400, trend:[0.1, 0.15, 0.2, 0.25, 0.28, 0.3], url:'#' }
    ];
}

function updateStatsBar() {
    const elMarkets = document.getElementById('stat-markets');
    const elVol = document.getElementById('stat-volume');
    const elOpps = document.getElementById('stat-opps');
    const elRoi = document.getElementById('stat-roi');

    if (elMarkets) elMarkets.innerText = dashboardMarkets.length;
    if (elVol) {
        const sumV = dashboardMarkets.reduce((s, m) => s + m.volume, 0);
        elVol.innerText = '$' + (sumV / 1e6).toFixed(1) + 'M';
    }
    if (elOpps) elOpps.innerText = dashboardMarkets.filter(m => (1/m.yes) > 10).length;
    if (elRoi) {
        const maxR = Math.max(...dashboardMarkets.map(m => 1/m.yes));
        elRoi.innerText = Math.round(maxR) + 'x';
    }
}

function renderDashboard() {
    const container = document.getElementById('markets-container');
    if (!container) return;
    container.innerHTML = '';
    
    const query = document.getElementById('market-input')?.value.toLowerCase() || '';
    const filtered = dashboardMarkets.filter(m => m.title.toLowerCase().includes(query));

    filtered.forEach(m => {
        const yesC = (m.yes * 100).toFixed(1);
        const win = (10 / m.yes).toFixed(2);
        const roi = (1 / m.yes).toFixed(1);
        const spark = generateSparkPath(m.trend);

        container.innerHTML += `
            <div class="market-box clickable">
                <div class="card-tags">
                    <div class="tag-wrap">
                        <span class="tag blue">HIGH VOL</span>
                        <span class="tag orange">SOON</span>
                    </div>
                    <svg class="bell-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                
                <div class="card-title-row">
                    <img src="${m.image}" class="market-img" onerror="this.src='https://via.placeholder.com/44/2563eb/ffffff?text=P'">
                    <h3 class="market-name">${m.title}</h3>
                </div>

                <div class="market-info">
                    ${m.days}d  Vol <b>$${formatCompact(m.volume)}</b>  Liq <b>$${formatCompact(m.liquidity)}</b>
                </div>

                <svg class="sparkline-svg" viewBox="0 0 100 40">
                    <path d="${spark}" fill="none" stroke="${m.yes > 0.5 ? '#16a34a' : '#2563eb'}" stroke-width="2" stroke-linecap="round"/>
                </svg>

                <div class="price-boxes">
                    <div class="price-tag yes">Yes ${yesC}¢</div>
                    <div class="price-tag no">No ${(100 - yesC).toFixed(1)}¢</div>
                </div>

                <div class="betting-ui">
                    <span>Bet $ </span>
                    <div class="bet-input-box">
                        <input type="text" value="10" readonly>
                        <span class="potential-win">→ win <b>$${win}</b></span>
                    </div>
                </div>

                <div class="card-bottom">
                    <span style="color:var(--positive)">${roi}x</span>
                    <span class="percent-change" style="color:var(--text-muted)">0.0%</span>
                </div>

                <button class="buy-btn clickable" onclick="window.open('${m.url}', '_blank')">Trade on Polymarket</button>
            </div>
        `;
    });
}

// --- UTILS ---
function generateSparkPath(trend) {
    const w = 100;
    const h = 40;
    const step = w / (trend.length - 1);
    return trend.map((v, i) => {
        const x = i * step;
        const y = h - (v * (h - 10) + 5);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
}

function formatCompact(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}
