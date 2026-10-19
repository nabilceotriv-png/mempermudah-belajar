// Halaman Pengingat Waktu — pusat pengelolaan pengingat & riwayat notifikasi.
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { reminderService, notificationPermissionState, requestNotificationPermission, checkDueReminders } from '../services/reminders.js';
import { taskService } from '../services/tasks.js';
import { LoadingState, ErrorState, EmptyState } from '../ui/states.js';
import { ReminderCard } from '../ui/reminder-card.js';
import { formatTanggalWaktu } from '../utils/date.js';
import { toastSuccess, toastError, toastWarning } from '../ui/toast.js';

export function RemindersPage() {
  let reminders = [];
  let tasks = [];
  let logs = [];
  let tab = 'aktif';

  const wrap = h('div', { class: 'stack' });
  load();

  async function load() {
    wrap.replaceChildren(LoadingState('Memuat pengingat…'));
    try {
      [reminders, tasks, logs] = await Promise.all([
        reminderService.list(), taskService.list(), reminderService.logs(),
      ]);
      render();
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat pengingat.', load));
    }
  }

  function permissionCard() {
    const perm = notificationPermissionState();
    if (perm === 'granted') {
      return h('div', { class: 'alert alert-success' }, icon('check', 16),
        h('span', {}, 'Izin notifikasi browser diberikan. Pengingat dapat ditampilkan sebagai notifikasi sistem selama aplikasi terbuka.'));
    }
    if (perm === 'unsupported') {
      return h('div', { class: 'alert alert-info' }, icon('info', 16),
        h('span', {}, 'Peramban ini tidak mendukung Notification API. Pengingat tetap tampil di Pusat Notifikasi dalam aplikasi.'));
    }
    return h('div', { class: 'alert alert-warning' }, icon('alert', 16),
      h('div', { class: 'grow' },
        h('strong', {}, perm === 'denied' ? 'Izin notifikasi ditolak' : 'Izin notifikasi belum diberikan'),
        h('p', { class: 'xs', style: 'margin:2px 0 8px' }, perm === 'denied'
          ? 'Aktifkan izin notifikasi melalui pengaturan situs di peramban Anda, lalu muat ulang halaman.'
          : 'Berikan izin agar pengingat dapat muncul sebagai notifikasi sistem.')),
      perm === 'default' ? h('button', {
        class: 'btn btn-sm btn-primary',
        onClick: async () => {
          const res = await requestNotificationPermission();
          if (res === 'granted') toastSuccess('Izin notifikasi diberikan.');
          else toastWarning('Izin notifikasi belum diberikan.');
          render();
        },
      }, icon('bell', 14), 'Aktifkan Notifikasi') : null);
  }

  function render() {
    const aktif = reminders.filter((r) => r.is_enabled && !r.sent_at);
    const nonaktif = reminders.filter((r) => !r.is_enabled && !r.sent_at);
    const terkirim = reminders.filter((r) => r.sent_at);

    const taskOf = (r) => tasks.find((t) => t.id === r.task_id) || null;

    const tabBtn = (id, label, count) => h('button', {
      class: `tab ${tab === id ? 'active' : ''}`, role: 'tab', 'aria-selected': tab === id ? 'true' : 'false',
      onClick: () => { tab = id; render(); },
    }, label, h('span', { class: 'count' }, String(count)));

    let body;
    if (tab === 'riwayat') {
      body = logs.length === 0
        ? h('div', { class: 'card' }, EmptyState({
          iconName: 'bell',
          title: 'Belum ada riwayat notifikasi',
          message: 'Notifikasi akan tercatat di sini ketika jadwal pengingat tiba.',
        }))
        : h('div', { class: 'card card-flush' },
          logs.map((log) => {
            const task = tasks.find((t) => t.id === log.task_id) || null;
            const unread = !log.read_at;
            return h('div', { class: `task-item ${unread ? '' : ''}`, style: unread ? 'background:var(--primary-soft)' : '' },
              h('div', { class: 'reminder-icon', style: 'width:34px;height:34px' }, icon('bell', 15)),
              h('div', { class: 'task-body' },
                h('div', { class: 'row wrap', style: 'gap:6px' },
                  h('strong', { class: 'small' }, log.title),
                  unread ? h('span', { class: 'badge badge-primary' }, 'Belum dibaca') : h('span', { class: 'badge badge-neutral' }, 'Sudah dibaca')),
                h('div', { class: 'xs muted', style: 'margin-top:2px' }, log.body),
                h('div', { class: 'xs muted', style: 'margin-top:2px' }, 'Terkirim ', formatTanggalWaktu(log.sent_at || log.remind_at))),
              h('div', { class: 'task-actions' },
                unread ? h('button', { class: 'btn btn-sm', onClick: () => markRead(log) }, 'Tandai dibaca') : null,
                task ? h('button', { class: 'btn btn-sm', onClick: () => navigate(`/tugas/${task.id}`) }, 'Buka tugas') : null));
          }));
    } else {
      const list = tab === 'aktif' ? aktif : tab === 'terkirim' ? terkirim : nonaktif;
      body = list.length === 0
        ? h('div', { class: 'card' }, EmptyState({
          iconName: 'bell',
          title: tab === 'aktif' ? 'Tidak ada pengingat aktif' : tab === 'terkirim' ? 'Belum ada pengingat terkirim' : 'Tidak ada pengingat nonaktif',
          message: tab === 'aktif'
            ? 'Aktifkan pengingat pada tugas agar TaskMate mengingatkan Anda sebelum tenggat.'
            : tab === 'terkirim'
              ? 'Pengingat yang sudah dikirim akan tercatat di sini.'
              : 'Semua pengingat Anda sedang aktif.',
          actions: tab === 'aktif' ? [h('button', { class: 'btn btn-sm btn-primary', onClick: () => navigate('/tugas') }, 'Buka daftar tugas')] : [],
        }))
        : h('div', { class: 'card card-flush' },
          list.map((r) => ReminderCard({ reminder: r, task: taskOf(r), onToggle: handleToggle })));
    }

    const berikutnya = aktif.slice().sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at))[0];

    wrap.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', {}, 'Pengingat Waktu'),
          h('p', {}, 'Jadwal, aktivasi, dan riwayat notifikasi tugas Anda.')),
        h('div', { class: 'row', style: 'gap:var(--sp-2)' },
          h('button', {
            class: 'btn',
            onClick: async () => {
              const n = await checkDueReminders();
              if (n > 0) { toastSuccess(`${n} pengingat dikirim.`); load(); }
              else toastWarning('Tidak ada pengingat yang jatuh tempo saat ini.');
            },
          }, icon('refresh', 15), 'Periksa Sekarang'),
          h('button', { class: 'btn btn-primary', onClick: () => navigate('/tugas') }, icon('plus', 15), 'Atur Pengingat di Tugas'))),

      permissionCard(),

      berikutnya
        ? h('div', { class: 'card stat-card' },
          h('div', { class: 'stat-icon', style: 'background:var(--primary-soft);color:var(--primary)' }, icon('clock', 20)),
          h('div', { class: 'grow' },
            h('div', { class: 'small bold' }, 'Pengingat berikutnya'),
            h('div', { class: 'xs muted' },
              `${tasks.find((t) => t.id === berikutnya.task_id)?.title || 'Tugas'} • ${formatTanggalWaktu(berikutnya.remind_at)}`)))
        : null,

      h('div', { class: 'tabs', role: 'tablist' },
        tabBtn('aktif', 'Pengingat Aktif', aktif.length),
        tabBtn('nonaktif', 'Nonaktif', nonaktif.length),
        tabBtn('terkirim', 'Terkirim', terkirim.length),
        tabBtn('riwayat', 'Riwayat Notifikasi', logs.length)),

      body,

      h('div', { class: 'alert alert-info' }, icon('info', 15),
        h('span', {}, 'Pengingat dijadwalkan di basis data. Pengiriman ketika aplikasi tertutup membutuhkan proses server (Supabase + pg_cron + Web Push) — lihat README bagian ',
          h('a', { href: '#/pengaturan' }, 'Pengaturan'), '.')));
  }

  async function handleToggle(reminder, enabled) {
    try {
      await reminderService.toggle(reminder.id, enabled);
      toastSuccess(enabled ? 'Pengingat diaktifkan.' : 'Pengingat dinonaktifkan.');
      load();
    } catch (err) {
      toastError(err?.message || 'Gagal memperbarui pengingat.');
    }
  }

  async function markRead(log) {
    try { await reminderService.markRead(log.id); load(); }
    catch (err) { toastError(err?.message || 'Gagal memperbarui notifikasi.'); }
  }

  return wrap;
}
