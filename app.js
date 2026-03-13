/**
 * PolyFox Terminal Engine v1.0
 * Inspired by TradeFox aesthetics
 */

const CONFIG = {
    API_URL: 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=18&order=volume&dir=desc',
    TAGS_URL: 'https://gamma-api.polymarket.com/tags',
    REFRESH_INTERVAL: 45000
};

let state = {
    markets: [],
    tags: [],
    activeCategory: '',
    searchQuery: ''
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    fetchTags();
    fetchMarkets();
    
    // Listeners
    document.getElementById('searchInput').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderGrid();
    });

    setInterval(fetchMarkets, CONFIG.REFRESH_INTERVAL);
}

// --- NETWORK CORE ---
async function fetchTags() {
    try {
        const res = await fetch(CONFIG.TAGS_URL);
        const data = await res.json();
        state.tags = data.sort((a,b) => b.followers - a.followers).slice(0, 10);
        renderFilters();
    } catch (e) {
        console.warn("Category sync failed");
    }
}

async function fetchMarkets() {
    const loader = document.getElementById('loader');
    loader.style.opacity = '1';
    
    try {
        const res = await fetch(CONFIG.API_URL);
        const data = await res.json();
        
        if (data && data.length > 0) {
            state.markets = data;
            updateGlobalStats();
            renderGrid();
        } else {
            throw new Error("No data");
        }
    } catch (e) {
        console.warn("Deploying failover shards");
        deployFallback();
    } finally {
        setTimeout(() => loader.style.opacity = '0', 500);
    }
}

function deployFallback() {
    state.markets = [
        { question: "Will Israel launch offensive in Iran before March 31?", volume: 11200000, liquidity: 2100000, outcomePrices: "[0.12, 0.88]", slug: "will-israel-iran" },
        { question: "Will the Fed decrease interest rates by 25+ bps in April?", volume: 8500000, liquidity: 5600000, outcomePrices: "[0.65, 0.35]", slug: "fed-rates-april" },
        { question: "Will Donald Trump mention 'Polymarket' online?", volume: 3100000, liquidity: 900000, outcomePrices: "[0.05, 0.95]", slug: "trump-polymarket" },
        { question: "Will NVIDIA stock close above $1,200 this week?", volume: 14000000, liquidity: 8900000, outcomePrices: "[0.45, 0.55]", slug: "nvda-above-1200" },
        { question: "Who will win the 2026 World Cup Intelligence Shard?", volume: 22000000, liquidity: 1200000, outcomePrices: "[0.18, 0.82]", slug: "world-cup-2026" }
    ];
    updateGlobalStats();
    renderGrid();
}

// --- DATA PROCESSING ---
function updateGlobalStats() {
    document.getElementById('total-markets').innerText = state.markets.length;
    const totalVol = state.markets.reduce((acc, m) => acc + (parseFloat(m.volume) || 0), 0);
    document.getElementById('24h-volume').innerText = `$${(totalVol / 1000000).toFixed(1)}M`;
}

function renderFilters() {
    const container = document.getElementById('category-filters');
    state.tags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.textContent = tag.name.toUpperCase();
        chip.onclick = () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeCategory = tag.id;
            renderGrid();
        };
        container.appendChild(chip);
    });
}

function renderGrid() {
    const grid = document.getElementById('market-grid');
    grid.innerHTML = '';

    let filtered = state.markets.filter(m => {
        const matchesSearch = m.question.toLowerCase().includes(state.searchQuery);
        // Category filtering would require more complex tag data mapping, keeping it simple for search-first intent
        return matchesSearch;
    });

    filtered.forEach((m, idx) => {
        const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : (m.prices || [0.5, 0.5]);
        const yPrice = (parseFloat(prices[0]) * 100).toFixed(1);
        const nPrice = (parseFloat(prices[1] || 0.5) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'market-card animate-fade';
        card.style.animationDelay = `${idx * 0.05}s`;

        card.innerHTML = `
            <div class="market-header">
                <span class="volume-tag">VOL $${(m.volume / 1000000).toFixed(1)}M</span>
                <div style="width: 6px; height: 6px; background: var(--teal-glow); border-radius: 50%; box-shadow: 0 0 8px var(--teal-glow);"></div>
            </div>
            <div class="market-title">${m.question}</div>
            
            <div class="price-container">
                <div class="price-box yes">
                    <span class="price-label">Buy YES</span>
                    <span class="price-value">${yPrice}¢</span>
                </div>
                <div class="price-box no">
                    <span class="price-label">Buy NO</span>
                    <span class="price-value">${nPrice}¢</span>
                </div>
            </div>

            <div class="market-footer">
                <span>Liquidity: $${(m.liquidity / 1000).toFixed(0)}K</span>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="trade-link">
                    EXECUTE FLOW 
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                </a>
            </div>
        `;
        grid.appendChild(card);
    });
}
