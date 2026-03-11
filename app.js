// ========== PolyEdge — Polymarket Analytics Dashboard ==========

const API_BASE = 'https://gamma-api.polymarket.com';

// CORS proxies for file:// and Vercel protocol fallback
const CORS_PROXIES = [
    (url) => url, // Try direct first
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];
let workingProxyIndex = 0;

// ========== STATE ==========
let allMarkets = [];
let displayedCount = 0;
const BATCH_SIZE = 12;
let isLoading = false;
let refreshTimer = 60;
let refreshInterval = null;
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');
let alerts = JSON.parse(localStorage.getItem('polyedge-alerts') || '{}');

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initTabs();
    initBudgetSync();
    initSearch();
    initKellyCalculator();
    initScannerControls();
    initWatchlist();
    loadMarkets();
    startAutoRefresh();
});

// ========== THEME TOGGLE ==========
function initThemeToggle() {
    const saved = localStorage.getItem('polyedge-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcons();
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('polyedge-theme', next);
        updateThemeIcons();
    });
}

function updateThemeIcons() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.querySelector('.icon-moon').style.display = isLight ? 'none' : 'block';
    document.querySelector('.icon-sun').style.display = isLight ? 'block' : 'none';
}

// ========== TAB NAVIGATION ==========
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${target}`).classList.add('active');
            if (target === 'watchlist') renderWatchlist();
        });
    });
}

// ========== BUDGET SYNC ==========
function initBudgetSync() {
    const budgetInput = document.getElementById('budget-input');
    const kellyBankroll = document.getElementById('kelly-bankroll');
    budgetInput.addEventListener('input', () => {
        kellyBankroll.value = Number(budgetInput.value) || 100;
        calculateKelly();
    });
    kellyBankroll.addEventListener('input', () => {
        budgetInput.value = Number(kellyBankroll.value) || 100;
    });
}

// ========== SEARCH ==========
function initSearch() {
    const input = document.getElementById('search-input');
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            displayedCount = 0;
            renderMarkets();
        }, 200);
    });
}

function getSearchQuery() {
    return (document.getElementById('search-input').value || '').toLowerCase().trim();
}

// ========== AUTO-REFRESH ==========
function startAutoRefresh() {
    refreshTimer = 60;
    updateRefreshDisplay();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        refreshTimer--;
        updateRefreshDisplay();
        if (refreshTimer <= 0) {
            refreshTimer = 60;
            document.getElementById('refresh-ring').style.animation = 'none';
            void document.getElementById('refresh-ring').offsetWidth;
            document.getElementById('refresh-ring').style.animation = 'refreshSpin 60s linear infinite';
            silentRefresh();
        }
    }, 1000);
}

function updateRefreshDisplay() {
    document.getElementById('refresh-text').textContent = `${refreshTimer}s`;
}

async function silentRefresh() {
    const markets = await fetchMarkets(60);
    if (markets.length > 0) {
        allMarkets = processMarkets(markets);
        updateStats();
        displayedCount = 0;
        renderMarkets();
        checkAlerts();
    }
}

// ========== ALERTS & WATCHLIST ==========
function checkAlerts() {
    if (Notification.permission !== "granted") return;
    
    let changed = false;
    Object.keys(alerts).forEach(id => {
        const market = allMarkets.find(m => m.id === id);
        if (!market) return;
        
        const alert = alerts[id];
        const triggered = alert.isAbove ? market.yesPrice >= alert.target : market.yesPrice <= alert.target;
        
        if (triggered) {
            new Notification('PolyEdge Alert 🚨', {
                body: `${alert.name}\nHit target: ${(alert.target*100).toFixed(1)}¢ (Current: ${(market.yesPrice*100).toFixed(1)}¢)`
            });
            delete alerts[id];
            changed = true;
        }
    });
    
    if (changed) {
        saveAlerts();
        renderMarkets();
    }
}

function saveAlerts() {
    localStorage.setItem('polyedge-alerts', JSON.stringify(alerts));
}

function initWatchlist() {
    document.getElementById('clear-watchlist-btn').addEventListener('click', () => {
        watchlist = [];
        saveWatchlist();
        renderWatchlist();
    });
}

function toggleWatchlist(marketId) {
    const idx = watchlist.indexOf(marketId);
    if (idx === -1) watchlist.push(marketId);
    else watchlist.splice(idx, 1);
    saveWatchlist();
    // Update star buttons
    document.querySelectorAll(`.mc-star[data-id="${marketId}"]`).forEach(btn => {
        btn.classList.toggle('active', watchlist.includes(marketId));
        btn.textContent = watchlist.includes(marketId) ? '★' : '☆';
    });
}

function saveWatchlist() {
    localStorage.setItem('polyedge-watchlist', JSON.stringify(watchlist));
}

function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    const empty = document.getElementById('watchlist-empty');
    const watched = allMarkets.filter(m => watchlist.includes(m.id));

    if (watched.length === 0) {
        grid.innerHTML = '';
        grid.appendChild(empty);
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = '';
    watched.forEach((m, i) => grid.appendChild(createMarketCard(m, i)));
}

// ========== API CALLS ==========
async function fetchWithProxy(url) {
    // Race all connection methods simultaneously to eliminate any timeouts
    const endpoints = [
        url, // 1. Direct (Fastest if no CORS block)
        `https://corsproxy.io/?${encodeURIComponent(url)}`, // 2. Fast Proxy
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` // 3. Backup Proxy
    ];

    try {
        const data = await Promise.any(endpoints.map(async (eUrl) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s absolute max wait
            
            const res = await fetch(eUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            
            const json = await res.json();
            if (!json || json.length === 0) throw new Error('Empty or invalid payload');
            
            return json;
        }));
        return data;
    } catch (err) {
        console.error('All endpoints failed or timed out:', err);
        return [];
    }
}

async function fetchMarkets(limit = 50, offset = 0, order = 'volume24hr') {
    const url = `${API_BASE}/markets?closed=false&limit=${limit}&offset=${offset}&order=${order}&ascending=false&active=true`;
    return await fetchWithProxy(url);
}

// ========== LOAD MARKETS ==========
async function loadMarkets() {
    isLoading = true;
    // Requesting 60 markets instead of 100 to halve the download payload size (from ~10MB to ~5MB)
    const markets = await fetchMarkets(60);
    allMarkets = processMarkets(markets);
    updateStats();
    displayedCount = 0;
    renderMarkets();
    isLoading = false;

    document.getElementById('load-more-btn').addEventListener('click', () => {
        renderMarkets();
        if (displayedCount >= getFilteredMarkets().length) {
            document.getElementById('load-more-btn').style.display = 'none';
        }
    });

    document.getElementById('sort-filter').addEventListener('change', () => { displayedCount = 0; renderMarkets(); });
    document.getElementById('category-filter').addEventListener('change', () => { displayedCount = 0; renderMarkets(); });
    document.getElementById('volume-filter').addEventListener('change', () => { displayedCount = 0; renderMarkets(); });
}

function processMarkets(raw) {
    return raw.map(m => {
        const outcomes = safeJsonParse(m.outcomes, ['Yes', 'No']);
        const prices = safeJsonParse(m.outcomePrices, ['0.5', '0.5']).map(Number);
        const yesPrice = prices[0] || 0.5;
        const noPrice = prices[1] || 0.5;
        const minPrice = Math.min(yesPrice, noPrice);
        const maxRoi = minPrice > 0 ? (1 / minPrice) : 1;
        const endDate = m.endDate ? new Date(m.endDate) : null;
        const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))) : null;

        const q = (m.question || '').toLowerCase();
        let category = 'other';
        if (q.includes('president') || q.includes('election') || q.includes('trump') || q.includes('biden') || q.includes('congress') || q.includes('senate') || q.includes('governor') || q.includes('ceasefire') || q.includes('war') || q.includes('iran') || q.includes('fed ') || q.includes('interest rate') || q.includes('tariff'))
            category = 'politics';
        else if (q.includes('bitcoin') || q.includes('ethereum') || q.includes('crypto') || q.includes('btc') || q.includes('eth') || q.includes('solana'))
            category = 'crypto';
        else if (q.includes('premier league') || q.includes('nfl') || q.includes('nba') || q.includes('world cup') || q.includes('champions league') || q.includes('win the') || q.includes('super bowl') || q.includes('uefa'))
            category = 'sports';
        else if (q.includes('gdp') || q.includes('inflation') || q.includes('recession') || q.includes('market') || q.includes('s&p') || q.includes('nasdaq') || q.includes('fomc') || q.includes('economy'))
            category = 'economics';

        return {
            id: m.id,
            question: m.question || 'Unknown Market',
            slug: m.slug || '',
            image: m.icon || m.image || '',
            yesPrice, noPrice, outcomes,
            volume24h: m.volume24hr || 0,
            volumeTotal: m.volumeNum || 0,
            liquidity: m.liquidityNum || 0,
            endDate, daysLeft, maxRoi, minPrice, category,
            priceChange24h: m.oneDayPriceChange || 0,
            priceChange1w: m.oneWeekPriceChange || 0,
            lastTradePrice: m.lastTradePrice || 0,
            bestBid: m.bestBid || 0,
            bestAsk: m.bestAsk || 0,
            spread: (m.bestAsk || 0) - (m.bestBid || 0),
            eventSlug: m.events?.[0]?.slug || m.slug || '',
        };
    }).filter(m => m.volume24h > 0);
}

function safeJsonParse(str, fallback) {
    if (Array.isArray(str)) return str;
    try { return JSON.parse(str); }
    catch { return fallback; }
}

// ========== STATS ==========
function updateStats() {
    document.getElementById('stat-total-markets').textContent = allMarkets.length;
    const totalVol = allMarkets.reduce((s, m) => s + m.volume24h, 0);
    document.getElementById('stat-total-volume').textContent = formatCurrency(totalVol);
    const hotOpps = allMarkets.filter(m => m.maxRoi >= 3 && m.liquidity > 10000).length;
    document.getElementById('stat-opportunities').textContent = hotOpps;
    const rois = allMarkets.map(m => m.maxRoi);
    const maxRoi = rois.length > 0 ? Math.max(...rois) : 0;
    document.getElementById('stat-max-potential').textContent = `${maxRoi.toFixed(0)}x`;
}

// ========== RENDER ==========
function getFilteredMarkets() {
    const sortBy = document.getElementById('sort-filter').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const volumeFilter = Number(document.getElementById('volume-filter').value) || 0;
    const search = getSearchQuery();

    let filtered = categoryFilter === 'all'
        ? [...allMarkets]
        : allMarkets.filter(m => m.category === categoryFilter);

    if (volumeFilter > 0) {
        filtered = filtered.filter(m => m.volumeTotal >= volumeFilter);
    }

    if (search) {
        filtered = filtered.filter(m => m.question.toLowerCase().includes(search));
    }

    switch (sortBy) {
        case 'volume24hr': filtered.sort((a, b) => b.volume24h - a.volume24h); break;
        case 'liquidity': filtered.sort((a, b) => b.liquidity - a.liquidity); break;
        case 'potential': filtered.sort((a, b) => b.maxRoi - a.maxRoi); break;
        case 'ending': filtered.sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)); break;
    }
    return filtered;
}

function renderMarkets() {
    const grid = document.getElementById('markets-grid');
    const filtered = getFilteredMarkets();

    if (displayedCount === 0) grid.innerHTML = '';

    const batch = filtered.slice(displayedCount, displayedCount + BATCH_SIZE);

    if (batch.length === 0 && displayedCount === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No markets found</p></div>`;
        document.getElementById('load-more-btn').style.display = 'none';
        return;
    }

    batch.forEach((m, i) => grid.appendChild(createMarketCard(m, displayedCount + i)));
    displayedCount += batch.length;

    document.getElementById('load-more-btn').style.display =
        displayedCount < filtered.length ? 'block' : 'none';
}

