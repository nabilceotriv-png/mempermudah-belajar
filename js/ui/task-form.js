// TaskForm — formulir tambah/edit tugas dengan validasi berbasis skema.
import { h, icon, qs } from '../utils/dom.js';
import { validate, required, maxLen, applyErrors, clearFieldErrors, dateOk, timeOk, oneOf } from '../utils/validation.js';
import { localDateKey, localTimeKey, isPast, formatTanggalWaktu, toIsoLocal } from '../utils/date.js';
import { REMINDER_OPTIONS } from '../features/task-domain.js';
import { confirmDialog } from './dialog.js';

const PRIORITAS_OPTS = [
  { value: 'rendah', label: 'Rendah' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'tinggi', label: 'Tinggi' },
];
const STATUS_OPTS = [
  { value: 'belum', label: 'Belum Dikerjakan' },
  { value: 'proses', label: 'Sedang Dikerjakan' },
  { value: 'selesai', label: 'Selesai' },
];

/**
 * @param {object} p
 * @param {object|null] p.task — tugas yang diedit (null untuk tambah baru)
 * @param {object[]} p.subjects
 * @param {(data:object, meta:{again:boolean})=>Promise<boolean>} p.onSave — kembalikan true bila sukses
 * @param {()=>void} p.onBatal
 */
