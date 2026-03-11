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
let activeTab = 'dashboard';
let displayedCount = 0;
const BATCH_SIZE = 12;
let isLoading = false;
let refreshTimer = 60;
let refreshInterval = null;
let watchlist = JSON.parse(localStorage.getItem('polyedge-watchlist') || '[]');
let alerts = JSON.parse(localStorage.getItem('polyedge-alerts') || '{}');

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('PolyEdge: Initializing...');
    
    const safeInit = (name, fn) => {
        try {
            fn();
            console.log(`PolyEdge: ${name} initialized`);
        } catch (e) {
            console.error(`PolyEdge: Failed to initialize ${name}`, e);
        }
    };

    safeInit('Theme', initThemeToggle);
    safeInit('Tabs', initTabs);
    safeInit('Clocks', initWorldClocks);
    safeInit('Watchlist', initWatchlist);
    safeInit('ChartModal', initChartModal);
    safeInit('ScannerControls', initScannerControls);
    safeInit('Kelly', initKellyCalculator);
    safeInit('Alpha', initAlphaEngine);

    // Refresh on Logo Click
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/'; // This ensures a clean reload on most hosting environments
        });
    }

    console.log('PolyEdge: Initializing data load...');
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
    const switchTab = (target, updateState = true) => {
        const tabEl = document.getElementById(`tab-${target}`);
        const navEl = document.querySelector(`.nav-item[data-tab="${target}"]`);
        if (!tabEl || !navEl) return;

        document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
        navEl.classList.add('active');

        document.querySelectorAll('.tab').forEach(c => c.classList.remove('active'));
        tabEl.classList.add('active');

        if (target === 'watchlist') renderWatchlist();
        activeTab = target; // Fix: Update global activeTab state
        
        if (updateState) {
            const path = target === 'dashboard' ? '/' : `/${target}`;
            window.history.pushState({ tab: target }, '', path);
        }
        
        // Preview content and Alpha trigger
        if (target === 'scanner' && allMarkets.length > 0) renderScannerResults(allMarkets.slice(0, 5));
        if (target === 'alpha') updateAlphaTerminal(); 
    };

    document.querySelectorAll('.nav-item').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Handle initial path on load
    const currentPath = window.location.pathname.replace('/', '') || 'dashboard';
    const validTabs = ['dashboard', 'watchlist', 'scanner', 'arbitrage', 'kelly'];
    if (validTabs.includes(currentPath)) {
        switchTab(currentPath, false);
    }

    // Handle back/forward buttons
    window.addEventListener('popstate', (event) => {
        const tab = (event.state && event.state.tab) || 'dashboard';
        switchTab(tab, false);
    });
}