// ========== SPARKLINE ==========
function generateSparkline(market) {
    // Generate a mini price trend from available data points
    const basePrice = market.yesPrice;
    const change24h = market.priceChange24h || 0;
    const change1w = market.priceChange1w || 0;

    // Simulate 7 data points from weekly to current
    const points = [];
    const startPrice = basePrice - change1w;
    const midPrice = basePrice - change24h;

    for (let i = 0; i < 7; i++) {
        let p;
        if (i < 5) {
            p = startPrice + (midPrice - startPrice) * (i / 5);
        } else {
            p = midPrice + (basePrice - midPrice) * ((i - 5) / 2);
        }
        // Add slight noise for realism
        p += (Math.random() - 0.5) * 0.02;
        p = Math.max(0.01, Math.min(0.99, p));
        points.push(p);
    }
    points.push(basePrice); // Last point = current

    const w = 200;
    const h = 24;
    const min = Math.min(...points) - 0.01;
    const max = Math.max(...points) + 0.01;
    const range = max - min || 0.1;

    const pathPoints = points.map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const color = change24h >= 0 ? 'var(--green)' : 'var(--red)';

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <polyline points="${pathPoints.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// ========== BADGES ==========
function getBadges(market) {
    const badges = [];
    if (Math.abs(market.priceChange24h) >= 0.05) badges.push('<span class="badge badge-hot">🔥 Hot</span>');
    if (market.daysLeft !== null && market.daysLeft <= 3) badges.push('<span class="badge badge-ending">⏰ Ending</span>');
    else if (market.daysLeft !== null && market.daysLeft <= 7) badges.push('<span class="badge badge-ending">Soon</span>');
    if (market.volume24h >= 1000000) badges.push('<span class="badge badge-high-vol">📈 High Vol</span>');
    return badges.length ? `<div class="mc-badges">${badges.join('')}</div>` : '';
}

// ========== MARKET CARD ==========
function createMarketCard(market, index) {
    const card = document.createElement('div');
    card.className = 'market-card';

    const roiClass = market.maxRoi >= 10 ? 'roi-high' : market.maxRoi >= 3 ? 'roi-mid' : 'roi-low';
    const changeClass = market.priceChange24h > 0 ? 'up' : market.priceChange24h < 0 ? 'down' : 'flat';
    const changeSign = market.priceChange24h > 0 ? '+' : '';
    const daysText = market.daysLeft !== null ? `${market.daysLeft}d` : '∞';
    const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;
    const isWatched = watchlist.includes(market.id);
    const budget = Number(document.getElementById('budget-input').value) || 100;

    card.innerHTML = `
        <div style="position:absolute; top:12px; right:48px; font-size:1.2rem; cursor:pointer; opacity: ${alerts[market.id] ? '1' : '0.3'}; transition: 0.2s; z-index: 10;" class="mc-alert" data-id="${market.id}">${alerts[market.id] ? '🔔' : '🔕'}</div>
        <div class="mc-star ${isWatched ? 'active' : ''}" data-id="${market.id}">${isWatched ? '★' : '☆'}</div>
        ${getBadges(market)}
        <div class="mc-header">
            <img class="mc-img" src="${market.image}" alt="" loading="lazy" onerror="this.style.display='none'">
            <div class="mc-title">${escapeHtml(market.question)}</div>
        </div>
        <div class="mc-meta">
            <span>${daysText}</span>
            <span>Vol ${formatCompact(market.volume24h)}</span>
            <span>Liq ${formatCompact(market.liquidity)}</span>
        </div>
        <div class="mc-sparkline">${generateSparkline(market)}</div>
        <div class="mc-prices">
            <div class="mc-price yes"><div class="mc-price-bar"><span class="mc-price-label">Yes</span>${(market.yesPrice * 100).toFixed(1)}¢</div></div>
            <div class="mc-price no"><div class="mc-price-bar"><span class="mc-price-label">No</span>${(market.noPrice * 100).toFixed(1)}¢</div></div>
        </div>
        <div class="mc-profit">
            <span class="mc-profit-label">Bet $</span>
            <input type="number" class="mc-profit-input" value="${Math.min(budget, 10)}" min="1" data-price="${market.minPrice}">
            <span class="mc-profit-result">→ win $${((Math.min(budget, 10) / market.minPrice) - Math.min(budget, 10)).toFixed(2)}</span>
        </div>
        <div class="mc-footer">
            <span class="mc-roi ${roiClass}">${market.maxRoi.toFixed(1)}x</span>
            <span class="mc-change ${changeClass}">${changeSign}${(market.priceChange24h * 100).toFixed(1)}%</span>
        </div>
        <a class="btn-primary" href="${polymarketUrl}" target="_blank" rel="noopener" style="display: block; text-align: center; margin-top: 12px; padding: 10px 0; text-decoration: none; width: 100%; box-sizing: border-box;">Trade on Polymarket</a>
    `;

    // Alert click
    const alertBtn = card.querySelector('.mc-alert');
    if (alertBtn) {
        alertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (alerts[market.id]) {
                delete alerts[market.id];
                saveAlerts();
                renderMarkets();
                return;
            }
            if (Notification.permission !== "granted") Notification.requestPermission();
            
            const targetStr = prompt(`Alert me when "${market.outcomes[0] || 'Yes'}" price hits (e.g. "60" for above 60¢, or "< 20" for below 20¢):`);
            if (!targetStr) return;
            
            let target = Number(targetStr.replace(/[^\d.]/g, '')) / 100;
            if (isNaN(target) || target <= 0) return;
            
            const isAbove = !targetStr.includes('<') && !targetStr.toLowerCase().includes('below');
            alerts[market.id] = { target, isAbove, name: market.question };
            saveAlerts();
            renderMarkets();
        });
    }

    // Star click
    const starBtn = card.querySelector('.mc-star');
    if (starBtn) {
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchlist(market.id);
        });
    }

    // Profit simulator
    const profitInput = card.querySelector('.mc-profit-input');
    const profitResult = card.querySelector('.mc-profit-result');
    profitInput.addEventListener('input', (e) => {
        e.stopPropagation();
        const bet = Number(profitInput.value) || 0;
        const price = Number(profitInput.dataset.price) || 0.5;
        const profit = (bet / price) - bet;
        profitResult.textContent = `→ win $${profit.toFixed(2)}`;
    });
    profitInput.addEventListener('click', e => e.stopPropagation());

    // Card click
    card.addEventListener('click', (e) => {
        if (e.target.closest('.mc-link') || e.target.closest('.mc-star') || e.target.closest('.mc-profit-input')) return;
        window.open(polymarketUrl, '_blank');
    });

    return card;
}

