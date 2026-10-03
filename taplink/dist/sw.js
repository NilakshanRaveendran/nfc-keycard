const CACHE='taplink-shell-v2';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'].map(path=>new URL(path,self.registration.scope).href);
const INDEX=new URL('./index.html',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const href of ASSETS){const request=new Request(href,{cache:'reload'});const response=await fetch(request);if(!response.ok || response.redirected)throw new Error('App shell unavailable');await cache.put(request,response);}})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('taplink-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Network first, so a deploy never leaves new HTML running against stale cached scripts. The cache is the offline fallback.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
const asset=ASSETS.includes(url.href);
if(!asset&&event.request.mode!=='navigate')return;
event.respondWith(fetch(event.request).then(response=>{if(asset&&response.ok&&!response.redirected){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.href,copy)));}return response;}).catch(()=>caches.match(asset?url.href:INDEX).then(cached=>cached||Response.error())));
});