// ========== WORLD CLOCKS ==========
function initWorldClocks() {
    const update = () => {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', hour12: false };
        
        const nyc = document.getElementById('clock-nyc');
        const ldn = document.getElementById('clock-ldn');
        const tko = document.getElementById('clock-tko');

        if (nyc) nyc.textContent = now.toLocaleTimeString('en-US', { ...options, timeZone: 'America/New_York' });
        if (ldn) ldn.textContent = now.toLocaleTimeString('en-GB', { ...options, timeZone: 'Europe/London' });
        if (tko) tko.textContent = now.toLocaleTimeString('ja-JP', { ...options, timeZone: 'Asia/Tokyo' });
    };
    update();
    setInterval(update, 10000); // Update every 10s
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
    if (refreshInterval) clearInterval(refreshInterval);
    
    // Initialize refreshTimer based on current tab
    const initialRefreshRate = activeTab === 'alpha' ? 15 : 60;
    refreshTimer = initialRefreshRate;
    updateRefreshUI(); // Call this to set initial display and animation

    refreshInterval = setInterval(() => {
        if (isLoading) return;
        
        // Fast refresh for Alpha, standard for others
        const refreshRate = activeTab === 'alpha' ? 15 : 60;
        
        refreshTimer--;
        if (refreshTimer <= 0) {
            refreshTimer = refreshRate;
            silentRefresh();
        }
        updateRefreshUI();
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
    // Sequential fallback is more reliable for identifying exactly which proxy works
    const proxies = [
        url, // 1. Direct
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` // Final JSON wrapping fallback
    ];

    for (const pUrl of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const res = await fetch(pUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) continue;
            
            let json = await res.json();
            
            // Handle AllOrigins 'get' format
            if (json.contents) {
                try { json = JSON.parse(json.contents); } 
                catch (e) { continue; }
            }

            if (json && (Array.isArray(json) || json.markets)) {
                console.log(`PolyEdge: Data loaded via ${pUrl}`);
                return json;
            }
        } catch (e) {
            console.warn(`PolyEdge: Proxy ${pUrl} failed:`, e.message);
        }
    }

    console.error('PolyEdge: All proxies failed.');
    return [];
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
            conditionId: m.conditionId || '', // Add conditionId for chart modal
        };
    });
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
    const budget = 100; // Default budget as budget-input was removed

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

    // Card click (Chart Modal)
    card.addEventListener('click', (e) => {
        if (e.target.closest('.mc-link') || e.target.closest('.mc-star') || e.target.closest('.mc-profit-input') || e.target.closest('.mc-alert') || e.target.closest('a')) return;
        showChartModal(market);
    });

    return card;
}

// ========== SCANNER ==========
function initScannerControls() {
    const minRoi = document.getElementById('min-roi');
    const minRoiVal = document.getElementById('min-roi-value');
    if (minRoi) minRoi.addEventListener('input', () => minRoiVal.textContent = `${minRoi.value}x`);

    const minLiq = document.getElementById('min-liquidity');
    const minLiqVal = document.getElementById('min-liquidity-value');
    if (minLiq) minLiq.addEventListener('input', () => minLiqVal.textContent = `$${formatCompact(Number(minLiq.value))}`);

    const maxDays = document.getElementById('max-days');
    const maxDaysVal = document.getElementById('max-days-value');
    if (maxDays) maxDays.addEventListener('input', () => maxDaysVal.textContent = `${maxDays.value}d`);

    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) scanBtn.addEventListener('click', runScanner);
}

async function runScanner() {
    const btn = document.getElementById('scan-btn');
    if (!btn) return;
    
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    if (allMarkets.length === 0) {
        await loadMarkets(); // Ensure we have data
    }

    const minRoi = Number(document.getElementById('min-roi').value);
    const minLiq = Number(document.getElementById('min-liquidity').value);
    const maxDays = Number(document.getElementById('max-days').value);

    const results = allMarkets
        .filter(m => {
            const hasRoi = m.maxRoi >= minRoi;
            const hasLiq = m.liquidity >= minLiq;
            const isWithinTime = (maxDays >= 365) || (m.daysLeft !== null && m.daysLeft <= maxDays);
            return hasRoi && hasLiq && isWithinTime;
        })
        .sort((a, b) => (b.volume24h * b.maxRoi) - (a.volume24h * a.maxRoi)); // Sort by "Opportunity Value"

    renderScannerResults(results);
    btn.textContent = 'Scan';
    btn.disabled = false;
}

function renderScannerResults(results) {
    const container = document.getElementById('scanner-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No opportunities found. Try lowering your filters.</p></div>`;
        return;
    }

    container.innerHTML = `<div style="padding: 10px; font-size: 0.9rem; color: var(--text-3); display: flex; justify-content: space-between;">
        <span>Found ${results.length} targets</span>
        <span>Sorted by Opportunity Score</span>
    </div>`;

    results.slice(0, 20).forEach((market, i) => {
        const card = document.createElement('div');
        card.className = 'sr-card';
        const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;
        
        card.innerHTML = `
            <div class="sr-rank">#${i + 1}</div>
            <div class="sr-info">
                <div class="sr-title" style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(market.question)}</div>
                <div class="sr-meta" style="font-size: 0.8rem; color: var(--text-3); display: flex; gap: 12px;">
                    <span>Liq: ${formatCompact(market.liquidity)}</span>
                    <span>Vol 24h: ${formatCompact(market.volume24h)}</span>
                    <span>Ends: ${market.daysLeft !== null ? `${market.daysLeft}d` : '∞'}</span>
                </div>
            </div>
            <div class="sr-stats" style="display: flex; align-items: center; gap: 16px;">
                <div style="text-align: right;">
                    <div style="color: var(--green); font-weight: 700; font-size: 1.1rem;">${market.maxRoi.toFixed(1)}x</div>
                    <div style="font-size: 0.7rem; color: var(--text-3); text-transform: uppercase;">ROI</div>
                </div>
                <div style="text-align: right; min-width: 60px;">
                    <div style="font-weight: 600;">${(market.minPrice * 100).toFixed(1)}¢</div>
                    <div style="font-size: 0.7rem; color: var(--text-3); text-transform: uppercase;">Entry</div>
                </div>
                <a class="sr-link" href="${polymarketUrl}" target="_blank" rel="noopener" style="padding: 8px 12px; background: var(--blue); color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 600;">Trade</a>
            </div>
        `;
        container.appendChild(card);
    });
}

// ========== ARBITRAGE HUNTER ==========
function renderArbitrage() {
    const grid = document.getElementById('arbitrage-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-state"><p>Scanning markets...</p></div>';

    const events = {};
    allMarkets.forEach(m => {
        if (!m.eventSlug) return;
        if (!events[m.eventSlug]) events[m.eventSlug] = [];
        events[m.eventSlug].push(m);
    });

    const opps = [];
    for (const slug in events) {
        const eventMarkets = events[slug];
        if (eventMarkets.length < 2 || eventMarkets.length > 30) continue;

        let sumYes = 0;
        let valid = true;
        eventMarkets.forEach(m => {
            if (m.yesPrice <= 0 || m.yesPrice >= 1) valid = false;
            sumYes += m.yesPrice;
        });

        // Sum < 0.98 means guaranteed >2% ROI
        if (valid && sumYes < 0.99 && sumYes > 0.05) {
            const roi = ((1 / sumYes) - 1) * 100;
            opps.push({
                slug,
                roi,
                sumYes,
                title: eventMarkets[0].question.split('?')[0] + '?',
                markets: eventMarkets.sort((a,b) => b.yesPrice - a.yesPrice)
            });
        }
    }

    if (opps.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No arbitrage active right now. Markets are efficiently priced.</p></div>';
        return;
    }

    grid.innerHTML = '';
    opps.sort((a,b) => b.roi - a.roi).forEach(opp => {
        const card = document.createElement('div');
        card.className = 'arb-card';
        
        const marketsHtml = opp.markets.map(m => `
            <div class="arb-market-row">
                <span class="arb-market-name">${escapeHtml(m.outcomes[0] || m.question)}</span>
                <span class="arb-market-price">${(m.yesPrice * 100).toFixed(1)}¢</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="arb-card-header">
                <div class="arb-roi-badge">+${opp.roi.toFixed(1)}% ROI</div>
                <h3 class="arb-title">${escapeHtml(opp.title)}</h3>
            </div>
            <div class="arb-list">
                <div class="arb-list-label">Execute strategy (Buy YES on all):</div>
                ${marketsHtml}
            </div>
            <div class="arb-footer">
                <div class="arb-total">
                    <span class="label">Total Cost:</span>
                    <span class="value">${(opp.sumYes * 100).toFixed(1)}¢ per $1.00</span>
                </div>
                <a href="https://polymarket.com/event/${opp.slug}" target="_blank" class="arb-btn">Open on Polymarket</a>
            </div>
        `;
        grid.appendChild(card);
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

function safeJsonParse(str, fallback) {
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        return fallback;
    }
}



// ========== CHART MODAL ==========
let currentChart = null;
let currentMarketForChart = null;

function initChartModal() {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.close());
    
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    document.querySelectorAll('.chart-time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-time-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (currentMarketForChart) loadChartData(currentMarketForChart, e.target.dataset.time);
        });
    });
}

function showChartModal(market) {
    currentMarketForChart = market;
    const title = document.getElementById('chart-title');
    if (title) title.textContent = market.question;
    const modal = document.getElementById('chart-modal');
    if (modal) modal.showModal();
    
    document.querySelectorAll('.chart-time-btn').forEach(b => b.classList.remove('active'));
    const defaultBtn = document.querySelector('.chart-time-btn[data-time="1W"]');
    if (defaultBtn) defaultBtn.classList.add('active');
    
    loadChartData(market, '1W');
}

async function loadChartData(market, timeFrame) {
    if (!market.conditionId) return;
    const canvas = document.getElementById('price-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (currentChart) currentChart.destroy();
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: { labels: ['Loading...'], datasets: [{ data: [0.5] }] },
        options: { plugins: { title: { display: true, text: 'Fetching price history...' } }, animation: false }
    });

    try {
        const eventRes = await fetch(`https://gamma-api.polymarket.com/events/${market.eventSlug}`);
        const eventData = await eventRes.json();
        let clobTokenId = "";
        if (eventData && eventData.markets) {
           const matchingMarket = eventData.markets.find(m => m.id === market.id);
           if (matchingMarket && matchingMarket.clobTokenIds) {
               clobTokenId = JSON.parse(matchingMarket.clobTokenIds || '[]')[0]; 
           }
        }
        if (!clobTokenId) throw new Error("No token ID");

        const intervalMap = { '1D': '1d', '1W': '1w', '1M': '1m', 'ALL': 'max' };
        const interval = intervalMap[timeFrame] || '1w';
        const priceRes = await fetch(`https://clob.polymarket.com/prices-history?interval=${interval}&market=${clobTokenId}&fidelity=60`);
        const priceData = await priceRes.json();
        
        if (!priceData.history || priceData.history.length === 0) throw new Error("No data");

        const labels = priceData.history.map(p => new Date(p.t * 1000).toLocaleString());
        const data = priceData.history.map(p => p.p * 100);
        const color = data[data.length - 1] >= data[0] ? '#10b981' : '#ef4444';

        currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: `Price (¢)`,
                    data,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '¢' } } }
            }
        });
    } catch (e) {
        console.error(e);
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: { labels: ['Error'], datasets: [{ data: [0.5] }] },
            options: { plugins: { title: { display: true, text: 'Chart data not available.' } } }
        });
    }
}