// ========== SCANNER ==========
function initScannerControls() {
    const minRoi = document.getElementById('min-roi');
    const minRoiVal = document.getElementById('min-roi-value');
    minRoi.addEventListener('input', () => minRoiVal.textContent = `${minRoi.value}x`);

    const minLiq = document.getElementById('min-liquidity');
    const minLiqVal = document.getElementById('min-liquidity-value');
    minLiq.addEventListener('input', () => minLiqVal.textContent = `$${formatCompact(Number(minLiq.value))}`);

    const maxDays = document.getElementById('max-days');
    const maxDaysVal = document.getElementById('max-days-value');
    maxDays.addEventListener('input', () => maxDaysVal.textContent = `${maxDays.value}d`);

    document.getElementById('scan-btn').addEventListener('click', runScanner);
}

async function runScanner() {
    const btn = document.getElementById('scan-btn');
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    if (allMarkets.length === 0) {
        const markets = await fetchMarkets(100);
        allMarkets = processMarkets(markets);
    }

    const minRoi = Number(document.getElementById('min-roi').value);
    const minLiq = Number(document.getElementById('min-liquidity').value);
    const maxDays = Number(document.getElementById('max-days').value);

    const results = allMarkets
        .filter(m => m.maxRoi >= minRoi && m.liquidity >= minLiq && (maxDays >= 365 || (m.daysLeft !== null && m.daysLeft <= maxDays)))
        .sort((a, b) => calculateOpportunityScore(b) - calculateOpportunityScore(a));

    renderScannerResults(results);
    btn.textContent = 'Scan';
    btn.disabled = false;
}

