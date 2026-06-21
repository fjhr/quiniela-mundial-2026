var CACHE = 'quiniela2026-v2';
var ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  /* Peticiones al proxy de GolPredictor → siempre red (datos en vivo) */
  if(e.request.url.includes('workers.dev')||e.request.url.includes('golpredictor')){
    e.respondWith(fetch(e.request).catch(function(){
      return new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});
    }));
    return;
  }
  /* App shell → cache first, red como fallback */
  e.respondWith(
    caches.match(e.request).then(function(cached){
      return cached || fetch(e.request).then(function(resp){
        if(resp&&resp.status===200&&e.request.method==='GET'){
          var clone=resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request,clone); });
        }
        return resp;
      });
    })
  );
});