// ========== ALPHA ENGINE V2 ==========
let marketSnapshots = new Map();

function initAlphaEngine() {
    // Neural feel: update terminal faster than price loads
    setInterval(updateAlphaTerminal, 3000); 
}

function updateAlphaTerminal() {
    if (activeTab !== 'alpha' || allMarkets.length === 0) return;
    
    detectAlphaSignals();
    renderAlphaClusters();
    updateGlobalMetrics();
}

function detectAlphaSignals() {
    const whaleFeed = document.getElementById('whale-feed');
    const heatmapGrid = document.getElementById('alpha-signals');
    if (!whaleFeed || !heatmapGrid) return;

    allMarkets.forEach(m => {
        const prev = marketSnapshots.get(m.id);
        if (prev) {
            // 1. Whale Activity (> $1.5k change in 15-60s)
            const volDiff = m.volumeTotal - prev.volumeTotal;
            if (volDiff > 1500) addWhaleToFeed(m, volDiff);

            // 2. Accumulation Detection (Price down/flat, Volume UP)
            const priceDiff = m.yesPrice - prev.yesPrice;
            if (volDiff > 3000 && priceDiff <= 0) {
                addAccumulationSignal(m, volDiff);
            }
        }
        marketSnapshots.set(m.id, { ...m });
    });
}

