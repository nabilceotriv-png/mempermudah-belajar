// Logika domain tugas: status turunan, prioritas, filter, pengurutan, progres.
import { isPast, localDateKey, isToday, startOfDay, endOfDay } from '../utils/date.js';

export const PRIORITAS = {
  rendah: { label: 'Rendah', badge: 'badge-primary', urutan: 3 },
  sedang: { label: 'Sedang', badge: 'badge-warning', urutan: 2 },
  tinggi: { label: 'Tinggi', badge: 'badge-danger', urutan: 1 },
};

export const STATUS = {
  belum: { label: 'Belum Dikerjakan', badge: 'badge-neutral' },
  proses: { label: 'Sedang Dikerjakan', badge: 'badge-warning' },
  selesai: { label: 'Selesai', badge: 'badge-success' },
};

/** Terlambat = tenggat lewat DAN status bukan selesai. Tugas selesai tidak pernah terlambat. */
export function isOverdue(task) {
  if (task.status === 'selesai') return false;
  return isPast(task.due_at);
}

export function effectiveStatus(task) {
  if (task.status === 'selesai') return 'selesai';
  if (isOverdue(task)) return 'terlambat';
  return task.status;
}

export function priorityInfo(p) { return PRIORITAS[p] || PRIORITAS.rendah; }
export function statusInfo(s) { return STATUS[s] || STATUS.belum; }

export const FILTER_TABS = [
  { id: 'semua', label: 'Semua Tugas' },
  { id: 'hari-ini', label: 'Tugas Hari Ini' },
  { id: 'belum', label: 'Belum Dikerjakan' },
  { id: 'proses', label: 'Sedang Dikerjakan' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'terlambat', label: 'Terlambat' },
];

export function matchTab(task, tabId) {
  switch (tabId) {
    case 'hari-ini': return isToday(task.due_at);
    case 'belum': return task.status === 'belum';
    case 'proses': return task.status === 'proses';
    case 'selesai': return task.status === 'selesai';
    case 'terlambat': return isOverdue(task);
    default: return true;
  }
}

/** Filter + pencarian + pengurutan daftar tugas. */
export function applyTaskQuery(tasks, query = {}) {
  let list = tasks.slice();
  const { tab, search, subjectId, priority, status, dueFrom, dueTo, sort } = query;

  if (tab && tab !== 'semua') list = list.filter((t) => matchTab(t, tab));
  if (search) {
    const q = String(search).trim().toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }
  if (subjectId) list = list.filter((t) => t.subject_id === subjectId);
  if (priority) list = list.filter((t) => t.priority === priority);
  if (status) list = list.filter((t) => t.status === status);
  if (dueFrom) {
    const from = startOfDay(new Date(`${dueFrom}T00:00:00`)).getTime();
    list = list.filter((t) => new Date(t.due_at).getTime() >= from);
  }
  if (dueTo) {
    const to = endOfDay(new Date(`${dueTo}T00:00:00`)).getTime();
    list = list.filter((t) => new Date(t.due_at).getTime() <= to);
  }

  const sorters = {
    tenggat: (a, b) => new Date(a.due_at) - new Date(b.due_at),
    'tenggat-desc': (a, b) => new Date(b.due_at) - new Date(a.due_at),
    prioritas: (a, b) => (priorityInfo(a.priority).urutan - priorityInfo(b.priority).urutan) || (new Date(a.due_at) - new Date(b.due_at)),
    dibuat: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    judul: (a, b) => a.title.localeCompare(b.title, 'id'),
  };
  list.sort(sorters[sort] || sorters.tenggat);
  return list;
}

export function countTab(tasks, tabId) {
  return tasks.filter((t) => matchTab(t, tabId)).length;
}

/** Statistik dashboard dihitung dari data tersimpan. */
export function computeStats(tasks) {
  const total = tasks.length;
  const today = tasks.filter((t) => isToday(t.due_at));
  const selesai = tasks.filter((t) => t.status === 'selesai');
  const belumSelesai = tasks.filter((t) => t.status !== 'selesai');
  const terlambat = tasks.filter((t) => isOverdue(t));
  const berikutnya = belumSelesai
    .slice()
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0] || null;
  const progres = total === 0 ? 0 : Math.round((selesai.length / total) * 100);
  return { total, hariIni: today.length, selesai: selesai.length, belumSelesai: belumSelesai.length, terlambat: terlambat.length, berikutnya, progres };
}

export function tasksOnDate(tasks, dateKey) {
  return tasks.filter((t) => localDateKey(t.due_at) === dateKey).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
}

export function tasksDueToday(tasks) {
  const key = localDateKey(new Date());
  return tasksOnDate(tasks, key);
}

export const REMINDER_OPTIONS = [
  { value: 0, label: 'Saat tenggat tiba' },
  { value: 60, label: '1 jam sebelum tenggat' },
  { value: 1440, label: '1 hari sebelum tenggat' },
  { value: 10080, label: '1 minggu sebelum tenggat' },
];

export function reminderLabel(minutes) {
  const opt = REMINDER_OPTIONS.find((o) => o.value === Number(minutes));
  return opt ? opt.label : `${minutes} menit sebelum tenggat`;
}
