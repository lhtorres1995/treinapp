// Service worker do LT360 — só cuida do "app shell" (HTML/JS/CSS/ícones).
// Propositalmente NÃO cacheia nada do Supabase: todo o cuidado que foi posto
// em garantir que o app sempre reflita o estado real do servidor (ver
// salvarEstado() em main.js) seria anulado se dados ficassem presos em cache.
// Estratégia: network-first para tudo que é da própria origem (sempre busca
// a versão mais nova quando online); cache só como fallback para funcionar
// minimamente offline (abre o app, sem dados atualizados).

var CACHE_NAME = "lt360-shell-v1";
var SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(nomes){
      return Promise.all(
        nomes.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  var req = event.request;

  // Nunca interceptar nada fora da própria origem (Supabase, fontes, etc.)
  // nem requisições que não sejam GET.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin){
    return;
  }

  event.respondWith(
    fetch(req).then(function(resp){
      var copia = resp.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copia); });
      return resp;
    }).catch(function(){
      return caches.match(req).then(function(cached){
        if (cached) return cached;
        if (req.mode === "navigate") return caches.match("/");
        return Promise.reject("offline e sem cache para " + req.url);
      });
    })
  );
});

/* ---------------- Push (notificações) ---------------------------------- */
self.addEventListener("push", function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch(_){ data = { title: "LT360", body: e.data ? e.data.text() : "" }; }
  var opts = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" }
  };
  e.waitUntil(self.registration.showNotification(data.title || "LT360", opts));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(wins){
      for (var i=0;i<wins.length;i++){
        var w = wins[i];
        if (w.url.indexOf(self.location.origin) === 0 && "focus" in w){ w.focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
