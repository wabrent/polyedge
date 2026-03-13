/**
 * POLYEDGE PRO Engine v2.2
 * Refined Sync & Geo-Aware Intelligence
 */

const CONFIG = {
    GAMMA_API: 'https://gamma-api.polymarket.com',
    DATA_API: 'https://data-api.polymarket.com',
    REFRESH_RATE: 60000, // 60s cycle
    USER_AGENT: 'PolyEdge/2 (graanit.eth)'
};

const UI = {
    markets: document.getElementById('markets'),
    geo: document.getElementById('geo-block'),
    search: document.getElementById('search'),
    category: document.getElementById('category'),
    sort: document.getElementById('sort'),
    limit: document.getElementById('limit')
};

// --- CORE BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initSync();
    attachListeners();
});

function attachListeners() {
    const debouncedLoad = debounce(() => loadMarkets(), 500);
    UI.search.addEventListener('input', debouncedLoad);
    [UI.category, UI.sort, UI.limit].forEach(el => {
        el.addEventListener('change', () => loadMarkets());
    });
}

function initSync() {
    loadCategories();
    loadMarkets();
    setInterval(loadMarkets, CONFIG.REFRESH_RATE);
}

// --- NETWORK OPS ---
async function fetchJson(url) {
    try {
        const res = await fetch(url, { 
            headers: { 'Accept': 'application/json' } 
        });
        
        if (!res.ok) {
            // Geo-restriction or Rate-limit Check (403/451/429)
            if ([403, 429, 451].includes(res.status)) {
                UI.geo.classList.remove('hidden');
            }
            throw new Error(`Shard node error ${res.status}`);
        }
        
        return await res.json();
    } catch (e) {
        console.warn(`Sync restricted: ${e.message}`);
        // If categories or markets fail, show geo notice as it's the most common cause in 2026
        UI.geo.classList.remove('hidden');
        return null;
    }
}

// --- DATA ACTIONS ---
async function loadCategories() {
    const cats = await fetchJson(`${CONFIG.GAMMA_API}/tags`);
    if (cats && UI.category) {
        cats.sort((a,b) => (b.followers || 0) - (a.followers || 0)).slice(0, 30).forEach(c => {
            if (c.id && c.name) {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                UI.category.appendChild(opt);
            }
        });
    }
}

async function loadMarkets() {
    UI.markets.innerHTML = `
        <div class="col-span-full text-center py-24">
            <i class="fas fa-spinner fa-spin text-5xl text-polymarket mb-4"></i>
            <p class="text-xs font-black uppercase tracking-[0.4em] text-gray-600">Syncing with Gamma Node...</p>
        </div>
    `;

    const params = new URLSearchParams({
        active: 'true',
        closed: 'false',
        limit: UI.limit.value || 15,
        order: UI.sort.value || 'volume',
        ascending: 'false'
    });
    
    if (UI.category.value) params.append('tag_id', UI.category.value);

    const markets = await fetchJson(`${CONFIG.GAMMA_API}/markets?${params}`);
    if (!markets) return;

    // Filter results based on search input
    const q = UI.search.value.toLowerCase().trim();
    const filtered = q ? markets.filter(m => m.question?.toLowerCase().includes(q)) : markets;

    UI.markets.innerHTML = '';
    
    if (filtered.length === 0) {
        UI.markets.innerHTML = '<p class="col-span-full text-center py-20 text-gray-600 italic">No intelligence found in current sector.</p>';
        return;
    }

    filtered.forEach((m, idx) => {
        let outcomesHtml = '';
        
        // Handle Outcome Probability Visualization
        if (m.outcomePrices && m.outcomePrices.length >= 2) {
            const yesProb = Math.round(parseFloat(m.outcomePrices[0]) * 100);
            const noProb = 100 - yesProb;
            
            outcomesHtml = `
                <div class="flex gap-6 mt-6">
                    <div class="flex-1">
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-[10px] font-black uppercase text-green-500 tracking-widest">Yes Side</span>
                            <span class="text-sm font-black text-white italic">${yesProb}%</span>
                        </div>
                        <div class="progress"><div class="bar bg-green-500" style="width:${yesProb}%"></div></div>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-[10px] font-black uppercase text-red-500 tracking-widest">No Side</span>
                            <span class="text-sm font-black text-white italic">${noProb}%</span>
                        </div>
                        <div class="progress"><div class="bar bg-red-500" style="width:${noProb}%"></div></div>
                    </div>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'card animate-fade-in group';
        card.style.animationDelay = `${idx * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="text-[9px] font-black text-polymarket bg-polymarket/10 px-2.5 py-1 rounded-lg italic tracking-widest uppercase">Protocol: Gamma</span>
                <i class="fas fa-chart-bar text-gray-800 group-hover:text-polymarket transition-colors"></i>
            </div>
            <h3 class="text-xl font-black italic mb-4 leading-snug group-hover:text-polymarket transition-colors line-clamp-2">
                ${m.question}
            </h3>
            <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5 pb-4 mb-2">
                <span>Vol: $${formatCompact(m.volume)}</span>
                <span class="text-right">Liq: $${formatCompact(m.liquidity)}</span>
            </div>
            ${outcomesHtml || '<div class="h-16 flex items-center justify-center text-[10px] text-gray-600 italic">Forensic data withheld</div>'}
            <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="mt-8 flex items-center justify-between w-full py-4 px-6 bg-gray-950/50 hover:bg-polymarket rounded-2xl transition-all group active:scale-95 border border-white/5 shadow-inner">
                <span class="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">Direct Trade</span>
                <i class="fas fa-external-link-alt text-[10px] text-polymarket group-hover:text-white group-hover:translate-x-1 transition-all"></i>
            </a>
        `;
        UI.markets.appendChild(card);
    });
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
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
