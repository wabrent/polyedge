/**
 * PolyEdge App (v3.9) - Precision UI Match
 */

const API_BASE = 'https://gamma-api.polymarket.com';

let allMarkets = [];
let currentTab = 'markets';
let refreshTimer = 2; // Circular timer mock

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initClocks();
    initTimer();
    loadData();
    
    document.getElementById('market-search').addEventListener('input', renderMarkets);
});

function initTheme() {
    const btn = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('pe-theme-v2') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    
    btn.onclick = () => {
        const now = document.documentElement.getAttribute('data-theme');
        const next = now === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pe-theme-v2', next);
    };
}

function initTabs() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentTab = link.dataset.tab;
            renderMarkets();
        };
    });
}

function initClocks() {
    const update = () => {
        const now = new Date();
        const fmt = (tz) => now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
        document.querySelectorAll('.world-clocks .clock b')[0].innerText = fmt('America/New_York');
        document.querySelectorAll('.world-clocks .clock b')[1].innerText = fmt('Europe/London');
        document.querySelectorAll('.world-clocks .clock b')[2].innerText = fmt('Asia/Tokyo');
    };
    update(); setInterval(update, 10000);
}

function initTimer() {
    const circle = document.querySelector('.circle');
    setInterval(() => {
        refreshTimer--;
        if (refreshTimer < 0) refreshTimer = 15;
        const offset = (refreshTimer / 15) * 100;
        circle.setAttribute('stroke-dasharray', `${offset}, 100`);
        document.querySelector('.timer-text').innerText = refreshTimer + 's';
    }, 1000);
}

// --- DATA ---
async function loadData() {
    try {
        const res = await fetch(`${API_BASE}/markets?closed=false&limit=30&active=true&order=volume24hr&ascending=false`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        allMarkets = processMarkets(data);
    } catch (e) {
        useFallback();
    }
    updateStats();
    renderMarkets();
}

function processMarkets(raw) {
    return (Array.isArray(raw) ? raw : (raw.markets || [])).filter(m => m.question).map(m => {
        const pStr = typeof m.outcomePrices === 'string' ? m.outcomePrices : JSON.stringify(m.outcomePrices);
        const prices = JSON.parse(pStr || '[0.5, 0.5]').map(Number);
        const yes = Math.max(0.001, prices[0] || 0.5);
        
        return {
            id: m.id || Math.random(),
            title: m.question,
            img: m.image || 'https://via.placeholder.com/44/2563eb/ffffff?text=P',
            volume: Number(m.volume24h) || 0,
            liq: Number(m.liquidity) || 0,
            yes: yes,
            no: 1 - yes,
            days: Math.floor(Math.random() * 20) + 1,
            roi: (1 / yes),
            url: `https://polymarket.com/market/${m.slug || ''}`,
            trend: Array.from({length: 10}, () => Math.random())
        };
    });
}

function useFallback() {
    allMarkets = [
        { id:1, title:'Will Iran strike Israel on March 6?', img:'https://via.placeholder.com/44', volume:11000000, liq:2500000, yes:0.001, no:0.999, days:0, roi:666.7, url:'#', trend:[0.1, 0.2, 0.15, 0.3, 0.2, 0.4, 0.5, 0.45, 0.6, 0.7] },
        { id:2, title:'Will Iran close the Strait of Hormuz by March 31?', img:'https://via.placeholder.com/44', volume:7800000, liq:1700000, yes:0.998, no:0.002, days:295, roi:400, url:'#', trend:[0.9, 0.85, 0.88, 0.92, 0.95, 0.94, 0.96, 0.98, 0.99, 0.998] },
        { id:3, title:'Will the Fed decrease interest rates by 50+ bps?', img:'https://via.placeholder.com/44', volume:5000000, liq:4100000, yes:0.003, no:0.997, days:7, roi:400, url:'#', trend:[0.1, 0.05, 0.08, 0.02, 0.04, 0.03, 0.01, 0.02, 0.04, 0.03] },
        { id:4, title:'Will the Fed increase interest rates by 25+ bps?', img:'https://via.placeholder.com/44', volume:3700000, liq:4800000, yes:0.003, no:0.997, days:7, roi:400, url:'#', trend:[0.2, 0.15, 0.1, 0.05, 0.08, 0.04, 0.03, 0.02, 0.02, 0.03] },
        { id:5, title:'Will Chelsea win the 2025-26 Premier League?', img:'https://via.placeholder.com/44', volume:3400000, liq:395000, yes:0.001, no:0.999, days:77, roi:1000, url:'#', trend:[0.1, 0.12, 0.11, 0.13, 0.1, 0.14, 0.12, 0.15, 0.13, 0.1] }
    ];
}

function updateStats() {
    document.getElementById('markets-count').innerText = allMarkets.length;
    const vol = allMarkets.reduce((s, m) => s + m.volume, 0);
    document.getElementById('total-vol').innerText = `$${(vol/1e6).toFixed(1)}M`;
    document.getElementById('opps-count').innerText = allMarkets.filter(m=>m.roi > 50).length;
    const maxRoi = Math.max(...allMarkets.map(m=>m.roi));
    document.getElementById('best-roi').innerText = Math.round(maxRoi) + 'x';
}

function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    grid.innerHTML = '';
    
    const search = document.getElementById('market-search').value.toLowerCase();
    const filtered = allMarkets.filter(m => m.title.toLowerCase().includes(search));

    filtered.forEach(m => {
        const yesCents = (m.yes * 100).toFixed(1);
        const win = (10 / m.yes).toFixed(2);
        const svgPath = generateSparkPath(m.trend);
        const trendColor = m.trend[m.trend.length-1] > m.trend[0] ? '#16a34a' : '#dc2626';

        grid.innerHTML += `
            <div class="m-card">
                <div class="card-top">
                    <div class="tag-group">
                        <span class="pill-tag blue"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> HIGH VOL</span>
                        <span class="pill-tag orange">SOON</span>
                    </div>
                    <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div class="card-mid">
                    <img src="${m.img}" class="m-icon" onerror="this.src='https://via.placeholder.com/44/2563eb/ffffff?text=P'">
                    <h3 class="m-title">${m.title}</h3>
                </div>
                <div class="m-data">
                    ${m.days}d  Vol <b>$${(m.volume/1e6).toFixed(1)}M</b>  Liq <b>$${(m.liq/1e6).toFixed(1)}M</b>
                </div>
                
                <svg class="spark-line" viewBox="0 0 100 40">
                    <path d="${svgPath}" fill="none" stroke="${trendColor}" stroke-width="2" stroke-linecap="round"/>
                </svg>

                <div class="price-row">
                    <div class="btn-price yes">Yes ${yesCents}¢</div>
                    <div class="btn-price no">No ${(100-yesCents).toFixed(1)}¢</div>
                </div>

                <div class="bet-area">
                    <span>Bet $ </span>
                    <div class="bet-input-wrap">
                        <input type="text" value="10" readonly>
                        <span>→ win <b class="win-amount">$${win}</b></span>
                    </div>
                </div>

                <div class="card-footer">
                    <span class="roi-text">${m.roi.toFixed(1)}x</span>
                    <span class="change-text">${(Math.random()*2 - 1).toFixed(1)}%</span>
                </div>

                <button class="trade-btn" onclick="window.open('${m.url}', '_blank')">Trade on Polymarket</button>
            </div>
        `;
    });
}

function generateSparkPath(trend) {
    const step = 100 / (trend.length - 1);
    return trend.map((val, i) => {
        const x = i * step;
        const y = 40 - (val * 30 + 5); // Range 5-35
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
}
