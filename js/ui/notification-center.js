// NotificationCenter — popover notifikasi di header.
import { h, icon } from '../utils/dom.js';
import { NotificationItem } from './reminder-card.js';
import { navigate } from '../router.js';

export function NotificationCenter({ logs = [], tasks = [], onRead, onReadAll, onClose }) {
  const unread = logs.filter((l) => !l.read_at).length;
  const box = h('div', { class: 'popover', role: 'dialog', 'aria-label': 'Notifikasi' },
    h('div', { class: 'popover-head' },
      h('strong', { class: 'small' }, unread ? `${unread} notifikasi belum dibaca` : 'Notifikasi'),
      h('div', { class: 'row', style: 'gap:4px' },
        unread ? h('button', { class: 'btn btn-ghost btn-sm', onClick: () => onReadAll && onReadAll() }, 'Tandai semua') : null,
        h('button', { class: 'icon-btn', style: 'width:28px;height:28px', 'aria-label': 'Tutup notifikasi', onClick: () => onClose && onClose() }, icon('x', 14)))),
    logs.length === 0
      ? h('div', { class: 'state-box', style: 'padding:var(--sp-6) var(--sp-4)' },
        h('div', { class: 'state-icon' }, icon('bell', 22)),
        h('p', { class: 'small' }, 'Belum ada notifikasi. Pengingat yang aktif akan muncul di sini.'))
      : logs.slice(0, 15).map((log) => {
        const task = tasks.find((t) => t.id === log.task_id) || null;
        return NotificationItem({
          log, task, onRead,
          onOpen: () => { if (task) navigate(`/tugas/${task.id}`); },
        });
      }),
    h('div', { style: 'padding:var(--sp-2) var(--sp-4);border-top:1px solid var(--border);text-align:center' },
      h('button', { class: 'btn btn-ghost btn-sm', onClick: () => { navigate('/pengingat'); onClose && onClose(); } }, icon('bell', 14), 'Kelola pengingat'))
  );

  // Tutup saat klik di luar popover.
  const off = (e) => { if (!box.contains(e.target)) { cleanup(); onClose && onClose(); } };
  function cleanup() { document.removeEventListener('mousedown', off); }
  queueMicrotask(() => document.addEventListener('mousedown', off));
  box.__cleanup = cleanup;
  return box;
}
