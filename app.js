/**
 * PolyEdge - Polymarket Intelligence Engine
 * Integrates with Polymarket Gamma Protocol
 */

const CONFIG = {
    GAMMA_API: "https://gamma-api.polymarket.com",
    REFRESH_INTERVAL: 60000 // 1 minute
};

let state = {
    markets: [],
    currentFilter: 'all'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchMarkets();
    initSearch();
    
    // Auto refresh
    setInterval(fetchMarkets, CONFIG.REFRESH_INTERVAL);
});

// --- API ACTIONS ---
async function fetchMarkets(category = '') {
    const grid = document.getElementById('marketGrid');
    
    try {
        let url = `${CONFIG.GAMMA_API}/markets?active=true&closed=false&order=volume&dir=desc&limit=24`;
        if (category) url += `&tag=${category}`;

        const res = await fetch(url);
        const data = await res.json();
        
        state.markets = data;
        renderMarkets(data);
    } catch (error) {
        console.error("API Failure:", error);
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--pm-red); font-weight: 600;">Node Synchronization Failed. Retrying...</div>`;
    }
}

// --- RENDERING ---
function renderMarkets(markets) {
    const grid = document.getElementById('marketGrid');
    if (!markets.length) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--pm-text-secondary);">No markets found matching criteria.</p>`;
        return;
    }

    grid.innerHTML = markets.map((m, i) => {
        // Parse prices (Gamma API returns outcomePrices as a string representation of array)
        let prices = [0, 0];
        try {
            prices = JSON.parse(m.outcomePrices);
        } catch (e) {
            prices = [0, 0];
        }

        const yesPrice = (parseFloat(prices[0] || 0) * 100).toFixed(1);
        const noPrice = (parseFloat(prices[1] || 0) * 100).toFixed(1);
        const volume = formatCurrency(m.volume || 0);

        return `
            <div class="market-card animate-in" style="animation-delay: ${i * 0.03}s" onclick="openMarketDetails('${m.id}')">
                <p class="volume-tag">Vol: ${volume}</p>
                <h3 class="title">${m.question}</h3>
                <div class="market-footer">
                    <div class="price-pills">
                        <div class="price-pill pill-yes">Yes ${yesPrice}¢</div>
                        <div class="price-pill pill-no">No ${noPrice}¢</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pm-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>
        `;
    }).join('');
}

// --- INTERACTION ---
function initSearch() {
    const searchInput = document.getElementById('marketSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.markets.filter(m => 
                m.question.toLowerCase().includes(term) || 
                (m.description && m.description.toLowerCase().includes(term))
            );
            renderMarkets(filtered);
        });
    }
}

function loadMarkets(category) {
    // UI Feedback
    const grid = document.getElementById('marketGrid');
    grid.innerHTML = `
        <div class="market-card"><div class="skeleton" style="height: 24px; width: 80%; margin-bottom: 16px;"></div><div class="skeleton" style="height: 16px; width: 40%;"></div></div>
        <div class="market-card"><div class="skeleton" style="height: 24px; width: 70%; margin-bottom: 16px;"></div><div class="skeleton" style="height: 16px; width: 30%;"></div></div>
    `;
    fetchMarkets(category);
}

function openMarketDetails(id) {
    const market = state.markets.find(m => m.id === id);
    if (!market) return;

    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <h2 style="font-size: 24px; margin-bottom: 16px; font-weight: 800;">${market.question}</h2>
        <div style="background: var(--pm-panel); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
            <p style="color: var(--pm-text-secondary); font-size: 14px; margin-bottom: 12px;">Market Liquidity & Volume</p>
            <div style="display: flex; gap: 40px;">
                <div>
                    <p style="font-size: 11px; text-transform: uppercase; color: var(--pm-text-secondary);">Total Volume</p>
                    <p style="font-size: 20px; font-weight: 700;">${formatCurrency(market.volume)}</p>
                </div>
                <div>
                    <p style="font-size: 11px; text-transform: uppercase; color: var(--pm-text-secondary);">Liquidity</p>
                    <p style="font-size: 20px; font-weight: 700;">${formatCurrency(market.liquidity)}</p>
                </div>
            </div>
        </div>
        <p style="color: var(--pm-text-main); font-size: 15px; margin-bottom: 32px;">${market.description || 'No additional details available for this event.'}</p>
        <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 16px;" onclick="window.open('https://polymarket.com/market/${market.slug}', '_blank')">Trade on Polymarket</button>
    `;
    
    overlay.style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

// --- UTILS ---
function formatCurrency(val) {
    if (!val) return "$0";
    const num = parseFloat(val);
    if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return "$" + (num / 1000).toFixed(1) + "k";
    return "$" + num.toFixed(0);
}
