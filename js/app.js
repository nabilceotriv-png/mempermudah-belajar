// Bootstrap aplikasi TaskMate: tema, sesi, routing, layout, scheduler.
import { h, icon } from './utils/dom.js';
import { configureRouter, startRouter, navigate, renderRoute, parseHash } from './router.js';
import { renderSidebar, setDrawerOpen } from './ui/sidebar.js';
import { renderHeader } from './ui/header.js';
import { authService } from './services/auth.js';
import { taskService } from './services/tasks.js';
import { reminderService, startScheduler, stopScheduler } from './services/reminders.js';
import { settingsService } from './services/settings.js';
import { applyTheme, currentTheme, quickToggleTheme } from './app/theme.js';
import { storageMode, session, onAuthChange } from './store/index.js';
import { toastSuccess } from './ui/toast.js';
import { confirmDialog } from './ui/dialog.js';

import { DashboardPage } from './pages/dashboard.js';
import { TasksPage } from './pages/tasks.js';
import { TaskNewPage, TaskEditPage } from './pages/task-form-page.js';
import { TaskDetailPage } from './pages/task-detail.js';
import { RemindersPage } from './pages/reminders.js';
import { SubjectsPage } from './pages/subjects.js';
import { CalendarPage } from './pages/calendar.js';
import { SettingsPage } from './pages/settings.js';
import { LoginPage, RegisterPage, ForgotPage, ResetPage } from './pages/auth.js';

// ---------- State global ringan ----------
const state = {
  user: null,
  profile: null,
  logs: [],
  tasks: [],
  theme: currentTheme(),
};

// ---------- Route table ----------
const ROUTES = [
  { path: '/dashboard', page: () => DashboardPage(), title: 'Dashboard' },
  { path: '/tugas', page: (ctx) => TasksPage(ctx), title: 'Daftar Tugas Harian' },
  { path: '/tugas/baru', page: () => TaskNewPage({ query: parseHash().query }), title: 'Tambah Tugas' },
  { path: '/tugas/:id', page: (ctx) => TaskDetailPage(ctx), title: 'Detail Tugas' },
  { path: '/tugas/:id/edit', page: (ctx) => TaskEditPage(ctx), title: 'Edit Tugas' },
  { path: '/pengingat', page: () => RemindersPage(), title: 'Pengingat Waktu' },
  { path: '/mata-pelajaran', page: (ctx) => SubjectsPage(ctx), title: 'Mata Pelajaran' },
  { path: '/kalender', page: (ctx) => CalendarPage(ctx), title: 'Kalender Tugas' },
  { path: '/pengaturan', page: () => SettingsPage({ params: { tab: 'profil' } }), title: 'Pengaturan' },
  { path: '/pengaturan/:tab', page: (ctx) => SettingsPage(ctx), title: 'Pengaturan' },
  { path: '/masuk', page: () => LoginPage(), title: 'Masuk', auth: false, redirectIfAuth: '/dashboard' },
  { path: '/daftar', page: () => RegisterPage(), title: 'Daftar Akun', auth: false, redirectIfAuth: '/dashboard' },
  { path: '/lupa-sandi', page: () => ForgotPage(), title: 'Lupa Kata Sandi', auth: false },
  { path: '/reset-sandi', page: (ctx) => ResetPage(ctx), title: 'Reset Kata Sandi', auth: false },
  { path: '/404', page: () => NotFoundPage(), title: 'Tidak Ditemukan', auth: false },
];

function NotFoundPage() {
  return h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-card center' },
      h('div', { class: 'brand-mark', style: 'margin:0 auto var(--sp-4)' }, icon('alert', 22)),
      h('h1', { style: 'font-size:22px' }, 'Halaman tidak ditemukan'),
      h('p', { class: 'small muted', style: 'margin:8px 0 20px' }, 'Halaman yang Anda tuju tidak tersedia atau sudah dipindahkan.'),
      h('button', { class: 'btn btn-primary', onClick: () => navigate('/dashboard') }, icon('dashboard', 15), 'Ke Dashboard')));
}

// ---------- Header / sidebar refresh ----------
let pageTitle = 'TaskMate';

