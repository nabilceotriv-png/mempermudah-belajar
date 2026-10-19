// TaskFilters — tab status + bilah filter/pencarian/pengurutan.
import { h, icon } from '../utils/dom.js';
import { FILTER_TABS, countTab } from '../features/task-domain.js';

/**
 * @param {object} p
 * @param {object[]} p.tasks — seluruh tugas (untuk hitungan tab)
 * @param {object[]} p.subjects
 * @param {object} p.query — { tab, search, subjectId, priority, status, dueFrom, dueTo, sort }
 * @param {(nextQuery:object)=>void} p.onChange
 */
export function TaskFilters({ tasks, subjects = [], query = {}, onChange }) {
  const apply = (patch) => onChange({ ...query, ...patch });

  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Saring berdasarkan status' },
    FILTER_TABS.map((t) => h('button', {
      class: `tab ${(query.tab || 'semua') === t.id ? 'active' : ''}`,
      role: 'tab', 'aria-selected': (query.tab || 'semua') === t.id ? 'true' : 'false',
      onClick: () => apply({ tab: t.id }),
    }, t.label, h('span', { class: 'count' }, countTab(tasks, t.id))))
  );

  const select = (name, value, options, label) => h('select', {
    name, 'aria-label': label, onChange: (e) => apply({ [name]: e.target.value }),
  }, options.map((o) => h('option', { value: o.value, selected: String(value || '') === String(o.value) }, o.label)));

  const bar = h('div', { class: 'filter-bar' },
    h('div', { class: 'search-box' }, icon('search', 15),
      h('input', {
        type: 'search', placeholder: 'Cari judul tugas…', value: query.search || '', name: 'search',
        'aria-label': 'Cari judul tugas',
        onInput: (e) => { clearTimeout(bar.__t); bar.__t = setTimeout(() => apply({ search: e.target.value }), 250); },
      })),
    select('subjectId', query.subjectId || '', [{ value: '', label: 'Semua mata pelajaran' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))], 'Filter mata pelajaran'),
    select('priority', query.priority || '', [
      { value: '', label: 'Semua prioritas' }, { value: 'tinggi', label: 'Prioritas tinggi' },
      { value: 'sedang', label: 'Prioritas sedang' }, { value: 'rendah', label: 'Prioritas rendah' },
    ], 'Filter prioritas'),
    select('status', query.status || '', [
      { value: '', label: 'Semua status' }, { value: 'belum', label: 'Belum dikerjakan' },
      { value: 'proses', label: 'Sedang dikerjakan' }, { value: 'selesai', label: 'Selesai' },
    ], 'Filter status'),
    select('sort', query.sort || 'tenggat', [
      { value: 'tenggat', label: 'Urut: tenggat terdekat' }, { value: 'tenggat-desc', label: 'Urut: tenggat terjauh' },
      { value: 'prioritas', label: 'Urut: prioritas' }, { value: 'dibuat', label: 'Urut: terbaru' },
      { value: 'judul', label: 'Urut: judul (A–Z)' },
    ], 'Urutkan')
  );

  const tanggal = h('div', { class: 'row wrap', style: 'margin-bottom:var(--sp-4);gap:var(--sp-2)' },
    h('label', { class: 'small muted', for: 'dueFrom' }, 'Rentang tenggat:'),
    h('input', { type: 'date', id: 'dueFrom', value: query.dueFrom || '', style: 'width:160px', 'aria-label': 'Tenggat dari tanggal', onChange: (e) => apply({ dueFrom: e.target.value }) }),
    h('span', { class: 'muted' }, 's.d.'),
    h('input', { type: 'date', id: 'dueTo', value: query.dueTo || '', style: 'width:160px', 'aria-label': 'Tenggat sampai tanggal', onChange: (e) => apply({ dueTo: e.target.value }) }),
    (query.dueFrom || query.dueTo) ? h('button', { class: 'btn btn-ghost btn-sm', onClick: () => apply({ dueFrom: '', dueTo: '' }) }, 'Reset tanggal') : null
  );

  return h('div', {}, tabs, bar, tanggal);
}
