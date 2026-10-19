// SubjectCard — kartu mata pelajaran dengan jumlah tugas & aksi.
import { h, icon } from '../utils/dom.js';

export function SubjectCard({ subject, taskCount = 0, onEdit, onDelete, onOpen }) {
  return h('div', { class: 'card subject-card' },
    h('div', { class: 'subject-color-bar', style: `background:${subject.color}` }),
    h('div', { class: 'row-between' },
      h('button', {
        class: 'task-title-btn row', style: 'gap:8px', onClick: () => onOpen && onOpen(subject),
        'aria-label': `Lihat tugas mata pelajaran ${subject.name}`,
      },
        h('span', { class: 'subject-dot', style: `background:${subject.color};width:12px;height:12px` }),
        h('span', { class: 'card-title', style: 'margin:0' }, subject.name)),
      h('span', { class: 'badge badge-neutral' }, `${taskCount} tugas`)),
    h('div', { class: 'xs muted' }, 'Dibuat ', new Date(subject.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })),
    h('div', { class: 'subject-actions' },
      h('button', { class: 'btn btn-sm', onClick: () => onEdit && onEdit(subject) }, icon('edit', 14), 'Edit'),
      h('button', { class: 'btn btn-sm btn-danger', onClick: () => onDelete && onDelete(subject) }, icon('trash', 14), 'Hapus'))
  );
}

/** Formulir tambah/edit mata pelajaran. */
export function SubjectForm({ subject = null, WARNA, onSubmit, onCancel }) {
  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } });
  const error = h('div', { class: 'hidden' });
  const input = h('input', { type: 'text', name: 'name', value: subject?.name || '', maxlength: 60, placeholder: 'Contoh: Matematika', 'aria-label': 'Nama mata pelajaran' });
  let color = subject?.color || WARNA[0];

  const swatches = h('div', { class: 'color-swatches', role: 'radiogroup', 'aria-label': 'Warna kategori' },
    WARNA.map((c) => {
      const btn = h('button', {
        type: 'button', class: `swatch ${c === color ? 'selected' : ''}`, style: `background:${c}`,
        role: 'radio', 'aria-checked': c === color ? 'true' : 'false', 'aria-label': `Warna ${c}`,
        onClick: () => {
          color = c;
          swatches.querySelectorAll('.swatch').forEach((s) => { s.classList.remove('selected'); s.setAttribute('aria-checked', 'false'); });
          btn.classList.add('selected');
          btn.setAttribute('aria-checked', 'true');
        },
      });
      return btn;
    }));

  async function submit() {
    error.className = 'hidden';
    const name = input.value.trim();
    if (!name) {
      input.setAttribute('aria-invalid', 'true');
      error.className = 'alert alert-danger';
      error.replaceChildren(icon('alert', 15), h('span', {}, 'Nama mata pelajaran wajib diisi.'));
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    const ok = await onSubmit({ name, color });
    if (ok === false) return;
  }

  form.append(
    error,
    h('div', { class: 'field' }, h('label', {}, 'Nama mata pelajaran ', h('span', { class: 'req' }, '*')), input),
    h('div', { class: 'field' }, h('label', {}, 'Warna kategori'), swatches),
    h('div', { class: 'dialog-actions', style: 'margin-top:var(--sp-4)' },
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: onCancel }, 'Batal'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save', 15), subject ? 'Simpan Perubahan' : 'Tambah Mata Pelajaran'))
  );
  return form;
}
