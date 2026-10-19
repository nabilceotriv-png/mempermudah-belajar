// Halaman Detail Tugas.
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { reminderService } from '../services/reminders.js';
import { LoadingState, ErrorState, EmptyState } from '../ui/states.js';
import { priorityInfo, statusInfo, isOverdue, reminderLabel } from '../features/task-domain.js';
import { formatTanggalWaktu, formatTanggal, formatWaktu, sisaWaktu } from '../utils/date.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';

export function TaskDetailPage({ params }) {
  const wrap = h('div', {});
  load();
  async function load() {
    wrap.replaceChildren(LoadingState('Memuat detail tugas…'));
    try {
      const [task, subjects, reminders] = await Promise.all([
        taskService.get(params.id), subjectService.list(), reminderService.list(),
      ]);
      const subject = subjects.find((s) => s.id === task.subject_id) || null;
      const taskReminders = reminders.filter((r) => r.task_id === task.id);
      wrap.replaceChildren(render(task, subject, taskReminders));
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat detail tugas.', load));
    }
  }

  function render(task, subject, taskReminders) {
    const pri = priorityInfo(task.priority);
    const st = statusInfo(task.status);
    const over = isOverdue(task);
    const done = task.status === 'selesai';

    const row = (k, v) => h('div', { class: 'detail-row' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v));

    return h('div', { class: 'stack' },
      h('div', { class: 'row-between wrap' },
        h('button', { class: 'back-link', onClick: () => navigate('/tugas') }, icon('arrowLeft', 15), 'Kembali ke daftar tugas'),
        h('div', { class: 'row', style: 'gap:var(--sp-2)' },
          done
            ? h('button', { class: 'btn', onClick: () => toggleDone(task, false) }, icon('refresh', 15), 'Buka kembali')
            : h('button', { class: 'btn btn-primary', onClick: () => toggleDone(task, true) }, icon('check', 15), 'Tandai Selesai'),
          h('button', { class: 'btn', onClick: () => navigate(`/tugas/${task.id}/edit`) }, icon('edit', 15), 'Edit'),
          h('button', { class: 'btn btn-danger', onClick: () => removeTask(task) }, icon('trash', 15), 'Hapus'))),

      h('div', { class: 'detail-grid' },
        h('div', { class: 'stack-lg' },
          h('div', { class: 'card stack' },
            h('div', { class: 'row wrap', style: 'gap:6px' },
              h('span', { class: `badge ${pri.badge}` }, h('span', { class: 'dot' }), `Prioritas ${pri.label.toLowerCase()}`),
              over ? h('span', { class: 'badge badge-danger' }, icon('alert', 11), 'Terlambat') : h('span', { class: `badge ${st.badge}` }, st.label),
              task.reminder_enabled ? h('span', { class: 'badge badge-primary' }, icon('bell', 11), 'Pengingat aktif') : h('span', { class: 'badge badge-neutral' }, 'Pengingat nonaktif')),
            h('h1', { style: 'font-size:24px' }, task.title),
            task.description
              ? h('p', { class: 'small', style: 'white-space:pre-wrap;color:var(--muted)' }, task.description)
              : h('p', { class: 'small muted italic' }, 'Tidak ada deskripsi.')),

          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Jadwal Pengingat')),
            taskReminders.length === 0
              ? h('p', { class: 'small muted' }, task.reminder_enabled
                ? 'Jadwal pengingat akan dibuat otomatis oleh sistem.'
                : 'Pengingat untuk tugas ini nonaktif.')
              : h('div', { class: 'stack' },
                taskReminders.map((r) => h('div', { class: 'row-between' },
                  h('div', { class: 'row', style: 'gap:8px' },
                    icon('bell', 15),
                    h('div', {},
                      h('div', { class: 'small bold' }, formatTanggalWaktu(r.remind_at)),
                      h('div', { class: 'xs muted' }, reminderLabel(task.reminder_minutes_before)))),
                  r.sent_at
                    ? h('span', { class: 'badge badge-success' }, 'Terkirim')
                    : r.is_enabled
                      ? h('span', { class: 'badge badge-primary' }, 'Menunggu')
                      : h('span', { class: 'badge badge-neutral' }, 'Nonaktif'))))),

        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Informasi Tugas')),
          h('div', { class: 'detail-rows' },
            row('Mata pelajaran', h('span', { class: 'row', style: 'gap:6px;justify-content:flex-end' },
              h('span', { class: 'subject-dot', style: `background:${subject?.color || '#64748B'}` }),
              subject ? h('a', { href: `#/mata-pelajaran?tugas=${subject.id}` }, subject.name) : 'Tanpa kategori')),
            row('Tenggat', formatTanggalWaktu(task.due_at)),
            row('Waktu tersisa', over ? h('span', { style: 'color:var(--danger)' }, sisaWaktu(task.due_at)) : sisaWaktu(task.due_at)),
            row('Prioritas', pri.label),
            row('Status', st.label),
            row('Pengingat', task.reminder_enabled ? `${reminderLabel(task.reminder_minutes_before)}` : 'Nonaktif'),
            row('Dibuat', `${formatTanggal(task.created_at)} ${formatWaktu(task.created_at)}`),
            task.completed_at ? row('Diselesaikan', `${formatTanggal(task.completed_at)} ${formatWaktu(task.completed_at)}`) : null)))));
  }

  async function toggleDone(task, done) {
    try {
      if (done) {
        const ok = await confirmDialog({ title: 'Tandai selesai?', message: `Tugas "${task.title}" akan ditandai selesai.`, confirmLabel: 'Ya, selesaikan' });
        if (!ok) return;
      }
      await taskService.setDone(task.id, done);
      toastSuccess(done ? 'Tugas ditandai selesai.' : 'Tugas dibuka kembali.');
      load();
    } catch (err) {
      toastError(err?.message || 'Gagal memperbarui status.');
    }
  }

  async function removeTask(task) {
    const ok = await confirmDialog({
      title: 'Hapus tugas?',
      message: `Tugas "${task.title}" beserta jadwal pengingatnya akan dihapus permanen.`,
      confirmLabel: 'Hapus permanen', danger: true,
    });
    if (!ok) return;
    try {
      await taskService.remove(task.id);
      toastSuccess('Tugas berhasil dihapus.');
      navigate('/tugas');
    } catch (err) {
      toastError(err?.message || 'Gagal menghapus tugas.');
    }
  }

  return wrap;
}
