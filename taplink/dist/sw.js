const CACHE='taplink-shell-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const path of ASSETS){const request=new Request(new URL(path,self.registration.scope),{cache:'reload'});const response=await fetch(request);if(!response.ok || response.redirected)throw new Error('App shell unavailable');await cache.put(request,response);}})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('taplink-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));return;}
if(ASSETS.some(path=>new URL(path,self.registration.scope).href===url.href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