function calculateOpportunityScore(m) {
    return Math.log2(m.maxRoi + 1) * 10
        + Math.log10(m.liquidity + 1) * 3
        + Math.log10(m.volume24h + 1) * 2
        + (m.daysLeft !== null ? Math.max(0, 30 - m.daysLeft) * 0.5 : 0)
        + Math.abs(m.priceChange24h) * 100;
}

function renderScannerResults(results) {
    const container = document.getElementById('scanner-results');
    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No opportunities found. Try adjusting filters.</p></div>`;
        return;
    }

    container.innerHTML = `<p style="font-size:0.82rem;color:var(--text-3);margin-bottom:12px">Found <strong style="color:var(--green)">${results.length}</strong> opportunities</p>`;

    results.slice(0, 25).forEach((market, i) => {
        const card = document.createElement('div');
        card.className = 'sr-card';
        const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;
        const changeClass = market.priceChange24h > 0 ? 'up' : market.priceChange24h < 0 ? 'down' : 'flat';
        const changeSign = market.priceChange24h > 0 ? '+' : '';

        card.innerHTML = `
            <div class="sr-rank">#${i + 1}</div>
            <div class="sr-info">
                <div class="sr-title">${escapeHtml(market.question)}</div>
                <div class="sr-meta">
                    <span>Liq ${formatCompact(market.liquidity)}</span>
                    <span>Vol ${formatCompact(market.volume24h)}</span>
                    <span>${market.daysLeft !== null ? `${market.daysLeft}d` : '∞'}</span>
                    <span class="${changeClass}">${changeSign}${(market.priceChange24h * 100).toFixed(1)}%</span>
                </div>
            </div>
            <div class="sr-stats">
                <div class="sr-stat"><span class="sr-stat-val green">${market.maxRoi.toFixed(1)}x</span><span class="sr-stat-lbl">ROI</span></div>
                <div class="sr-stat"><span class="sr-stat-val">${(market.minPrice * 100).toFixed(1)}¢</span><span class="sr-stat-lbl">Entry</span></div>
            </div>
            <a class="sr-link" href="${polymarketUrl}" target="_blank" rel="noopener">Trade ↗</a>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.sr-link')) return;
            window.open(polymarketUrl, '_blank');
        });
        container.appendChild(card);
    });
}

