"use strict";
const CACHE_NAME="property-production-intelligence-poc-v1-cache-9a6e8e0";
const APP_ASSETS=["./","./index.html","./styles.css","./production-engine-core.js","./app.js","./manifest.webmanifest","./DEPLOYMENT_IDENTITY.json"];
self.addEventListener("install",(event)=>{event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.addAll(APP_ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",(event)=>{event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key.startsWith("property-production-intelligence-poc-v1-cache-")&&key!==CACHE_NAME).map((key)=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",(event)=>{if(event.request.method!=="GET")return;const requestUrl=new URL(event.request.url);if(requestUrl.origin!==self.location.origin||!requestUrl.pathname.startsWith(new URL(self.registration.scope).pathname))return;event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((response)=>{if(response.ok)caches.open(CACHE_NAME).then((cache)=>cache.put(event.request,response.clone()));return response;})));});
