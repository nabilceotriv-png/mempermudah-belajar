// Sidebar — navigasi utama (desktop) & drawer (ponsel).
import { h, icon, clear } from '../utils/dom.js';

const MENU = [
  { path: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
  { path: '/tugas', label: 'Daftar Tugas Harian', iconName: 'list' },
  { path: '/tugas/baru', label: 'Tambah Tugas', iconName: 'plus' },
  { path: '/pengingat', label: 'Pengingat Waktu', iconName: 'bell' },
  { path: '/mata-pelajaran', label: 'Mata Pelajaran', iconName: 'book' },
  { path: '/kalender', label: 'Kalender Tugas', iconName: 'calendar' },
];

const AUTH_MENU = [
  { path: '/masuk', label: 'Masuk & Akun', iconName: 'login' },
  { path: '/pengaturan', label: 'Pengaturan', iconName: 'settings' },
];

/**
 * @param {object} p
 * @param {string} p.currentPath
 * @param {object|null} p.user
 * @param {object|null} p.profile
 * @param {number} p.todayCount
 * @param {(path:string)=>void} p.onNavigate
 * @param {()=>void} p.onLogout
 */
export function renderSidebar({ currentPath, user, profile, todayCount = 0, onNavigate, onLogout }) {
  const el = document.getElementById('sidebar');
  clear(el);

  const navItem = (item) => {
    const active = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
    return h('a', {
      class: `nav-item ${active ? 'active' : ''}`,
      href: `#${item.path}`,
      'aria-current': active ? 'page' : null,
      onClick: (e) => { e.preventDefault(); onNavigate(item.path); },
    },
      icon(item.iconName, 18),
      h('span', { class: 'grow' }, item.label),
      item.path === '/tugas' && todayCount > 0 ? h('span', { class: 'nav-badge' }, String(todayCount)) : null);
  };

  el.append(
    h('div', { class: 'sidebar-brand' },
      h('div', { class: 'brand-mark' }, icon('target', 20)),
      h('div', { class: 'brand-text' },
        h('span', { class: 'brand-name' }, 'TaskMate'),
        h('span', { class: 'brand-sub' }, 'Pengingat Tugas Siswa'))),
    h('nav', { class: 'sidebar-nav' },
      h('div', { class: 'nav-section-label' }, 'Menu Utama'),
      MENU.map(navItem),
      h('div', { class: 'nav-section-label' }, user ? 'Akun' : 'Mulai'),
      user
        ? [navItem(AUTH_MENU[1]),
          h('div', { class: 'sidebar-account' },
            h('div', { class: 'account-card' },
              h('div', { class: 'avatar', 'aria-hidden': 'true' }, (profile?.full_name || user.email || '?').charAt(0).toUpperCase()),
              h('div', { class: 'account-info' },
                h('div', { class: 'account-name' }, profile?.full_name || 'Siswa'),
                h('div', { class: 'account-email' }, user.email)),
              h('button', { class: 'icon-btn', title: 'Keluar dari akun', 'aria-label': 'Keluar dari akun', onClick: onLogout }, icon('logout', 16))))]
        : AUTH_MENU.map(navItem))
  );
  return el;
}

export function setDrawerOpen(open) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open', open);
  overlay.hidden = !open;
}
