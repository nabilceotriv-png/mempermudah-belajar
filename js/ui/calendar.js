// CalendarView — kalender bulanan + panel agenda (data nyata dari basis data).
import { h, icon } from '../utils/dom.js';
import { localDateKey, formatBulanTahun, addMonths, formatRingkas, startOfDay } from '../utils/date.js';
import { isOverdue, priorityInfo, tasksOnDate } from '../features/task-domain.js';

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * @param {object} p
 * @param {object[]} p.tasks
 * @param {object[]} p.subjects
 * @param {Date} p.month — tanggal kapanpun di bulan yang ditampilkan
 * @param {string} p.selected — "YYYY-MM-DD"
 * @param {(month:Date)=>void} p.onMonthChange
 * @param {(dateKey:string)=>void} p.onSelectDate
 * @param {(task:object)=>void} p.onOpenTask
 * @param {(dateKey:string)=>void} [p.onAddTask]
 * @param {(task:object)=>string} [p.subjectName]
 * @param {(task:object)=>string} [p.subjectColor]
 */
export function CalendarView({
  tasks, subjects = [], month, selected, onMonthChange, onSelectDate, onOpenTask, onAddTask,
  subjectName = () => 'Tanpa kategori', subjectColor = () => '#64748B',
}) {
  const todayKey = localDateKey(startOfDay());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // Mulai minggu dari Senin.
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = localDateKey(d);
    const inMonth = d.getMonth() === month.getMonth();
    const dayTasks = tasksOnDate(tasks, key);
    const shown = dayTasks.slice(0, 3);

    cells.push(h('button', {
      type: 'button',
      class: `cal-cell ${inMonth ? '' : 'other'} ${key === todayKey ? 'today' : ''} ${key === selected ? 'selected' : ''}`,
      'aria-label': `${dayTasks.length} tugas pada ${formatRingkas(d)}`,
      onClick: () => onSelectDate(key),
      onDblclick: () => onAddTask && onAddTask(key),
    },
      h('div', { class: 'cal-daynum' },
        h('span', { class: key === todayKey ? 'circle' : '' }, String(d.getDate())),
        dayTasks.length ? h('span', { class: 'xs muted' }, String(dayTasks.length)) : null),
      shown.map((t) => h('span', {
        class: 'cal-chip',
        style: `border-left-color:${t.status === 'selesai' ? 'var(--success)' : isOverdue(t) ? 'var(--danger)' : subjectColor(t)}`,
        title: `${t.title} — ${formatRingkas(t.due_at)}`,
        onClick: (e) => { e.stopPropagation(); onOpenTask(t); },
      }, t.title)),
      dayTasks.length > 3 ? h('span', { class: 'cal-more' }, `+${dayTasks.length - 3} lagi`) : null
    ));
  }

  return h('div', {},
    h('div', { class: 'cal-toolbar', style: 'margin-bottom:var(--sp-3)' },
      h('button', { class: 'icon-btn', 'aria-label': 'Bulan sebelumnya', onClick: () => onMonthChange(addMonths(first, -1)) }, icon('chevronLeft', 17)),
      h('div', { class: 'cal-month' }, formatBulanTahun(month.getFullYear(), month.getMonth())),
      h('button', { class: 'icon-btn', 'aria-label': 'Bulan berikutnya', onClick: () => onMonthChange(addMonths(first, 1)) }, icon('chevronRight', 17)),
      h('button', { class: 'btn btn-sm', onClick: () => onMonthChange(new Date()) }, icon('calendar', 14), 'Hari Ini'),
      h('div', { class: 'grow' }),
      onAddTask ? h('button', { class: 'btn btn-sm btn-primary', onClick: () => onAddTask(selected) }, icon('plus', 14), 'Tugas di tanggal ini') : null),
    h('div', { class: 'cal-grid', role: 'grid', 'aria-label': 'Kalender tugas' },
      DOW.map((d) => h('div', { class: 'cal-dow', role: 'columnheader' }, d)),
      cells)
  );
}

/** AgendaPanel — daftar tugas pada tanggal terpilih. */
export function AgendaPanel({ tasks, dateKey, subjectName, subjectColor, onOpenTask, onAddTask }) {
  const dayTasks = tasksOnDate(tasks, dateKey);
  const label = dateKey
    ? new Date(`${dateKey}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Pilih tanggal';

  return h('div', { class: 'card card-flush' },
    h('div', { style: 'padding:var(--sp-4)' },
      h('div', { class: 'card-head', style: 'margin:0' },
        h('div', {},
          h('div', { class: 'card-title' }, 'Agenda Tugas'),
          h('div', { class: 'xs muted' }, label)),
        onAddTask ? h('button', { class: 'icon-btn primary-soft', title: 'Tambah tugas pada tanggal ini', 'aria-label': 'Tambah tugas pada tanggal ini', onClick: () => onAddTask(dateKey) }, icon('plus', 16)) : null)),
    dayTasks.length === 0
      ? h('div', { class: 'state-box', style: 'padding:var(--sp-5)' },
        h('p', { class: 'small' }, 'Tidak ada tugas pada tanggal ini.'))
      : h('div', { class: 'task-list' },
        dayTasks.map((t) => h('button', {
          class: 'task-item', style: 'width:100%;text-align:left;background:none;border:none;cursor:pointer;color:inherit;font:inherit',
          onClick: () => onOpenTask(t),
        },
          h('span', { class: 'subject-dot', style: `background:${subjectColor(t)};margin-top:6px` }),
          h('span', { class: 'task-body' },
            h('span', { class: 'task-title', style: 'display:block' }, t.title),
            h('span', { class: 'task-meta' },
              h('span', {}, formatRingkas(t.due_at)),
              h('span', { class: `badge ${priorityInfo(t.priority).badge}` }, priorityInfo(t.priority).label),
              isOverdue(t) ? h('span', { class: 'badge badge-danger' }, 'Terlambat') : null,
              t.status === 'selesai' ? h('span', { class: 'badge badge-success' }, 'Selesai') : null))))),
    h('div', { style: 'padding:var(--sp-3) var(--sp-4);border-top:1px solid var(--border)' },
      h('div', { class: 'xs muted' }, `${dayTasks.length} tugas • ${dayTasks.filter((t) => t.status === 'selesai').length} selesai`))
  );
}
