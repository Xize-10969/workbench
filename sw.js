```javascript
/**
 * 姜宁的工作台 - Service Worker v3
 * 策略：网络优先，缓存兜底（确保总是拿到最新版本）
 */

const CACHE_NAME = 'workbench-v3';

// 安装时跳过等待，立即激活
self.addEventListener('install', e => {
  self.skipWaiting();
});

// 激活时清除所有旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 网络优先策略：先从网络获取，失败时才用缓存
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // 成功从网络获取，复制一份到缓存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, clone);
        });
        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存读取
        return caches.match(e.request);
      })
  );
});
```
