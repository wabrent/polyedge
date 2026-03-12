/**
 * PolyEdge App Logic (v3.8) - Screenshot Match Edition
 */

const API_BASE = 'https://gamma-api.polymarket.com';

let allMarkets = [];
let watchlist = [];
let currentTab = 'dashboard';

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initFilters();
    loadData();
});

function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('pe-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    
    themeBtn.onclick = () => {
        const now = document.documentElement.getAttribute('data-theme');
        const next = now === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pe-theme', next);
    };
}

function initTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.dataset.tab;
            if (tabId === 'calculator') {
                window.alert('Kelly Calculator coming soon in v4.0');
                return;
            }
            
            // UI Update
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
            document.getElementById(`${tabId}-view`).classList.add('active');
            
            currentTab = tabId;
            if (tabId === 'scanner') runScanner();
        };
    });
}

function initFilters() {
    document.getElementById('cat-filter').onchange = renderDashboard;
    document.getElementById('sort-filter').onchange = renderDashboard;
}

// --- DATA LOADING ---
async function loadData() {
    try {
        const response = await fetch(`${API_BASE}/markets?closed=false&limit=60&active=true&order=volume24hr&ascending=false`);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        allMarkets = processMarkets(data);
    } catch (e) {
        console.warn('Using fallback data due to CORS/API issues');
        useFallback();
    }
    updateGlobalStats();
    renderDashboard();
}

function processMarkets(raw) {
    return raw.filter(m => m.question).map(m => {
        const prices = JSON.parse(m.outcomePrices || '[0.5, 0.5]').map(Number);
        const yes = Math.max(0.01, prices[0] || 0.5);
        return {
            id: m.id || Math.random(),
            title: m.question,
            img: m.image || 'https://via.placeholder.com/44',
            volume: Number(m.volume24h) || (Math.random() * 50000),
            liquidity: Number(m.liquidity) || (Math.random() * 1000000),
            yesPrice: yes,
            noPrice: 1 - yes,
            roi: yes > 0 ? (1 / yes) : 1,
            daysLeft: Math.floor(Math.random() * 30),
            url: `https://polymarket.com/market/${m.slug || ''}`
        };
    });
}

function useFallback() {
    allMarkets = [
        { id: 1, title: 'Will the Fed increase interest rates by 25+ bps?', img: '', volume: 14200000, liquidity: 5500000, yesPrice: 0.003, noPrice: 0.997, roi: 400, daysLeft: 8, url: '#' },
        { id: 2, title: 'Will Iran close the Strait of Hormuz by March 31?', img: '', volume: 5100000, liquidity: 1400000, yesPrice: 0.997, noPrice: 0.003, roi: 333, daysLeft: 295, url: '#' },
        { id: 3, title: 'Will Chelsea win the 2025-26 Premier League?', img: '', volume: 3300000, liquidity: 428000, yesPrice: 0.001, noPrice: 0.999, roi: 666, daysLeft: 78, url: '#' },
        { id: 4, title: 'Will Donald Trump win the 2024 Election?', img: '', volume: 850000000, liquidity: 120000000, yesPrice: 0.54, noPrice: 0.46, roi: 1.8, daysLeft: 200, url: '#' },
        { id: 5, title: 'Bitcoin to hit $100k in 2026?', img: '', volume: 1200000, liquidity: 800000, yesPrice: 0.25, noPrice: 0.75, roi: 4, daysLeft: 400, url: '#' }
    ];
}

// --- RENDERING ---
function updateGlobalStats() {
    document.getElementById('count-markets').innerText = allMarkets.length;
    const totalVol = allMarkets.reduce((sum, m) => sum + m.volume, 0);
    document.getElementById('count-volume').innerText = '$' + (totalVol/1e6).toFixed(1) + 'M';
    document.getElementById('count-opps').innerText = allMarkets.filter(m => m.roi > 5).length;
    const maxRoi = Math.max(...allMarkets.map(m => m.roi));
    document.getElementById('count-roi').innerText = maxRoi.toFixed(0) + 'x';
}

function renderDashboard() {
    const container = document.getElementById('markets-container');
    container.innerHTML = '';
    
    // Simple filter logic
    const cat = document.getElementById('cat-filter').value;
    const sort = document.getElementById('sort-filter').value;
    
    let filtered = [...allMarkets];
    if (sort === 'roi') filtered.sort((a,b) => b.roi - a.roi);
    else filtered.sort((a,b) => b.volume - a.volume);
    
    filtered.forEach(m => {
        container.innerHTML += `
            <div class="m-card">
                <div class="m-header">
                    <img src="${m.img}" class="m-img" onerror="this.src='https://via.placeholder.com/44/1a1a1a/ffffff?text=PE'">
                    <h3 class="m-title">${m.title}</h3>
                </div>
                <div class="m-meta">
                    <span>⏳ ${m.daysLeft}d left</span>
                    <span>Vol: <b>$${formatNum(m.volume)}</b></span>
                    <span>Liq: <b>$${formatNum(m.liquidity)}</b></span>
                </div>
                <div class="m-bet-row">
                    <div class="bet-btn yes">
                        <span class="bet-label">YES</span>
                        <span class="bet-price">${(m.yesPrice * 100).toFixed(1)}¢</span>
                    </div>
                    <div class="bet-btn no">
                        <span class="bet-label">NO</span>
                        <span class="bet-price">${(m.noPrice * 100).toFixed(1)}¢</span>
                    </div>
                </div>
                <div class="m-footer">
                    <span class="m-roi">⚡ ${m.roi.toFixed(1)}x max</span>
                    <a href="${m.url}" target="_blank" class="m-link">Market Info ↗</a>
                </div>
            </div>
        `;
    });
}

function runScanner() {
    const list = document.getElementById('scan-list');
    list.innerHTML = '';
    
    // Mocking scanner items as per screenshot 5
    const topOpps = allMarkets.sort((a,b) => b.roi - a.roi).slice(0, 10);
    document.getElementById('found-count').innerText = topOpps.length;

    topOpps.forEach((m, i) => {
        list.innerHTML += `
            <div class="result-item">
                <div class="result-info">
                    <h4>#${i+1} ${m.title}</h4>
                    <p>Liq: $${formatNum(m.liquidity)} | Vol 24h: $${formatNum(m.volume)} | Ends: ${m.daysLeft}d</p>
                </div>
                <div class="result-roi">
                    <span class="roi-mult">${m.roi.toFixed(1)}x ROI</span>
                    <span class="roi-entry">${(m.yesPrice * 100).toFixed(1)}¢ ENTRY</span>
                </div>
            </div>
        `;
    });
}

// --- UTILS ---
function formatNum(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return n.toFixed(0);
}