export function TaskForm({ task = null, subjects = [], initialDate = null, onSave, onBatal }) {
  const initial = {
    title: task?.title || '',
    subject_id: task?.subject_id || '',
    description: task?.description || '',
    date: task ? localDateKey(task.due_at) : (initialDate || localDateKey(new Date())),
    time: task ? localTimeKey(task.due_at) : '23:59',
    priority: task?.priority || 'sedang',
    status: task?.status || 'belum',
    reminder_enabled: task ? !!task.reminder_enabled : true,
    reminder_minutes_before: Number.isFinite(task?.reminder_minutes_before) ? task.reminder_minutes_before : 60,
  };

  const snapshot = JSON.stringify(initial);
  const dirty = () => JSON.stringify(readForm()) !== snapshot;

  const alertBox = h('div', { class: 'hidden' });

  const warnTenggat = h('div', { class: 'hidden' });

  function readForm() {
    const f = form;
    return {
      title: qs('[name="title"]', f).value,
      subject_id: qs('[name="subject_id"]', f).value,
      description: qs('[name="description"]', f).value,
      date: qs('[name="date"]', f).value,
      time: qs('[name="time"]', f).value,
      priority: qs('[name="priority"]', f).value,
      status: qs('[name="status"]', f).value,
      reminder_enabled: qs('[name="reminder_enabled"]', f).checked,
      reminder_minutes_before: Number(qs('[name="reminder_minutes_before"]', f).value),
    };
  }

  function checkDeadlineWarning() {
    const v = readForm();
    if (!v.date || !v.time) return;
    const iso = toIsoLocal(v.date, v.time);
    if (isPast(iso) && v.status !== 'selesai') {
      warnTenggat.className = 'alert alert-warning';
      warnTenggat.replaceChildren(
        icon('alert', 16),
        h('span', {}, `Perhatian: tenggat ${formatTanggalWaktu(iso)} sudah lewat. Tugas akan langsung ditandai terlambat.`
        ));
    } else {
      warnTenggat.className = 'hidden';
      warnTenggat.replaceChildren();
    }
  }

  const field = (name, label, control, { required: req = false, hint = '', span = false } = {}) =>
    h('div', { class: `field ${span ? 'span-2' : ''}` },
      h('label', { for: `f-${name}` }, label, req ? h('span', { class: 'req' }, ' *') : null),
      control,
      hint ? h('small', { class: 'hint' }, hint) : null);

  const reminderSwitch = h('label', { class: 'switch', for: 'f-reminder_enabled' },
    h('input', { type: 'checkbox', id: 'f-reminder_enabled', name: 'reminder_enabled', checked: initial.reminder_enabled, onChange: () => updateReminderUi() }),
    h('span', { class: 'track' }), h('span', { class: 'thumb' })
  );

  const reminderSelect = h('select', { name: 'reminder_minutes_before', id: 'f-reminder_minutes_before' },
    REMINDER_OPTIONS.map((o) => h('option', { value: o.value, selected: o.value === initial.reminder_minutes_before }, o.label)));

  function updateReminderUi() {
    const on = qs('[name="reminder_enabled"]', form).checked;
    reminderSelect.disabled = !on;
    reminderSelect.style.opacity = on ? '1' : '0.5';
  }

  const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save', 16), 'Simpan Tugas');
  const submitAgainBtn = h('button', { type: 'button', class: 'btn' }, icon('plus', 16), 'Simpan dan Tambah Lagi');

  const form = h('form', { class: 'card stack-lg', novalidate: true, onSubmit: (e) => { e.preventDefault(); handleSave(false); } },
    alertBox,
    warnTenggat,
    h('div', { class: 'form-grid' },
      field('title', 'Judul tugas', h('input', { type: 'text', id: 'f-title', name: 'title', value: initial.title, maxlength: 160, placeholder: 'Contoh: Kerjakan Laporan Praktikum Fisika', autocomplete: 'off' }), { required: true, span: true }),
      field('subject_id', 'Mata pelajaran', h('select', { name: 'subject_id', id: 'f-subject_id' },
        h('option', { value: '' }, '— Pilih mata pelajaran —'),
        subjects.map((s) => h('option', { value: s.id, selected: s.id === initial.subject_id }, s.name))), { required: true }),
      field('priority', 'Prioritas', h('select', { name: 'priority', id: 'f-priority' },
        PRIORITAS_OPTS.map((o) => h('option', { value: o.value, selected: o.value === initial.priority }, o.label)))),
      field('date', 'Tanggal tenggat', h('input', { type: 'date', name: 'date', id: 'f-date', value: initial.date, onChange: checkDeadlineWarning }), { required: true }),
      field('time', 'Waktu tenggat', h('input', { type: 'time', name: 'time', id: 'f-time', value: initial.time, onChange: checkDeadlineWarning }), { required: true }),
      field('status', 'Status', h('select', { name: 'status', id: 'f-status', onChange: checkDeadlineWarning },
        STATUS_OPTS.map((o) => h('option', { value: o.value, selected: o.value === initial.status }, o.label)))),
      field('description', 'Deskripsi (opsional)', h('textarea', { name: 'description', id: 'f-description', maxlength: 2000, placeholder: 'Catatan tambahan tentang tugas ini…', style: 'min-height:88px' }), { span: true }),
    ),
    h('div', { class: 'card', style: 'background:var(--card-2)' },
      h('div', { class: 'switch-row' },
        h('div', { class: 'switch-copy' }, h('strong', {}, 'Pengingat aktif'), h('span', {}, 'Kirimi pengingat sebelum tiba tenggat.')),
        reminderSwitch),
      h('div', { class: 'switch-row' },
        h('div', { class: 'switch-copy' }, h('strong', {}, 'Waktu pengingat'), h('span', {}, 'Kapan pengingat dikirim relatif terhadap tenggat.')),
        reminderSelect)),
    subjects.length === 0
      ? h('div', { class: 'alert alert-info' }, icon('info', 16), h('span', {}, 'Belum ada mata pelajaran. Buat dulu di menu ', h('a', { href: '#/mata-pelajaran' }, 'Mata Pelajaran'), '.'))
      : null,
    h('div', { class: 'row wrap', style: 'gap:var(--sp-2)' },
      submitBtn,
      submitAgainBtn,
      h('button', { type: 'button', class: 'btn btn-ghost', onClick: handleBatal }, 'Batal'))
  );

  updateReminderUi();
  queueMicrotask(checkDeadlineWarning);

  let saving = false;

  function setSaving(state) {
    saving = state;
    submitBtn.disabled = state;
    submitAgainBtn.disabled = state;
    if (state) {
      submitBtn.replaceChildren(h('span', { class: 'spinner' }), 'Menyimpan…');
    } else {
      submitBtn.replaceChildren(icon('save', 16), 'Simpan Tugas');
    }
  }

  async function handleSave(again) {
    if (saving) return; // cegah klik simpan berulang
    clearFieldErrors(form);
    alertBox.className = 'hidden';
    const values = readForm();

    const { valid, errors } = validate(values, {
      title: [required, maxLen(160)],
      subject_id: [required],
      date: [required, dateOk],
      time: [required, timeOk],
      priority: [required, oneOf(['rendah', 'sedang', 'tinggi'])],
      status: [required, oneOf(['belum', 'proses', 'selesai'])],
    });
    if (!valid) {
      applyErrors(form, errors);
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 16), h('span', {}, 'Periksa kembali kolom yang ditandai merah.'));
      return;
    }

    const due_at = toIsoLocal(values.date, values.time);
    if (!due_at) {
      applyErrors(form, { date: 'Tanggal tidak valid.', time: 'Waktu tidak valid.' });
      return;
    }

    const payload = {
      title: values.title.trim(),
      subject_id: values.subject_id,
      description: values.description.trim(),
      due_at,
      priority: values.priority,
      status: values.status,
      reminder_enabled: values.reminder_enabled,
      reminder_minutes_before: values.reminder_enabled ? values.reminder_minutes_before : null,
    };

    setSaving(true);
    try {
      const ok = await onSave(payload, { again });
      if (!ok) { setSaving(false); return; }
      if (again) {
        // Reset sebagian: judul & deskripsi dikosongkan, sisanya dipertahankan.
        qs('[name="title"]', form).value = '';
        qs('[name="description"]', form).value = '';
        qs('[name="title"]', form).focus();
        setSaving(false);
      }
    } catch (err) {
      setSaving(false);
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 16), h('span', {}, err?.message || 'Gagal menyimpan tugas. Periksa koneksi lalu coba lagi.'));
    }
  }

  async function handleBatal() {
    if (dirty()) {
      const ok = await confirmDialog({
        title: 'Buang perubahan?',
        message: 'Formulir berisi perubahan yang belum disimpan. Yakin ingin meninggalkan halaman ini?',
        confirmLabel: 'Ya, buang', danger: true,
      });
      if (!ok) return;
    }
    onBatal && onBatal();
  }

  submitAgainBtn.addEventListener('click', () => handleSave(true));

  form.__cleanup = null;
  return form;
}
