// Generated as one immutable release. No save data is stored in this cache.
const BUILD=__BUILD_ID__;
const FILES=__PRECACHE__;
const BASE=new URL('./',self.location.href);
const PREFIX='qinghe-offline:'+BASE.pathname+':';
const CACHE=PREFIX+BUILD;
const urls=FILES.map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{const cache=await caches.open(CACHE);await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));}
 catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 const pathname=url.pathname===BASE.pathname?new URL('index.html',BASE).pathname:url.pathname;
 const key=new URL(pathname,BASE.origin).href;
 if(!urls.includes(key))return;
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(key);
  if(cached)return cached;
  const response=await fetch(req);
  if(response.ok)await (await caches.open(CACHE)).put(key,response.clone());
  return response;
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE'&&event.source?.url?.startsWith(BASE.href))event.waitUntil(self.skipWaiting());
 if(event.data?.type==='REPAIR_CACHE'&&event.source?.url?.startsWith(BASE.href)&&event.ports?.[0])event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);const missing=[];for(const url of urls)if(!await cache.match(url))missing.push(new Request(url,{cache:'reload'}));await cache.addAll(missing);event.ports[0].postMessage({ok:true});}
  catch{event.ports[0].postMessage({ok:false});}
 })());
 if(event.data?.type==='OFFLINE_STATUS'&&event.ports?.[0])event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),matches=await Promise.all(urls.map(url=>cache.match(url)));
  event.ports[0].postMessage({build:BUILD,ready:matches.every(Boolean),files:urls.length});
 })());
});
