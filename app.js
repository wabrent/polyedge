/**
 * POLYEDGE PRO Engine v2.1
 * Logic Core with Advanced Sync & Forensic Intelligence
 */

const CONFIG = {
    GAMMA_API: 'https://gamma-api.polymarket.com',
    DATA_API: 'https://data-api.polymarket.com',
    REFRESH_RATE: 45000, // 45s cycle
    USER_AGENT: 'PolyEdgePro/2.1 (graanit.eth)'
};

const UI = {
    marketsGrid: document.getElementById('markets'),
    whalesGrid: document.getElementById('whales'),
    errorMsg: document.getElementById('error-msg'),
    search: document.getElementById('search'),
    category: document.getElementById('category'),
    sort: document.getElementById('sort'),
    limit: document.getElementById('limit'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadCategories();
    startSync();
    attachListeners();
});

function attachListeners() {
    const debouncedLoad = debounce(() => loadMarkets(), 400);
    UI.search.addEventListener('input', debouncedLoad);
    UI.category.addEventListener('change', loadMarkets);
    UI.sort.addEventListener('change', loadMarkets);
    UI.limit.addEventListener('change', loadMarkets);
}

function startSync() {
    loadMarkets();
    loadWhales();
    setInterval(() => {
        loadMarkets();
        loadWhales();
    }, CONFIG.REFRESH_RATE);
}

// --- THEME ---
function initTheme() {
    UI.themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        UI.themeIcon.className = isDark 
            ? 'fas fa-moon text-polymarket text-xl' 
            : 'fas fa-sun text-yellow-400 text-xl';
    });
}

// --- API ACTIONS ---
async function fetchWithHeaders(url) {
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response;
    } catch (e) {
        console.warn(`Fetch failure at ${url}:`, e);
        throw e;
    }
}

async function loadCategories() {
    try {
        const res = await fetch(`${CONFIG.GAMMA_API}/tags`);
        const tags = await res.json();
        tags.sort((a,b) => (b.followers || 0) - (a.followers || 0)).forEach(tag => {
            if (tag.name && tag.id) {
                const opt = document.createElement('option');
                opt.value = tag.id;
                opt.textContent = tag.name;
                UI.category.appendChild(opt);
            }
        });
    } catch (e) { console.warn("Category sync failed."); }
}

