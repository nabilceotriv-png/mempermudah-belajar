// Halaman Daftar Tugas Harian — pencarian, filter, pengurutan, pagination, aksi CRUD.
import { h, icon } from '../utils/dom.js';
import { navigate, parseHash, setQuery } from '../router.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { LoadingState, ErrorState, EmptyState } from '../ui/states.js';
import { TaskCard } from '../ui/task-card.js';
import { TaskFilters } from '../ui/task-filters.js';
import { applyTaskQuery, countTab, FILTER_TABS } from '../features/task-domain.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';

const PAGE_SIZE = 10;

export function TasksPage({ query }) {
  const state = {
    tab: query.tab || 'semua',
    search: query.search || '',
    subjectId: query.subjectId || '',
    priority: query.priority || '',
    status: query.status || '',
    dueFrom: query.dueFrom || '',
    dueTo: query.dueTo || '',
    sort: query.sort || 'tenggat',
    page: 1,
  };

  let allTasks = [];
  let subjects = [];
  let container = null;

  const page = h('div', { class: 'stack' },
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, 'Daftar Tugas Harian'),
        h('p', {}, 'Kelola seluruh tugas sekolah Anda dalam satu tempat.')),
      h('button', { class: 'btn btn-primary', onClick: () => navigate('/tugas/baru') }, icon('plus', 16), 'Tambah Tugas')),
    container = h('div', {}));

  load();
  async function load() {
    container.replaceChildren(LoadingState('Memuat daftar tugas…'));
    try {
      [allTasks, subjects] = await Promise.all([taskService.list(), subjectService.list()]);
      renderBody();
    } catch (err) {
      console.error(err);
      container.replaceChildren(ErrorState(err?.message || 'Gagal memuat tugas.', load));
    }
  }

  function onQueryChange(next) {
    Object.assign(state, next, { page: 1 });
    setQuery({
      tab: state.tab, search: state.search, subjectId: state.subjectId, priority: state.priority,
      status: state.status, dueFrom: state.dueFrom, dueTo: state.dueTo, sort: state.sort,
    });
    renderBody();
  }

  function renderBody() {
    const filtered = applyTaskQuery(allTasks, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    const subjName = (id) => subjects.find((x) => x.id === id)?.name || 'Tanpa kategori';
    const subjColor = (id) => subjects.find((x) => x.id === id)?.color || '#64748B';

    const listCard = slice.length === 0
      ? h('div', { class: 'card' },
        EmptyState({
          iconName: 'inbox',
          title: allTasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas yang cocok',
          message: allTasks.length === 0
            ? 'Buat tugas pertama Anda untuk mulai mengatur jadwal sekolah.'
            : 'Coba ubah kata kunci pencarian atau filter yang digunakan.',
          actions: allTasks.length === 0
            ? [h('button', { class: 'btn btn-primary btn-sm', onClick: () => navigate('/tugas/baru') }, icon('plus', 14), 'Tambah Tugas')]
            : [h('button', {
              class: 'btn btn-sm', onClick: () => onQueryChange({
                tab: 'semua', search: '', subjectId: '', priority: '', status: '', dueFrom: '', dueTo: '',
              }),
            }, 'Reset filter')],
        }))
      : h('div', { class: 'card card-flush' },
        h('div', { class: 'task-list' },
          slice.map((t) => TaskCard({
            task: t, subjectName: subjName, subjectColor: subjColor,
            onOpen: (task) => navigate(`/tugas/${task.id}`),
            onToggle: handleToggle,
            onEdit: (task) => navigate(`/tugas/${task.id}/edit`),
            onDelete: handleDelete,
          }))));

    const pagination = filtered.length > PAGE_SIZE
      ? h('div', { class: 'pagination' },
        h('span', { class: 'small muted' }, `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} dari ${filtered.length} tugas`),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-sm', disabled: state.page <= 1, onClick: () => { state.page--; renderBody(); } }, icon('chevronLeft', 14), 'Sebelumnya'),
          h('span', { class: 'small muted' }, `Hal. ${state.page} / ${totalPages}`),
          h('button', { class: 'btn btn-sm', disabled: state.page >= totalPages, onClick: () => { state.page++; renderBody(); } }, 'Berikutnya', icon('chevronRight', 14))))
      : null;

    const ringkasan = h('div', { class: 'row-between wrap', style: 'margin-bottom:var(--sp-3)' },
      h('span', { class: 'small muted' },
        `${filtered.length} tugas ditemukan • `,
        h('span', { style: 'color:var(--success)' }, `${filtered.filter((t) => t.status === 'selesai').length} selesai`), ' • ',
        h('span', { style: 'color:var(--danger)' }, `${filtered.filter((t) => countTab([t], 'terlambat')).length} terlambat`)),
      h('button', { class: 'btn btn-sm', onClick: () => navigate('/kalender') }, icon('calendar', 14), 'Lihat Kalender'));

    container.replaceChildren(
      TaskFilters({ tasks: allTasks, subjects, query: state, onChange: onQueryChange }),
      ringkasan,
      listCard,
      pagination
    );
  }

  async function handleToggle(task, done) {
    try {
      if (done) {
        const ok = await confirmDialog({ title: 'Tandai selesai?', message: `Tugas "${task.title}" akan ditandai selesai.`, confirmLabel: 'Ya, selesaikan' });
        if (!ok) return;
      }
      await taskService.setDone(task.id, done);
      toastSuccess(done ? 'Tugas ditandai selesai.' : 'Status tugas dikembalikan.');
      load();
    } catch (err) {
      toastError(err?.message || 'Gagal memperbarui status tugas.');
    }
  }

  async function handleDelete(task) {
    const ok = await confirmDialog({
      title: 'Hapus tugas?',
      message: `Tugas "${task.title}" beserta jadwal pengingatnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus permanen', danger: true,
    });
    if (!ok) return;
    try {
      await taskService.remove(task.id);
      toastSuccess('Tugas berhasil dihapus.');
      load();
    } catch (err) {
      toastError(err?.message || 'Gagal menghapus tugas.');
    }
  }

  return page;
}
