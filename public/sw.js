// عشان الموقع يتثبت كأيقونة على الموبايل (م-953). البيانات نفسها دايمًا من النت.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