async function refreshChrome() {
  const path = parseHash().path;
  renderSidebar({
    currentPath: path,
    user: state.user,
    profile: state.profile,
    todayCount: state.tasks.filter((t) => new Date(t.due_at).toDateString() === new Date().toDateString()).length,
    onNavigate: (p) => { setDrawerOpen(false); navigate(p); },
    onLogout: handleLogout,
  });
  renderHeader({
    title: pageTitle,
    user: state.user,
    logs: state.logs,
    tasks: state.tasks,
    theme: state.theme === 'light' ? 'light' : 'dark',
    onThemeToggle: handleThemeToggle,
    onReadLog: async (log) => {
      try { await reminderService.markRead(log.id); await loadData(); refreshChrome(); } catch { /* abaikan */ }
    },
    onReadAllLogs: async () => {
      try { await reminderService.markAllRead(); await loadData(); refreshChrome(); } catch { /* abaikan */ }
    },
  });
}

async function handleThemeToggle() {
  const next = quickToggleTheme();
  state.theme = next;
  if (state.user) {
    try { await settingsService.update({ theme: next }); } catch { /* abaikan */ }
  }
  refreshChrome();
}

async function handleLogout() {
  const ok = await confirmDialog({ title: 'Keluar dari akun?', message: 'Sesi aktif akan dihapus dari perangkat ini.', confirmLabel: 'Ya, keluar', danger: true });
  if (!ok) return;
  stopScheduler();
  await authService.signOut();
  state.user = null; state.profile = null; state.logs = []; state.tasks = [];
  toastSuccess('Anda telah keluar dari TaskMate.');
  navigate('/masuk', {}, { replace: true });
  refreshChrome();
}

async function loadData() {
  if (!state.user) { state.tasks = []; state.logs = []; return; }
  try {
    [state.tasks, state.logs, state.profile] = await Promise.all([
      taskService.list(), reminderService.logs(), authService.getProfile(state.user.id),
    ]);
  } catch (err) {
    if (err?.code === 'SESSION_EXPIRED' || err?.status === 401) {
      state.user = null;
      navigate('/masuk', {}, { replace: true });
    }
  }
}

// ---------- Sesi & boot ----------
async function syncAuthState() {
  const s = authService.getSession();
  const nextUser = s?.user || null;
  const changed = (nextUser?.id) !== (state.user?.id);
  state.user = nextUser;
  if (nextUser) {
    await loadData();
    if (changed) {
      // Terapkan tema tersimpan di akun.
      try {
        const st = await settingsService.get();
        state.theme = st?.theme || 'dark';
        applyTheme(state.theme);
      } catch { /* abaikan */ }
      if (!document.documentElement.dataset.schedulerOn) {
        document.documentElement.dataset.schedulerOn = '1';
        startScheduler();
      }
    }
  } else {
    stopScheduler();
    delete document.documentElement.dataset.schedulerOn;
    state.tasks = []; state.logs = []; state.profile = null;
  }
  refreshChrome();
}

function boot() {
  applyTheme(currentTheme());
  const app = document.getElementById('app');
  app.hidden = false;

  configureRouter({
    outletEl: document.getElementById('konten'),
    routes: ROUTES,
    setTitle: (t) => { pageTitle = t === 'TaskMate' ? t : `${t} • TaskMate`; document.title = `${pageTitle}`; },
    isAuthenticated: () => !!authService.getSession(),
    onAuthRequired: () => {
      toastAndRedirect();
    },
    afterRender: () => { refreshChrome(); },
  });

  function toastAndRedirect() {
    navigate('/masuk', {}, { replace: true });
    renderRoute();
  }

  // Tutup drawer saat navigasi (ponsel).
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => setDrawerOpen(false));

  // Perubahan sesi dari sumber lain.
  onAuthChange(() => { syncAuthState(); });
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('taskmate:')) syncAuthState();
  });
  window.addEventListener('taskmate:auth-changed', () => syncAuthState());
  window.addEventListener('taskmate:profile-changed', () => loadData().then(refreshChrome));

  syncAuthState().finally(() => {
    startRouter();
    // Perbarui chrome setelah render rute pertama.
    refreshChrome();
  });

  if (storageMode === 'local') {
    console.info('[TaskMate] Mode penyimpanan lokal aktif. Hubungkan Supabase untuk data multi-perangkat (lihat README).');
  }

  // PWA: daftarkan service worker agar aplikasi bisa dipasang & dibuka offline.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('[TaskMate] Service worker tidak dapat didaftarkan:', err?.message || err);
      });
    });
  }
}

boot();
