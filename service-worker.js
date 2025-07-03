const CACHE_NAME = 'finance-app-cache';
const urlsToCache = [
  '/', 
  '/index.html', 
  '/css/style.css', 
  '/js/app.js', 
  '/assets/icons/icon-192x192.png', 
  '/assets/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data.body = err.message;
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body
    })
  );
});