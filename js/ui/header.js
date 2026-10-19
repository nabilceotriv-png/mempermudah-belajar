// Header — pencarian global, notifikasi, tema, profil.
import { h, icon, clear } from '../utils/dom.js';
import { navigate } from '../router.js';
import { NotificationCenter } from './notification-center.js';
import { setDrawerOpen } from './sidebar.js';

/**
 * @param {object} p
 * @param {string} p.title
 * @param {object|null} p.user
 * @param {object[]} p.logs — riwayat notifikasi
 * @param {object[]} p.tasks
 * @param {string} p.theme — 'dark' | 'light' | 'system'
 * @param {(t:string)=>void} p.onThemeToggle
 * @param {(log:object)=>void} p.onReadLog
 * @param {()=>void} p.onReadAllLogs
 */
export function renderHeader({ title, user, logs = [], tasks = [], theme, onThemeToggle, onReadLog, onReadAllLogs }) {
  const el = document.getElementById('header');
  clear(el);
  const unread = logs.filter((l) => !l.read_at).length;

  let popOpen = false;
  const bellBtn = h('button', {
    class: 'icon-btn', 'aria-label': unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi',
    onClick: (e) => { e.stopPropagation(); togglePopover(); },
  }, icon('bell', 18),
    unread ? h('span', { class: 'dot-badge' }, unread > 9 ? '9+' : String(unread)) : null);

  function togglePopover() {
    if (popOpen) { closePopover(); return; }
    popOpen = true;
    bellBtn.setAttribute('aria-expanded', 'true');
    const pop = NotificationCenter({
      logs, tasks, onRead: onReadLog, onReadAll: onReadAllLogs,
      onClose: closePopover,
    });
    pop.style.position = 'absolute';
    el.querySelector('.header-actions').appendChild(pop);
    bellBtn.__pop = pop;
  }
  function closePopover() {
    popOpen = false;
    bellBtn.setAttribute('aria-expanded', 'false');
    if (bellBtn.__pop) { bellBtn.__pop.__cleanup?.(); bellBtn.__pop.remove(); bellBtn.__pop = null; }
  }

  const searchInput = h('input', {
    type: 'search', placeholder: 'Cari tugas…', 'aria-label': 'Cari tugas',
    onKeyDown: (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        navigate('/tugas', q ? { search: q } : {});
      }
    },
  });

  el.append(
    h('button', {
      class: 'icon-btn menu-toggle', 'aria-label': 'Buka menu navigasi',
      onClick: () => setDrawerOpen(true),
    }, icon('menu', 18)),
    h('div', { class: 'header-title hidden-desktop', style: '' }, title),
    h('div', { class: 'header-search search-box' }, icon('search', 15), searchInput),
    h('div', { class: 'header-actions' },
      bellBtn,
      h('button', {
        class: 'icon-btn', title: theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang',
        'aria-label': 'Ganti tema tampilan', onClick: onThemeToggle,
      }, icon(theme === 'light' ? 'moon' : 'sun', 17)),
      user ? h('button', {
        class: 'icon-btn primary-soft', title: 'Profil & pengaturan', 'aria-label': 'Buka profil dan pengaturan',
        onClick: () => navigate('/pengaturan'),
      }, icon('user', 16))
        : h('button', { class: 'btn btn-primary btn-sm', onClick: () => navigate('/masuk') }, icon('login', 14), 'Masuk'))
  );
  return el;
}
