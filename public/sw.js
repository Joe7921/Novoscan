// Novoscan Service Worker — Network First 策略
// 确保 AI 分析、SSE 流等动态内容始终实时获取
// 报告页面 (/report/*) 自动缓存，离线可查看历史报告

const CACHE_NAME = 'novoscan-v1';
const REPORT_CACHE = 'novoscan-reports-v1';
const MAX_REPORT_CACHE = 50; // 最多缓存 50 份报告

// 预缓存的基础外壳资源
const PRECACHE_URLS = [
  '/',
  '/icon.svg',
];

// 安装阶段：预缓存基础外壳
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // 立即激活，不等待旧 SW 退出
  );
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', (event) => {
  const VALID_CACHES = [CACHE_NAME, REPORT_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !VALID_CACHES.includes(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // 立即控制所有页面
  );
});

// 限制缓存条目数量，超出时删除最早的
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems); // 递归直到满足限制
  }
}

// 请求拦截 — Network First 策略
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 跳过非 GET 请求（POST / SSE 等应直接穿透）
  if (request.method !== 'GET') return;

  // 跳过 Chrome 扩展等非 http(s) 请求
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // 跳过 API 路由（包括 followup SSE 流）— 必须实时获取
  if (url.pathname.startsWith('/api/')) return;

  // 判断是否为报告页面
  const isReport = url.pathname.startsWith('/report/');

  // 报告页和普通页使用不同缓存分区
  const targetCache = isReport ? REPORT_CACHE : CACHE_NAME;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(targetCache).then((cache) => {
            cache.put(request, clone);
            // 报告缓存达到上限时，自动淘汰最早的
            if (isReport) trimCache(REPORT_CACHE, MAX_REPORT_CACHE);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败：从缓存中查找降级响应
        return caches.match(request);
      })
  );
});