function addWhaleToFeed(m, amount) {
    const feed = document.getElementById('whale-feed');
    const boot = feed.querySelector('.boot-msg');
    if (boot) boot.remove();

    const row = document.createElement('div');
    row.className = 'trade-row';
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isBuy = m.yesPrice > 0.4;

    row.innerHTML = `
        <span class="tr-time">[${time}]</span>
        <span class="tr-action ${isBuy ? 'buy' : 'sell'}">${isBuy ? 'IN' : 'OUT'}</span>
        <span class="tr-amount">$${formatCompact(amount)}</span>
        <span class="tr-market">${escapeHtml(m.question)}</span>
    `;

    feed.prepend(row);
    if (feed.children.length > 30) feed.lastChild.remove();
}

function addAccumulationSignal(m, volume) {
    const grid = document.getElementById('alpha-signals');
    const empty = grid.querySelector('.empty-state');
    if (empty) empty.remove();

    if (document.getElementById(`acc-${m.id}`)) return;

    const card = document.createElement('div');
    card.id = `acc-${m.id}`;
    card.className = 'heatmap-card';
    card.innerHTML = `
        <div style="color:var(--blue); font-size:0.6rem; font-weight:800; margin-bottom:4px">DETECTED_ACCUMULATION</div>
        <div style="font-size:0.8rem; font-weight:700; color:var(--text); line-height:1.2">${escapeHtml(m.question.substring(0, 60))}...</div>
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.7rem;">
            <span>PRESSURE: <span style="color:var(--green)">HIGH</span></span>
            <span>VOL: $${formatCompact(volume)}</span>
        </div>
    `;

    grid.prepend(card);
    if (grid.children.length > 8) grid.lastChild.remove();
}

