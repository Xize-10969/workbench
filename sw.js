```javascript
/**
 * 姜宁的工作台 - Service Worker
 * 实现离线缓存，断网也能正常打开 App
 */

const CACHE_NAME = 'workbench-v2';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// 安装时缓存所有文件
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// 拦截请求，优先用缓存
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});

// 更新缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});
```

