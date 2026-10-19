// TaskMate — Service Worker: cache app shell agar aplikasi bisa dibuka offline.
// Strategi:
//  - Aset (js/css/ikon): cache-first, perbarui diam-diam di latar (stale-while-revalidate).
//  - Navigasi halaman: network-first, jatuh ke index.html dari cache saat offline.
const VERSION = 'taskmate-v1';
const SHELL = `${VERSION}-shell`;

const SHELL_FILES = [
  '/index.html',
  '/manifest.webmanifest',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/layout.css',
  '/styles/components.css',
  '/styles/pages.css',
  '/js/app.js',
  '/js/router.js',
  '/js/app/theme.js',
  '/js/utils/dom.js',
  '/js/utils/date.js',
  '/js/utils/misc.js',
  '/js/utils/validation.js',
  '/js/store/db.js',
  '/js/store/index.js',
  '/js/store/local-adapter.js',
  '/js/store/supabase-adapter.js',
  '/js/features/task-domain.js',
  '/js/services/auth.js',
  '/js/services/tasks.js',
  '/js/services/subjects.js',
  '/js/services/reminders.js',
  '/js/services/settings.js',
  '/js/ui/toast.js',
  '/js/ui/dialog.js',
  '/js/ui/states.js',
  '/js/ui/sidebar.js',
  '/js/ui/header.js',
  '/js/ui/notification-center.js',
  '/js/ui/task-card.js',
  '/js/ui/task-filters.js',
  '/js/ui/task-form.js',
  '/js/ui/subject-card.js',
  '/js/ui/reminder-card.js',
  '/js/ui/calendar.js',
  '/js/pages/auth.js',
  '/js/pages/dashboard.js',
  '/js/pages/tasks.js',
  '/js/pages/task-form-page.js',
  '/js/pages/task-detail.js',
  '/js/pages/reminders.js',
  '/js/pages/subjects.js',
  '/js/pages/calendar.js',
  '/js/pages/settings.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigasi: network-first, fallback ke shell (mode offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Aset: cache-first + perbarui di latar.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
