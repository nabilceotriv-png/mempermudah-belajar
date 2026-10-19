// Halaman Tambah & Edit Tugas.
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { TaskForm } from '../ui/task-form.js';
import { LoadingState, ErrorState } from '../ui/states.js';
import { toastSuccess, toastError } from '../ui/toast.js';

export function TaskNewPage({ query }) {
  const wrap = h('div', { class: 'stack' });
  load();
  async function load() {
    wrap.replaceChildren(LoadingState('Memuat formulir…'));
    try {
      const subjects = await subjectService.list();
      const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(query?.tanggal || '') ? query.tanggal : null;
      wrap.replaceChildren(
        header('Tambah Tugas', 'Catat tugas baru dan atur tenggat serta pengingatnya.'),
        TaskForm({
          subjects, initialDate,
          onBatal: () => navigate('/tugas'),
          onSave: async (payload, { again }) => {
            await taskService.create(payload);
            toastSuccess('Tugas berhasil disimpan.');
            if (again) return false; // biarkan formulir mereset sendiri
            navigate('/tugas');
            return true;
          },
        })
      );
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat formulir.', load));
    }
  }
  return wrap;
}

export function TaskEditPage({ params }) {
  const wrap = h('div', { class: 'stack' });
  load();
  async function load() {
    wrap.replaceChildren(LoadingState('Memuat tugas…'));
    try {
      const [task, subjects] = await Promise.all([taskService.get(params.id), subjectService.list()]);
      wrap.replaceChildren(
        header(`Edit Tugas`, task.title),
        TaskForm({
          task, subjects,
          onBatal: () => navigate(`/tugas/${task.id}`),
          onSave: async (payload) => {
            await taskService.update(task.id, payload);
            toastSuccess('Perubahan tugas tersimpan. Jadwal pengingat ikut diperbarui.');
            navigate(`/tugas/${task.id}`);
            return true;
          },
        })
      );
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat tugas.', load));
    }
  }
  return wrap;
}

function header(title, subtitle) {
  return h('div', { class: 'page-head' },
    h('div', {},
      h('button', { class: 'back-link', onClick: () => history.length > 1 ? history.back() : navigate('/tugas') }, icon('arrowLeft', 15), 'Kembali'),
      h('h1', {}, title),
      h('p', {}, subtitle)));
}
