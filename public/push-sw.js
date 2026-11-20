// התראות: מקבל הודעה מהשרת ומציג אותה, ולחיצה פותחת את היומן
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const base = self.registration.scope;
  event.waitUntil(self.registration.showNotification(data.title || 'הטיול שלנו', {
    body: data.body || '',
    icon: 'https://mwcbuicwdksyhjjyscil.supabase.co/storage/v1/object/public/brand/icon-192.png',
    badge: 'https://mwcbuicwdksyhjjyscil.supabase.co/storage/v1/object/public/brand/favicon-64.png',
    dir: 'rtl', lang: 'he', tag: data.tag || 'journal',
    data: { url: base + (data.url || '') },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.navigate(url).catch(() => {}); return c.focus(); } }
    return clients.openWindow(url);
  })());
});
