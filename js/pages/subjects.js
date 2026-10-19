// Halaman Mata Pelajaran (Kelompok Tugas).
import { h, icon } from '../utils/dom.js';
import { navigate, parseHash, setQuery } from '../router.js';
import { subjectService, WARNA } from '../services/subjects.js';
import { taskService } from '../services/tasks.js';
import { LoadingState, ErrorState, EmptyState } from '../ui/states.js';
import { SubjectCard, SubjectForm } from '../ui/subject-card.js';
import { TaskCard } from '../ui/task-card.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { toastSuccess, toastError } from '../ui/toast.js';

export function SubjectsPage({ query }) {
  let subjects = [];
  let tasks = [];
  let selectedId = query.tugas || '';

  const wrap = h('div', { class: 'stack' });
  wrap.__load = load;
  load();

  async function load() {
    wrap.replaceChildren(LoadingState('Memuat mata pelajaran…'));
    try {
      [subjects, tasks] = await Promise.all([subjectService.list(), taskService.list()]);
      render();
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat mata pelajaran.', load));
    }
  }

  function countFor(id) { return tasks.filter((t) => t.subject_id === id).length; }

  function render() {
    const selected = subjects.find((s) => s.id === selectedId) || null;
    const selectedTasks = selected ? tasks.filter((t) => t.subject_id === selected.id) : [];

    const grid = subjects.length === 0
      ? h('div', { class: 'card' },
        EmptyState({
          iconName: 'book',
          title: 'Belum ada mata pelajaran',
          message: 'Kelompokkan tugas berdasarkan mata pelajaran agar lebih rapi, misalnya Matematika, Bahasa Indonesia, atau IPA.',
          actions: [h('button', { class: 'btn btn-primary btn-sm', onClick: openAdd }, icon('plus', 14), 'Tambah Mata Pelajaran')],
        }))
      : h('div', { class: 'grid grid-3' },
        subjects.map((s) => SubjectCard({
          subject: s, taskCount: countFor(s.id),
          onOpen: (subj) => { selectedId = subj.id; setQuery({ tugas: subj.id }); render(); },
          onEdit: openEdit, onDelete: handleDelete,
        })));

    const detail = selected
      ? h('div', { class: 'card card-flush' },
        h('div', { style: 'padding:var(--sp-4) var(--sp-4) 0' },
          h('div', { class: 'card-head' },
            h('div', {},
              h('div', { class: 'card-title row', style: 'gap:8px' },
                h('span', { class: 'subject-dot', style: `background:${selected.color};width:12px;height:12px` }),
                `Tugas ${selected.name}`),
              h('div', { class: 'xs muted' }, `${selectedTasks.length} tugas pada kategori ini`)),
            h('button', { class: 'btn btn-sm', onClick: () => { selectedId = ''; setQuery({ tugas: '' }); render(); } }, icon('x', 14), 'Tutup'))),
        selectedTasks.length === 0
          ? h('div', { class: 'state-box', style: 'padding:var(--sp-5)' }, h('p', { class: 'small' }, 'Belum ada tugas pada mata pelajaran ini.'))
          : h('div', { class: 'task-list' },
            selectedTasks.map((t) => TaskCard({
              task: t,
              subjectName: () => selected.name, subjectColor: () => selected.color,
              onOpen: (task) => navigate(`/tugas/${task.id}`),
              onEdit: (task) => navigate(`/tugas/${task.id}/edit`),
              onDelete: deleteTask,
              onToggle: async (task, done) => {
                try { await taskService.setDone(task.id, done); toastSuccess('Status tugas diperbarui.'); load(); }
                catch (e) { toastError(e?.message || 'Gagal memperbarui tugas.'); }
              },
            }))))
      : null;

    wrap.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', {}, 'Mata Pelajaran'),
          h('p', {}, 'Kelompokkan tugas ke dalam kategori mata pelajaran.')),
        h('button', { class: 'btn btn-primary', onClick: openAdd }, icon('plus', 16), 'Tambah Mata Pelajaran')),
      grid,
      detail);
  }

  function openAdd() {
    const { close } = openDialog({
      title: 'Tambah Mata Pelajaran',
      body: SubjectForm({
        WARNA,
        onCancel: () => close(null),
        onSubmit: async ({ name, color }) => {
          try {
            await subjectService.create({ name, color });
            toastSuccess('Mata pelajaran berhasil ditambahkan.');
            close(true);
            load();
            return true;
          } catch (err) {
            toastError(err?.message || 'Gagal menambahkan mata pelajaran.');
            return false;
          }
        },
      }),
      actions: [],
    });
  }

  function openEdit(subject) {
    const { close } = openDialog({
      title: 'Edit Mata Pelajaran',
      body: SubjectForm({
        subject, WARNA,
        onCancel: () => close(null),
        onSubmit: async ({ name, color }) => {
          try {
            await subjectService.update(subject.id, { name, color });
            toastSuccess('Mata pelajaran berhasil diperbarui.');
            close(true);
            load();
            return true;
          } catch (err) {
            toastError(err?.message || 'Gagal memperbarui mata pelajaran.');
            return false;
          }
        },
      }),
      actions: [],
    });
  }

  /** Penanganan penghapusan kategori yang masih berisi tugas. */
  async function handleDelete(subject) {
    const related = tasks.filter((t) => t.subject_id === subject.id);
    if (related.length === 0) {
      const ok = await confirmDialog({
        title: 'Hapus mata pelajaran?',
        message: `Kategori "${subject.name}" akan dihapus permanen.`,
        confirmLabel: 'Hapus', danger: true,
      });
      if (!ok) return;
      try { await subjectService.remove(subject.id); toastSuccess('Mata pelajaran dihapus.'); load(); }
      catch (err) { toastError(err?.message || 'Gagal menghapus.'); }
      return;
    }

    // Masih ada tugas: tawarkan pemindahan atau penghapusan tugas terkait.
    let choice = 'pindahkan';
    let targetId = subjects.find((s) => s.id !== subject.id)?.id || '';
    const select = h('select', { name: 'target', 'aria-label': 'Mata pelajaran tujuan' },
      subjects.filter((s) => s.id !== subject.id).map((s) => h('option', { value: s.id }, s.name)));

    const moveRow = h('div', { class: 'field', style: 'margin-top:var(--sp-3)' },
      h('label', {}, 'Pindahkan tugas ke mata pelajaran:'), select,
      h('small', { class: 'hint' }, `${related.length} tugas akan dipindahkan. Pengingat tugas tetap tersimpan.`));
    const deleteRow = h('div', { class: 'alert alert-danger', style: 'margin-top:var(--sp-3)' },
      icon('alert', 15), h('span', {}, `${related.length} tugas terkait akan ikut dihapus permanen bersama pengingatnya.`));

    function updateUi() {
      moveRow.style.display = choice === 'pindahkan' ? '' : 'none';
      deleteRow.style.display = choice === 'hapus-tugas' ? '' : 'none';
    }

    const radios = h('div', { class: 'stack', style: 'margin-top:var(--sp-3)' },
      h('label', { class: 'row', style: 'gap:8px;cursor:pointer' },
        h('input', { type: 'radio', name: 'choice', checked: true, onChange: () => { choice = 'pindahkan'; updateUi(); } }),
        h('span', { class: 'small' }, `Pindahkan ${related.length} tugas ke kategori lain`)),
      h('label', { class: 'row', style: 'gap:8px;cursor:pointer' },
        h('input', { type: 'radio', name: 'choice', onChange: () => { choice = 'hapus-tugas'; updateUi(); } }),
        h('span', { class: 'small', style: 'color:var(--danger)' }, `Hapus ${related.length} tugas terkait`)));

    const body = h('div', {},
      h('p', { class: 'small muted' },
        `Mata pelajaran "${subject.name}" masih memiliki ${related.length} tugas. Pilih tindakan yang aman:`),
      radios, moveRow, deleteRow);

    const { close } = openDialog({
      title: 'Hapus mata pelajaran beserta tugasnya?',
      body,
      actions: [
        h('button', { class: 'btn', onClick: () => close(null) }, 'Batal'),
        h('button', {
          class: 'btn btn-danger', 'data-autofocus': true,
          onClick: async () => {
            if (choice === 'pindahkan' && !select.value) {
              toastError('Pilih mata pelajaran tujuan terlebih dahulu.');
              return;
            }
            try {
              await subjectService.remove(subject.id, choice === 'pindahkan'
                ? { reassignTo: select.value }
                : { deleteTasks: true });
              toastSuccess(choice === 'pindahkan'
                ? `${related.length} tugas dipindahkan, kategori dihapus.`
                : 'Kategori dan tugas terkait dihapus.');
              close(true);
              load();
            } catch (err) {
              toastError(err?.message || 'Gagal menghapus mata pelajaran.');
            }
          },
        }, 'Lanjutkan Hapus'),
      ],
      onClose: () => {},
    });
    updateUi();
    if (subjects.filter((s) => s.id !== subject.id).length === 0) {
      choice = 'hapus-tugas';
      radios.querySelectorAll('input')[1].checked = true;
      updateUi();
    }
  }

  async function deleteTask(task) {
    const ok = await confirmDialog({ title: 'Hapus tugas?', message: `Tugas "${task.title}" akan dihapus permanen.`, confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try { await taskService.remove(task.id); toastSuccess('Tugas dihapus.'); load(); }
    catch (err) { toastError(err?.message || 'Gagal menghapus tugas.'); }
  }

  return wrap;
}