function updateGlobalMetrics() {
    // Sentiment Calculation
    const avgPrice = allMarkets.reduce((s, m) => s + m.yesPrice, 0) / allMarkets.length;
    const sentiment = avgPrice * 100;
    
    const bar = document.getElementById('sentiment-bar');
    const val = document.getElementById('sentiment-value');
    const volIdx = document.getElementById('alpha-vol-index');

    if (bar && val) {
        bar.style.width = `${sentiment}%`;
        val.textContent = sentiment > 55 ? 'BULLISH_BIAS' : sentiment < 45 ? 'BEARISH_BIAS' : 'NEUTRAL_FLOW';
        val.style.color = sentiment > 55 ? 'var(--green)' : sentiment < 45 ? 'var(--red)' : 'var(--blue)';
    }

    if (volIdx) {
        const highVolCount = allMarkets.filter(m => m.volume24h > 100000).length;
        volIdx.textContent = highVolCount > 20 ? 'HIGH_MOMENTUM' : 'STABLE_FLOW';
    }
}

function renderAlphaClusters() {
    const container = document.getElementById('alpha-clusters');
    if (!container) return;

    const cats = ['politics', 'crypto', 'economy'];
    container.innerHTML = '';

    cats.forEach(cat => {
        const labs = allMarkets.filter(m => m.category === cat).slice(0, 3);
        if (labs.length === 0) return;

        const cluster = document.createElement('div');
        cluster.style.marginBottom = '16px';
        cluster.innerHTML = `
            <div class="panel-tag" style="background:transparent; padding:0; border:none; color:var(--blue)">${cat.toUpperCase()}_SECTOR</div>
            ${labs.map(m => `
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; padding:6px 0; border-bottom:1px solid #1a1e26;">
                    <span style="color:var(--text-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(m.question.substring(0, 40))}</span>
                    <span style="font-weight:800; color:${m.yesPrice > 0.5 ? 'var(--green)' : 'var(--text)'}">${(m.yesPrice*100).toFixed(0)}¢</span>
                </div>
            `).join('')}
        `;
        container.appendChild(cluster);
    });
}




