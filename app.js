/**
 * PolyEdge Pro Hub Engine v2.0
 * Gamma + CLOB + Data API Integration
 */

const CONFIG = {
    GAMMA_API: 'https://gamma-api.polymarket.com',
    CLOB_API: 'https://clob.polymarket.com',
    DATA_API: 'https://data-api.polymarket.com',
    REFRESH_RATE: 30000 // 30s
};

const UI = {
    container: document.getElementById('markets-container'),
    whales: document.getElementById('whales-container'),
    category: document.getElementById('category-filter'),
    search: document.getElementById('search-input'),
    sortBy: document.getElementById('sort-by'),
    limit: document.getElementById('limit'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon')
};

let state = {
    tags: [],
    loading: false
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadTags();
    refreshLoop();
    attachListeners();
});

function attachListeners() {
    [UI.category, UI.sortBy, UI.limit].forEach(el => el.addEventListener('change', fetchMarkets));
    UI.search.addEventListener('input', debounce(fetchMarkets, 500));
}

function refreshLoop() {
    fetchMarkets();
    fetchWhales();
    setInterval(() => {
        fetchMarkets();
        fetchWhales();
    }, CONFIG.REFRESH_RATE);
}

// --- THEME LOGIC ---
function initTheme() {
    UI.themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        UI.themeIcon.className = next === 'dark' ? 'fas fa-moon text-polymarket text-xl' : 'fas fa-sun text-polymarket text-xl';
    };
}

// --- DATA FETCHING ---
async function loadTags() {
    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/tags`);
        const tags = await res.json();
        tags.sort((a, b) => b.followers - a.followers).slice(0, 30).forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag.id;
            opt.textContent = tag.name;
            UI.category.appendChild(opt);
        });
    } catch (err) { console.error('Tags logic failure:', err); }
}

async function fetchMarkets() {
    if (state.loading) return;
    state.loading = true;
    
    UI.container.innerHTML = `
        <div class="col-span-full py-20 text-center">
            <i class="fas fa-spinner fa-spin text-4xl text-polymarket mb-4"></i>
            <p class="text-gray-500 font-bold uppercase tracking-widest text-xs">Syncing with Gamma Shard...</p>
        </div>
    `;

    try {
        const limit = UI.limit.value || 15;
        const tagId = UI.category.value ? `&tag_id=${UI.category.value}` : '';
        const order = UI.sortBy.value || 'volume';
        const url = `${CONFIG.GAMMA_API}/markets?active=true&closed=false&limit=${limit}&order=${order}&ascending=false${tagId}`;
        
        const res = await fetch(url);
        let markets = await res.json();

        // Search Filter (Client-side)
        const q = UI.search.value.toLowerCase();
        if (q) markets = markets.filter(m => m.question.toLowerCase().includes(q));

        UI.container.innerHTML = '';
        
        for (const [index, m] of markets.entries()) {
            let outcomesHtml = '';
            
            // Build Outcome Bars with CLOB Real-time Prices
            if (m.clobTokenIds && m.clobTokenIds.length) {
                try {
                    const priceRes = await fetch(`${CONFIG.CLOB_API}/prices?token_id=${m.clobTokenIds.join('&token_id=')}`);
                    const prices = await priceRes.json();
                    
                    m.outcomes.forEach((outcome, i) => {
                        const tokenId = m.clobTokenIds[i];
                        const price = prices[tokenId] ? (parseFloat(prices[tokenId].midpoint) * 100).toFixed(1) : '50.0';
                        const color = i === 0 ? 'bg-yes' : 'bg-no';
                        
                        outcomesHtml += `
                            <div class="mb-4">
                                <div class="flex justify-between text-xs font-black uppercase mb-1">
                                    <span class="text-gray-400">${outcome}</span>
                                    <span class="${i === 0 ? 'text-yes' : 'text-no'}">${price}%</span>
                                </div>
                                <div class="outcome-bar-container">
                                    <div class="outcome-bar ${color}" style="width: ${price}%"></div>
                                </div>
                            </div>
                        `;
                    });
                } catch (e) { outcomesHtml = '<p class="text-xs text-gray-600 italic">Pricing node unreachable</p>'; }
            } else {
                outcomesHtml = '<p class="text-xs text-gray-600 italic">No CLOB data available</p>';
            }

            const card = document.createElement('div');
            card.className = 'card animate-fade-in';
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-[9px] font-black text-polymarket bg-polymarket/10 px-2 py-0.5 rounded italic">LIVE</span>
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">${m.category || 'Event'}</span>
                </div>
                <h3 class="text-lg font-bold mb-4 line-clamp-2 leading-tight italic">
                    ${m.question}
                </h3>
                <div class="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
                    <div class="text-left">
                        <p class="text-[8px] font-black text-gray-500 uppercase mb-0.5">Volume</p>
                        <p class="text-sm font-black text-white">$${formatCompact(m.volume)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] font-black text-gray-500 uppercase mb-0.5">Liquidity</p>
                        <p class="text-sm font-black text-white">$${formatCompact(m.liquidity)}</p>
                    </div>
                </div>
                <div class="space-y-1">
                    ${outcomesHtml}
                </div>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="mt-6 flex items-center justify-between w-full py-3 px-4 bg-gray-800/50 hover:bg-polymarket rounded-xl transition-all group">
                    <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Analyze on Terminal</span>
                    <i class="fas fa-arrow-right text-[10px] text-polymarket group-hover:text-white"></i>
                </a>
            `;
            UI.container.appendChild(card);
        }
    } catch (err) {
        UI.container.innerHTML = `<div class="col-span-full p-10 bg-red-500/10 rounded-3xl border border-red-500/20 text-center text-red-400 font-bold italic">Critical Sync Error: ${err.message}</div>`;
    } finally {
        state.loading = false;
    }
}

