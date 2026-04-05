/*
 * Service Worker - UI-3.9 PWA 离线缓存
 * 
 * 缓存策略:
 * 1. 静态资源 (HTML/CSS/JS/图片) - Cache First
 * 2. API 数据 - Network First + Cache Fallback
 * 3. 图表数据 - Stale While Revalidate
 */

const CACHE_NAME = 'dragon-cockpit-v1';
const STATIC_CACHE = 'dragon-static-v1';
const API_CACHE = 'dragon-api-v1';
const CHART_CACHE = 'dragon-charts-v1';

// 静态资源缓存列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/history',
  '/reports',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// API 端点缓存
const API_ENDPOINTS = [
  '/api/stats',
  '/api/health',
  '/api/capital',
  '/api/position',
  '/api/history/alerts',
  '/api/history/control',
  '/api/history/decisions',
  '/api/reports/alerts',
  '/api/reports/decisions',
  '/api/reports/control'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete, skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache install failed:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // 删除旧版本缓存
              return cacheName !== STATIC_CACHE && 
                     cacheName !== API_CACHE && 
                     cacheName !== CHART_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete, claiming clients');
        return self.clients.claim();
      })
  );
});

// 获取事件 - 根据请求类型使用不同策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API 请求 - Network First + Cache Fallback
  if (request.url.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // 图表数据 - Stale While Revalidate
  if (request.url.includes('/api/history/') || 
      request.url.includes('/api/reports/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 静态资源 - Cache First
  event.respondWith(cacheFirstStrategy(request));
});

// Cache First 策略
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('[SW] Cache hit:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First 策略
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // 返回缓存的离线数据
    return new Response(JSON.stringify({
      error: 'offline',
      message: '当前离线，显示缓存数据',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CHART_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[SW] Background fetch failed:', error);
      return null;
    });
  
  // 返回缓存响应，同时后台更新
  return cachedResponse || fetchPromise;
}

// 后台同步 - 网络恢复后更新数据
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  if (event.tag === 'update-data') {
    event.waitUntil(updateData());
  }
});

async function updateData() {
  console.log('[SW] Updating data in background');
  const apiEndpoints = [
    '/api/stats',
    '/api/health',
    '/api/capital',
    '/api/position'
  ];
  
  const cache = await caches.open(API_CACHE);
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        cache.put(endpoint, response.clone());
        console.log('[SW] Updated:', endpoint);
      }
    } catch (error) {
      console.error('[SW] Failed to update:', endpoint, error);
    }
  }
}

// 消息处理
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
});

console.log('[SW] Service Worker loaded');
