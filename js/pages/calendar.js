// Halaman Kalender Tugas — data nyata, filter, agenda, buat tugas dari tanggal.
import { h, icon } from '../utils/dom.js';
import { navigate, setQuery } from '../router.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { LoadingState, ErrorState } from '../ui/states.js';
import { CalendarView, AgendaPanel } from '../ui/calendar.js';
import { applyTaskQuery } from '../features/task-domain.js';
import { localDateKey, startOfDay, formatWaktu } from '../utils/date.js';

export function CalendarPage({ query }) {
  const state = {
    month: query.bulan ? new Date(`${query.bulan}-01T00:00:00`) : startOfDay(),
    selected: query.tgl || localDateKey(new Date()),
    view: query.view === 'agenda' ? 'agenda' : 'bulan',
    subjectId: query.subjectId || '',
    status: query.status || '',
  };

  let tasks = [];
  let subjects = [];

  const wrap = h('div', { class: 'stack' });
  load();

  async function load() {
    wrap.replaceChildren(LoadingState('Memuat kalender…'));
    try {
      [tasks, subjects] = await Promise.all([taskService.list(), subjectService.list()]);
      render();
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat kalender.', load));
    }
  }

  function syncUrl() {
    setQuery({
      bulan: `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, '0')}`,
      tgl: state.selected, view: state.view, subjectId: state.subjectId, status: state.status,
    });
  }

  function filteredTasks() {
    return applyTaskQuery(tasks, { subjectId: state.subjectId, status: state.status });
  }

  const subjName = (t) => subjects.find((s) => s.id === t.subject_id)?.name || 'Tanpa kategori';
  const subjColor = (t) => subjects.find((s) => s.id === t.subject_id)?.color || '#64748B';

  function render() {
    const list = filteredTasks();
    const filters = h('div', { class: 'row wrap', style: 'gap:var(--sp-2);margin-bottom:var(--sp-4)' },
      icon('filter', 15),
      h('select', {
        'aria-label': 'Filter mata pelajaran', style: 'width:auto;min-width:180px',
        onChange: (e) => { state.subjectId = e.target.value; syncUrl(); render(); },
      },
        h('option', { value: '' }, 'Semua mata pelajaran'),
        subjects.map((s) => h('option', { value: s.id, selected: s.id === state.subjectId }, s.name))),
      h('select', {
        'aria-label': 'Filter status', style: 'width:auto;min-width:160px',
        onChange: (e) => { state.status = e.target.value; syncUrl(); render(); },
      },
        h('option', { value: '' }, 'Semua status'),
        h('option', { value: 'belum', selected: state.status === 'belum' }, 'Belum dikerjakan'),
        h('option', { value: 'proses', selected: state.status === 'proses' }, 'Sedang dikerjakan'),
        h('option', { value: 'selesai', selected: state.status === 'selesai' }, 'Selesai')),
      h('div', { class: 'grow' }),
      h('div', { class: 'row', style: 'gap:4px' },
        h('button', {
          class: `btn btn-sm ${state.view === 'bulan' ? 'btn-primary' : ''}`,
          onClick: () => { state.view = 'bulan'; syncUrl(); render(); },
        }, icon('calendar', 14), 'Bulan'),
        h('button', {
          class: `btn btn-sm ${state.view === 'agenda' ? 'btn-primary' : ''}`,
          onClick: () => { state.view = 'agenda'; syncUrl(); render(); },
        }, icon('list', 14), 'Agenda')));

    const onMonthChange = (d) => { state.month = d; syncUrl(); render(); };
    const onSelectDate = (key) => { state.selected = key; syncUrl(); render(); };
    const onOpenTask = (task) => navigate(`/tugas/${task.id}`);
    const onAddTask = (dateKey) => navigate('/tugas/baru', { tanggal: dateKey });

    wrap.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', {}, 'Kalender Tugas'),
          h('p', {}, 'Lihat jadwal tugas per tanggal. Klik tanggal untuk melihat agenda, klik dua kali untuk menambah tugas.')),
        h('button', { class: 'btn btn-primary', onClick: () => navigate('/tugas/baru') }, icon('plus', 16), 'Tambah Tugas')),
      filters,
      state.view === 'bulan'
        ? h('div', { class: 'cal-layout' },
          h('div', { class: 'card' }, CalendarView({
            tasks: list, subjects, month: state.month, selected: state.selected,
            onMonthChange, onSelectDate, onOpenTask, onAddTask,
            subjectName: subjName, subjectColor: subjColor,
          })),
          AgendaPanel({ tasks: list, dateKey: state.selected, subjectName: subjName, subjectColor: subjColor, onOpenTask, onAddTask }))
        : agendaView(list, onOpenTask));
  }

  function agendaView(list, onOpenTask) {
    const byDate = new Map();
    for (const t of list.slice().sort((a, b) => new Date(a.due_at) - new Date(b.due_at))) {
      const key = localDateKey(t.due_at);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(t);
    }
    const groups = Array.from(byDate.entries());
    return groups.length === 0
      ? h('div', { class: 'card' },
        h('div', { class: 'state-box' },
          h('div', { class: 'state-icon' }, icon('calendar', 24)),
          h('h3', {}, 'Tidak ada agenda'),
          h('p', { class: 'small' }, 'Tidak ada tugas yang cocok dengan filter saat ini.')))
      : h('div', { class: 'stack' },
        groups.map(([key, items]) => h('div', { class: 'card card-flush' },
          h('div', { style: 'padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--border)' },
            h('strong', { class: 'small' },
              new Date(`${key}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
            h('span', { class: 'xs muted', style: 'margin-left:8px' }, `${items.length} tugas`)),
          h('div', { class: 'task-list' },
            items.map((t) => h('button', {
              class: 'task-item', style: 'width:100%;text-align:left;background:none;border:none;cursor:pointer;color:inherit;font:inherit',
              onClick: () => onOpenTask(t),
            },
              h('span', { class: 'subject-dot', style: `background:${subjColor(t)};margin-top:6px` }),
              h('span', { class: 'task-body' },
                h('span', { class: 'task-title', style: 'display:block' }, t.title),
                h('span', { class: 'task-meta' },
                  h('span', {}, formatWaktu(t.due_at)),
                  h('span', { class: 'sep' }, '•'),
                  h('span', {}, subjName(t)),
                  t.status === 'selesai' ? h('span', { class: 'badge badge-success' }, 'Selesai') : null))))))));
  }

  return wrap;
}
