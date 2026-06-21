var CACHE = 'quiniela2026-v4';
var ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg'
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
  var url=e.request.url;

  /* Solo manejar peticiones GET */
  if(e.request.method!=='GET') return;

  /* Dejar pasar sin interceptar: APIs externas, ESPN, football-data, CDNs de fuentes/íconos */
  if(url.includes('espn.com')||url.includes('football-data')||
     url.includes('googleapis.com')||url.includes('jsdelivr.net')||
     url.includes('golpredictor')||url.includes('workers.dev')||
     url.includes('gstatic.com')){
    return;
  }

  /* Solo cachear recursos del mismo origen (archivos propios de la app) */
  if(!url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(function(cached){
      return cached || fetch(e.request).then(function(resp){
        if(resp&&resp.status===200){
          var clone=resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request,clone); });
        }
        return resp;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});
