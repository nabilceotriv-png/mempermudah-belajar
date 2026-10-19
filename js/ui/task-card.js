// TaskCard — baris/ kartu tugas yang dapat digunakan ulang.
import { h, icon } from '../utils/dom.js';
import { formatRingkas, sisaWaktu } from '../utils/date.js';
import { priorityInfo, statusInfo, isOverdue } from '../features/task-domain.js';

/**
 * @param {object} p
 * @param {object} p.task
 * @param {(id:string)=>string} p.subjectName
 * @param {(id:string)=>string} p.subjectColor
 * @param {(task:object)=>void} [p.onToggle]
 * @param {(task:object)=>void} [p.onEdit]
 * @param {(task:object)=>void} [p.onDelete]
 * @param {(task:object)=>void} [p.onOpen]
 * @param {boolean} [p.showActions]
 */
export function TaskCard({
  task, subjectName = () => '—', subjectColor = () => '#64748B',
  onToggle, onEdit, onDelete, onOpen, showActions = true, compact = false,
}) {
  const over = isOverdue(task);
  const pri = priorityInfo(task.priority);
  const st = statusInfo(task.status);
  const done = task.status === 'selesai';

  const checkbox = h('input', {
    type: 'checkbox', class: 'task-check', checked: done,
    'aria-label': `Tandai tugas "${task.title}" ${done ? 'belum selesai' : 'selesai'}`,
    onChange: (e) => onToggle && onToggle(task, e.target.checked),
  });

  const titleBtn = h('button', {
    class: 'task-title-btn', type: 'button',
    onClick: () => (onOpen ? onOpen(task) : null),
  }, task.title);

  const meta = h('div', { class: 'task-meta' },
    h('span', { class: 'row', style: 'gap:5px' },
      h('span', { class: 'subject-dot', style: `background:${subjectColor(task.subject_id)}` }),
      subjectName(task.subject_id)),
    h('span', { class: 'sep' }, '•'),
    h('span', { class: 'row', style: 'gap:4px' }, icon('clock', 12), formatRingkas(task.due_at)),
    over ? h('span', { class: 'sep' }, '•') : null,
    over ? h('span', { style: 'color:var(--danger);font-weight:700' }, sisaWaktu(task.due_at)) : null,
    !over && !done ? h('span', { class: 'sep' }, '•') : null,
    !over && !done ? h('span', {}, sisaWaktu(task.due_at)) : null,
    task.reminder_enabled ? h('span', { class: 'sep' }, '•') : null,
    task.reminder_enabled
      ? h('span', { class: 'row', style: 'gap:4px;color:var(--primary)', title: 'Pengingat aktif' }, icon('bell', 12), 'Pengingat aktif')
      : h('span', { class: 'row', style: 'gap:4px;opacity:.6', title: 'Pengingat nonaktif' }, icon('bell', 12), 'Nonaktif')
  );

  const badges = h('div', { class: 'row wrap', style: 'gap:6px;margin-top:6px' },
    h('span', { class: `badge ${pri.badge}` }, h('span', { class: 'dot' }), `Prioritas ${pri.label.toLowerCase()}`),
    over
      ? h('span', { class: 'badge badge-danger' }, icon('alert', 11), 'Terlambat')
      : h('span', { class: `badge ${st.badge}` }, st.label)
  );

  const actions = showActions ? h('div', { class: 'task-actions' },
    onEdit ? h('button', { class: 'icon-btn', style: 'width:32px;height:32px', title: 'Edit tugas', 'aria-label': `Edit tugas ${task.title}`, onClick: () => onEdit(task) }, icon('edit', 15)) : null,
    onDelete ? h('button', { class: 'icon-btn', style: 'width:32px;height:32px', title: 'Hapus tugas', 'aria-label': `Hapus tugas ${task.title}`, onClick: () => onDelete(task) }, icon('trash', 15)) : null
  ) : null;

  return h('div', { class: `task-item ${done ? 'done' : ''}`, dataset: { taskId: task.id } },
    checkbox,
    h('div', { class: 'task-body' },
      compact ? null : titleBtn,
      compact ? titleBtn : null,
      meta,
      badges),
    actions
  );
}