async function loadMarkets() {
    UI.marketsGrid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <i class="fas fa-spinner fa-spin text-4xl text-polymarket mb-4"></i>
            <p class="text-xs font-black uppercase text-gray-500 tracking-widest">Synchronizing Shards...</p>
        </div>
    `;
    UI.errorMsg.classList.add('hidden');

    try {
        let url = `${CONFIG.GAMMA_API}/markets?active=true&closed=false&limit=${UI.limit.value || 20}&order=${UI.sort.value || 'volume'}&ascending=false`;
        if (UI.category.value) url += `&tag_id=${UI.category.value}`;

        const res = await fetchWithHeaders(url);
        let markets = await res.json();

        // Search Filter (Client-side)
        const q = UI.search.value.toLowerCase().trim();
        if (q) markets = markets.filter(m => m.question?.toLowerCase().includes(q));

        UI.marketsGrid.innerHTML = '';
        if (markets.length === 0) {
            UI.marketsGrid.innerHTML = '<p class="col-span-full text-center py-20 text-gray-500 italic">No markets detected in this shard.</p>';
            return;
        }

        markets.forEach((m, idx) => {
            let outcomesHtml = '';
            
            // Handle outcome visualization
            if (m.outcomePrices && m.outcomePrices.length >= 2) {
                const colors = ['bg-green-500', 'bg-red-500', 'bg-polymarket', 'bg-blue-500'];
                
                m.outcomes.forEach((name, i) => {
                    const prob = (parseFloat(m.outcomePrices[i]) * 100).toFixed(0);
                    const color = colors[i] || 'bg-gray-500';
                    outcomesHtml += `
                        <div class="mb-4">
                            <div class="flex justify-between text-[10px] font-black uppercase mb-1">
                                <span class="text-gray-400">${name}</span>
                                <span class="text-white">${prob}%</span>
                            </div>
                            <div class="progress-container">
                                <div class="progress-bar ${color}" style="width: ${prob}%"></div>
                            </div>
                        </div>
                    `;
                });
            } else {
                outcomesHtml = '<p class="text-xs text-gray-600 italic py-4">Forensic data restricted</p>';
            }

            const card = document.createElement('div');
            card.className = 'card p-6 animate-fade-in group';
            card.style.animationDelay = `${idx * 0.05}s`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[9px] font-black text-polymarket bg-polymarket/10 px-2 py-0.5 rounded italic">SHARD: ${m.category || 'SEC'}</span>
                    <i class="fas fa-ellipsis-h text-gray-700"></i>
                </div>
                <h3 class="text-xl font-bold line-clamp-2 mb-6 italic leading-snug group-hover:text-polymarket-light transition-colors">
                    ${m.question || 'Market Intelligence'}
                </h3>
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6 border-b border-white/5 pb-4">
                    <span>Vol $${formatCompact(m.volume)}</span>
                    <span class="text-right">Liq $${formatCompact(m.liquidity)}</span>
                </div>
                <div class="space-y-1">
                    ${outcomesHtml}
                </div>
                <a href="https://polymarket.com/event/${m.slug}" target="_blank" class="mt-8 flex items-center justify-between w-full py-4 px-5 bg-gray-800/40 hover:bg-polymarket rounded-2xl transition-all active:scale-95 group">
                    <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Trade Protocol</span>
                    <i class="fas fa-arrow-right text-polymarket group-hover:translate-x-1 group-hover:text-white transition-all"></i>
                </a>
            `;
            UI.marketsGrid.appendChild(card);
        });
    } catch (err) {
        UI.marketsGrid.innerHTML = '';
        UI.errorMsg.classList.remove('hidden');
    }
}

async function loadWhales() {
    UI.whalesGrid.innerHTML = '<div class="col-span-full py-12 text-center animate-pulse"><i class="fas fa-spinner fa-spin text-polymarket"></i></div>';
    try {
        const res = await fetchWithHeaders(`${CONFIG.DATA_API}/leaderboard?limit=3&order=profit&ascending=false`);
        const data = await res.json();
        UI.whalesGrid.innerHTML = '';
        data.forEach((w, i) => {
            const card = document.createElement('div');
            card.className = 'card p-8 hover:bg-polymarket/5 transition-all duration-500';
            card.style.animationDelay = `${i * 0.1}s`;
            card.innerHTML = `
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-polymarket to-indigo-900 flex items-center justify-center shadow-xl">
                        <i class="fas fa-whale text-white text-2xl"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-black italic uppercase tracking-tight truncate text-lg">${w.user || w.address?.slice(0,8)+'...'}</div>
                        <div class="text-[10px] text-gray-500 font-mono">${w.address?.slice(0,10)}...</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-black/30 p-4 rounded-2xl border border-white/5">
                        <p class="text-[9px] font-black text-gray-500 uppercase mb-1">Session PnL</p>
                        <div class="text-green-400 text-xl font-black italic">+$${formatCompact(w.profit)}</div>
                    </div>
                    <div class="bg-black/30 p-4 rounded-2xl border border-white/5 text-right">
                        <p class="text-[9px] font-black text-gray-500 uppercase mb-1">Execution</p>
                        <div class="text-white text-xl font-black italic">${w.trades || '?'}</div>
                    </div>
                </div>
            `;
            UI.whalesGrid.appendChild(card);
        });
    } catch {
        UI.whalesGrid.innerHTML = '<p class="col-span-full text-center py-20 text-gray-600 italic">Whale forensics node restricted (Geo/Rate Limit)</p>';
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