async function fetchWhales() {
    UI.whales.innerHTML = `<div class="col-span-full py-10 text-center animate-pulse"><p class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Scanning whale movement...</p></div>`;
    
    try {
        const res = await fetch(`${CONFIG.DATA_API}/leaderboard?limit=3&order=profit&ascending=false`);
        const whales = await res.json();
        UI.whales.innerHTML = '';
        
        whales.forEach((w, i) => {
            const card = document.createElement('div');
            card.className = 'card animate-fade-in group hover:bg-polymarket/5';
            card.style.animationDelay = `${i * 0.1}s`;
            card.innerHTML = `
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-polymarket to-indigo-600 flex items-center justify-center font-black text-white italic text-xl shadow-lg">
                        ${(w.user || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="text-sm font-black uppercase tracking-tight truncate max-w-[150px]">${w.user || 'Anon Whale'}</h3>
                        <p class="text-[9px] font-bold text-gray-500 font-mono">${w.address.slice(0, 6)}...${w.address.slice(-4)}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p class="text-[8px] font-black text-gray-500 uppercase mb-1">Total Profit</p>
                        <p class="text-lg font-black text-yes">+$${formatCompact(w.profit)}</p>
                    </div>
                    <div class="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p class="text-[8px] font-black text-gray-500 uppercase mb-1">Trades</p>
                        <p class="text-lg font-black text-white">${w.trades}</p>
                    </div>
                </div>
                <a href="https://polymarket.com/profile/${w.address}" target="_blank" class="block text-center py-2 text-[10px] font-black uppercase tracking-widest text-polymarket hover:text-white transition-colors">
                    View Forensic Profile →
                </a>
            `;
            UI.whales.appendChild(card);
        });
    } catch (err) {
        UI.whales.innerHTML = `<p class="col-span-full text-center text-gray-600 italic">Whale data currently unavailable</p>`;
    }
}

// --- UTILS ---
function formatCompact(val) {
    if (!val) return '0';
    const n = parseFloat(val);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return n.toFixed(0);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