// ========== ARBITRAGE HUNTER ==========
function renderArbitrage() {
    const grid = document.getElementById('arbitrage-grid');
    grid.innerHTML = '<div class="empty-state"><p>Scanning...</p></div>';

    // Group markets by Event
    const events = {};
    allMarkets.forEach(m => {
        if (!m.eventSlug) return;
        if (!events[m.eventSlug]) events[m.eventSlug] = [];
        events[m.eventSlug].push(m);
    });

    const opps = [];
    for (const slug in events) {
        const eventMarkets = events[slug];
        if (eventMarkets.length < 2 || eventMarkets.length > 20) continue; // Need multiple outcomes

        let sumYes = 0;
        let valid = true;
        let eventVol = 0;
        
        eventMarkets.forEach(m => {
            if (m.yesPrice <= 0 || m.yesPrice >= 1) valid = false;
            sumYes += m.yesPrice;
            eventVol += m.volumeTotal || 0;
        });

        // Only care about Yes sums < 0.98 (guaranteed >2% profit before fees)
        if (valid && sumYes < 0.98 && sumYes > 0.1 && eventVol > 50000) {
            const guaranteedRoi = ((1 / sumYes) - 1) * 100;
            opps.push({
                slug,
                title: eventMarkets[0].question.split('?')[0] + '?', // Guessing the top level event title
                markets: eventMarkets,
                sumYes,
                roi: guaranteedRoi
            });
        }
    }

    opps.sort((a,b) => b.roi - a.roi);

    if (opps.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No guaranteed arbitrage opportunities found currently. PolyEdge scanned all markets.</p></div>';
        return;
    }

    grid.innerHTML = '';
    opps.forEach(opp => {
        const div = document.createElement('div');
        div.className = 'market-card';
        div.style.border = '2px solid var(--green)';
        
        const marketsHtml = opp.markets.map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem;">
                <span style="color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${m.question}</span>
                <span style="font-weight: 600;">${(m.yesPrice * 100).toFixed(1)}¢</span>
            </div>
        `).join('');

        div.innerHTML = `
            <div class="mc-header">
                <div class="mc-title-area" style="width: 100%;">
                    <div class="mc-title">${opp.title}</div>
                    <div class="mc-meta">Guaranteed ROI: <span style="color: var(--green); font-weight: bold;">+${opp.roi.toFixed(2)}%</span></div>
                </div>
            </div>
            <div style="padding: 12px; background: var(--bg); border-radius: 6px; margin-top: 12px;">
                <div style="font-size: 0.8rem; color: var(--text-3); margin-bottom: 8px;">Buy YES on all these outcomes:</div>
                ${marketsHtml}
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                <span>Total Cost / Dollar:</span>
                <span style="font-weight: bold;">${(opp.sumYes * 100).toFixed(1)}¢</span>
            </div>
            <a class="btn-primary" href="https://polymarket.com/event/${opp.slug}" target="_blank" rel="noopener" style="display: block; text-align: center; margin-top: 16px; padding: 10px 0; text-decoration: none; width: 100%; box-sizing: border-box; background: var(--green); color: #fff;">Execute Arbitrage</a>
        `;
        grid.appendChild(div);
    });
}
function initKellyCalculator() {
    const priceRange = document.getElementById('kelly-market-price-range');
    const priceInput = document.getElementById('kelly-market-price');
    const probRange = document.getElementById('kelly-true-prob-range');
    const probInput = document.getElementById('kelly-true-prob');

    priceRange.addEventListener('input', () => { priceInput.value = priceRange.value; calculateKelly(); });
    priceInput.addEventListener('input', () => { priceRange.value = priceInput.value; calculateKelly(); });
    probRange.addEventListener('input', () => { probInput.value = probRange.value; calculateKelly(); });
    probInput.addEventListener('input', () => { probRange.value = probInput.value; calculateKelly(); });

    document.getElementById('kelly-bankroll').addEventListener('input', calculateKelly);

    const kTabs = document.querySelectorAll('.k-tab');
    kTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            kTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            calculateKelly();
        });
    });

    document.getElementById('kelly-calc-btn').addEventListener('click', calculateKelly);

    calculateKelly();
}

function calculateKelly() {
    const bankroll = Number(document.getElementById('kelly-bankroll').value) || 100;
    const marketPrice = Number(document.getElementById('kelly-market-price').value) / 100;
    const trueProb = Number(document.getElementById('kelly-true-prob').value) / 100;

    const activeTab = document.querySelector('.k-tab.active');
    const fraction = activeTab ? Number(activeTab.dataset.val) : 0.5;

    const warning = document.getElementById('kelly-warning');

    if (marketPrice <= 0 || marketPrice >= 1 || trueProb <= 0 || trueProb >= 1) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Enter valid probabilities between 1% and 99%';
        return;
    }

    const edge = trueProb - marketPrice;
    const b = (1 - marketPrice) / marketPrice;
    const p = trueProb;
    const q = 1 - trueProb;
    let kellyFraction = (b * p - q) / b;

    if (kellyFraction <= 0) {
        document.getElementById('kelly-bet-size').textContent = '$0.00';
        document.getElementById('kelly-edge').textContent = `${(edge * 100).toFixed(1)}%`;
        document.getElementById('kelly-ev').textContent = '$0.00';
        document.getElementById('kelly-win').textContent = '+$0.00';
        document.getElementById('kelly-lose').textContent = '-$0.00';
        document.getElementById('kelly-roi').textContent = '0%';
        warning.style.display = 'block';
        warning.textContent = edge < 0
            ? `⚠️ Negative edge (${(edge * 100).toFixed(1)}%). Don't bet!`
            : `⚠️ No edge. Market price equals your estimate.`;
        return;
    }

    warning.style.display = 'none';

    const adjustedKelly = kellyFraction * fraction;
    const betSize = Math.min(bankroll * adjustedKelly, bankroll);
    const shares = betSize / marketPrice;
    const potentialWin = shares - betSize;
    const potentialLoss = betSize;
    const ev = (trueProb * potentialWin) - ((1 - trueProb) * potentialLoss);
    const roi = betSize > 0 ? (potentialWin / betSize) * 100 : 0;

    document.getElementById('kelly-bet-size').textContent = `$${betSize.toFixed(2)}`;
    document.getElementById('kelly-edge').textContent = `${(edge * 100).toFixed(1)}%`;
    document.getElementById('kelly-ev').textContent = `$${ev.toFixed(2)}`;
    document.getElementById('kelly-win').textContent = `+$${potentialWin.toFixed(2)}`;
    document.getElementById('kelly-lose').textContent = `-$${potentialLoss.toFixed(2)}`;
    document.getElementById('kelly-roi').textContent = `${roi.toFixed(0)}%`;

    if (adjustedKelly > 0.25) {
        warning.style.display = 'block';
        warning.textContent = `⚠️ Bet is ${(adjustedKelly * 100).toFixed(0)}% of bankroll. Consider smaller Kelly fraction.`;
        warning.style.background = 'rgba(240,192,64,0.08)';
        warning.style.borderColor = 'rgba(240,192,64,0.2)';
        warning.style.color = 'var(--yellow)';
    }
}

// ========== UTILITIES ==========
function formatCurrency(v) {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
}

function formatCompact(v) {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
