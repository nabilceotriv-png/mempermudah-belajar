// ReminderCard — item daftar pengingat & item riwayat notifikasi.
import { h, icon } from '../utils/dom.js';
import { formatTanggalWaktu, sisaWaktu } from '../utils/date.js';
import { reminderLabel } from '../features/task-domain.js';

export function ReminderCard({ reminder, task, onToggle }) {
  const kirim = new Date(reminder.remind_at);
  const terkirim = !!reminder.sent_at;
  const aktif = !!reminder.is_enabled && !terkirim;

  return h('div', { class: 'reminder-item' },
    h('div', { class: `reminder-icon ${terkirim ? 'sent' : aktif ? '' : 'off'}` }, icon(terkirim ? 'check' : 'bell', 17)),
    h('div', { class: 'grow' },
      h('div', { class: 'row wrap', style: 'gap:6px' },
        h('strong', { class: 'small' }, task ? task.title : 'Tugas telah dihapus'),
        task ? h('span', { class: 'badge badge-neutral' }, reminderLabel(reminderMinutes(task, reminder))) : null),
      h('div', { class: 'xs muted', style: 'margin-top:3px' },
        `Dijadwalkan ${formatTanggalWaktu(kirim)}`, terkirim ? ' • sudah terkirim' : ` • ${sisaWaktu(kirim)}`)),
    terkirim
      ? h('span', { class: 'badge badge-success' }, 'Terkirim')
      : h('label', { class: 'switch', title: aktif ? 'Nonaktifkan pengingat' : 'Aktifkan pengingat' },
        h('input', { type: 'checkbox', checked: aktif, 'aria-label': `Aktifkan pengingat tugas ${task?.title || ''}`, onChange: (e) => onToggle && onToggle(reminder, e.target.checked) }),
        h('span', { class: 'track' }), h('span', { class: 'thumb' }))
  );
}

function reminderMinutes(task, reminder) {
  if (task && Number.isFinite(task.reminder_minutes_before)) return task.reminder_minutes_before;
  if (task?.due_at && reminder?.remind_at) {
    return Math.round((new Date(task.due_at) - new Date(reminder.remind_at)) / 60000);
  }
  return 0;
}

export function NotificationItem({ log, task, onOpen, onRead }) {
  const unread = !log.read_at;
  return h('div', {
    class: `popover-item ${unread ? 'unread' : ''}`, role: 'button', tabindex: '0',
    onClick: () => { if (unread && onRead) onRead(log); if (onOpen) onOpen(task); },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (unread && onRead) onRead(log); if (onOpen) onOpen(task); } },
  },
    h('div', { class: 'reminder-icon', style: 'width:32px;height:32px' }, icon('bell', 15)),
    h('div', { class: 'grow' },
      h('div', { class: 'small bold' }, log.title),
      h('div', { class: 'xs muted' }, log.body),
      h('div', { class: 'xs muted', style: 'margin-top:2px' }, formatTanggalWaktu(log.sent_at || log.remind_at))),
    unread ? h('span', { class: 'subject-dot', style: 'background:var(--primary);margin-top:6px' }) : null
  );
}
