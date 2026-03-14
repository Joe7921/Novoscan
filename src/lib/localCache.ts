const CACHE_KEY = 'novoscan_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 20;

/** 清理所有过期缓存条目，减少 localStorage 体积 */
export function clearExpiredCache() {
    if (typeof window === 'undefined') return;
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const now = Date.now();
        let changed = false;
        for (const key of Object.keys(cache)) {
            if (now - cache[key].timestamp >= CACHE_TTL) {
                delete cache[key];
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        }
    } catch (e) {
        console.error('Local cache cleanup error', e);
    }
}

export function getCachedResult(query: string) {
    if (typeof window === 'undefined') return null;
    const normalizedQuery = query.toLowerCase().trim();
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const item = cache[normalizedQuery];
        if (item && Date.now() - item.timestamp < CACHE_TTL) {
            return item.data;
        }
    } catch (e) {
        console.error('Local cache read error', e);
    }
    return null;
}

export function setCachedResult(query: string, data: any) {
    if (typeof window === 'undefined') return;
    const normalizedQuery = query.toLowerCase().trim();
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        // 写入前清理过期条目
        const now = Date.now();
        for (const key of Object.keys(cache)) {
            if (now - cache[key].timestamp >= CACHE_TTL) {
                delete cache[key];
            }
        }
        cache[normalizedQuery] = { data, timestamp: now };
        // 只保留最近 N 条
        const entries = Object.entries(cache).slice(-MAX_ENTRIES);
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (e: any) {
        // QuotaExceededError 防护：清空缓存后重试一次
        if (e?.name === 'QuotaExceededError') {
            try {
                localStorage.removeItem(CACHE_KEY);
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    [normalizedQuery]: { data, timestamp: Date.now() }
                }));
            } catch (_) { /* 放弃缓存 */ }
        } else {
            console.error('Local cache write error', e);
        }
    }
}
