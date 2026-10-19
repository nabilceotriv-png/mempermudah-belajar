// Halaman Dashboard.
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { dataService } from '../services/settings.js';
import { authService } from '../services/auth.js';
import { LoadingState, ErrorState, EmptyState } from '../ui/states.js';
import { TaskCard } from '../ui/task-card.js';
import { computeStats, tasksDueToday, isOverdue, priorityInfo } from '../features/task-domain.js';
import { formatTanggal, formatRingkas, sisaWaktu, localTimeKey } from '../utils/date.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';

function statCard(iconName, colorVar, value, label) {
  return h('div', { class: 'card stat-card' },
    h('div', { class: 'stat-icon', style: `background:color-mix(in srgb, ${colorVar} 16%, transparent);color:${colorVar}` }, icon(iconName, 20)),
    h('div', {},
      h('div', { class: 'stat-value' }, String(value)),
      h('div', { class: 'stat-label' }, label)));
}

function progressRing(percent) {
  const r = 52, c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return h('div', { class: 'ring' },
    h('svg', { width: 120, height: 120, viewBox: '0 0 120 120', 'aria-hidden': 'true' },
      h('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: 'var(--card-2)', 'stroke-width': 10 }),
      h('circle', {
        cx: 60, cy: 60, r, fill: 'none', stroke: 'var(--success)', 'stroke-width': 10, 'stroke-linecap': 'round',
        'stroke-dasharray': `${filled} ${c - filled}`,
      })),
    h('div', { class: 'ring-label' },
      h('span', { class: 'ring-value' }, `${percent}%`),
      h('span', { class: 'xs muted' }, 'selesai')));
}

export function DashboardPage() {
  const wrap = h('div', { class: 'stack-lg' });
  wrap.__load = load;
  load();
  async function load() {
    wrap.replaceChildren(LoadingState('Memuat dashboard…'));
    try {
      const user = authService.getSession()?.user;
      const [tasks, subjects, activities, profile] = await Promise.all([
        taskService.list(), subjectService.list(), dataService.activities(), authService.getProfile(user.id),
      ]);
      wrap.replaceChildren(render(tasks, subjects, activities, profile, user));
    } catch (err) {
      console.error(err);
      wrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat dashboard.', load));
    }
  }

  function render(tasks, subjects, activities, profile, user) {
    const s = computeStats(tasks);
    const todayList = tasksDueToday(tasks);
    const subjName = (id) => subjects.find((x) => x.id === id)?.name || 'Tanpa kategori';
    const subjColor = (id) => subjects.find((x) => x.id === id)?.color || '#64748B';

    if (tasks.length === 0) {
      return h('div', { class: 'stack-lg' },
        greeting(profile, user),
        h('div', { class: 'card' },
          EmptyState({
            iconName: 'plus',
            title: 'Selamat datang di TaskMate!',
            message: 'Belum ada tugas tersimpan. Buat tugas pertama Anda dan biarkan TaskMate mengingatkan tenggatnya.',
            actions: [
              h('button', { class: 'btn btn-primary', onClick: () => navigate('/tugas/baru') }, icon('plus', 16), 'Tambah Tugas Pertama'),
              h('button', { class: 'btn', onClick: () => navigate('/mata-pelajaran') }, icon('book', 16), 'Buat Mata Pelajaran'),
            ],
          })));
    }

    const berikut = s.berikutnya;

    return h('div', { class: 'stack-lg' },
      greeting(profile, user),

      h('div', { class: 'grid grid-4' },
        statCard('calendar', 'var(--primary)', s.hariIni, 'Tugas hari ini'),
        statCard('clock', 'var(--warning)', s.belumSelesai, 'Belum selesai'),
        statCard('check', 'var(--success)', s.selesai, 'Tugas selesai'),
        statCard('alert', 'var(--danger)', s.terlambat, 'Terlambat')),

      h('div', { class: 'grid grid-main' },
        h('div', { class: 'stack-lg' },
          h('div', { class: 'card card-flush' },
            h('div', { style: 'padding:var(--sp-4) var(--sp-4) 0' },
              h('div', { class: 'card-head' },
                h('div', {},
                  h('div', { class: 'card-title' }, 'Tugas Hari Ini'),
                  h('div', { class: 'xs muted' }, `${todayList.length} tugas jatuh tempo hari ini`)),
                h('button', { class: 'btn btn-sm', onClick: () => navigate('/tugas', { tab: 'hari-ini' }) }, 'Lihat semua'))),
            todayList.length === 0
              ? h('div', { class: 'state-box', style: 'padding:var(--sp-5)' }, h('p', { class: 'small' }, 'Tidak ada tugas yang jatuh tempo hari ini. Manfaatkan untuk mengerjakan tugas mendatang.'))
              : h('div', { class: 'task-list' },
                todayList.slice(0, 6).map((t) => TaskCard({
                  task: t, subjectName: subjName, subjectColor: subjColor,
                  onOpen: (task) => navigate(`/tugas/${task.id}`),
                  onToggle: handleToggle,
                })))),

          h('div', { class: 'card card-flush' },
            h('div', { style: 'padding:var(--sp-4) var(--sp-4) 0' },
              h('div', { class: 'card-head' },
                h('div', { class: 'card-title' }, 'Tugas Terbaru Diubah'),
                h('button', { class: 'btn btn-sm', onClick: () => navigate('/tugas') }, 'Semua tugas'))),
            h('div', { class: 'task-list' },
              tasks.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 4)
                .map((t) => TaskCard({
                  task: t, subjectName: subjName, subjectColor: subjColor,
                  onOpen: (task) => navigate(`/tugas/${task.id}`), onToggle: handleToggle,
                })))),

        h('div', { class: 'stack-lg' },
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Progres Penyelesaian')),
            h('div', { class: 'row', style: 'gap:var(--sp-5)' },
              progressRing(s.progres),
              h('div', { class: 'stack grow' },
                h('div', { class: 'row-between small' }, h('span', { class: 'muted' }, 'Total tugas'), h('strong', {}, String(s.total))),
                h('div', { class: 'row-between small' }, h('span', { class: 'muted' }, 'Selesai'), h('strong', { style: 'color:var(--success)' }, String(s.selesai))),
                h('div', { class: 'row-between small' }, h('span', { class: 'muted' }, 'Belum selesai'), h('strong', { style: 'color:var(--warning)' }, String(s.belumSelesai))),
                h('div', { class: 'row-between small' }, h('span', { class: 'muted' }, 'Terlambat'), h('strong', { style: 'color:var(--danger)' }, String(s.terlambat))))))),

          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Tenggat Terdekat')),
            berikut
              ? h('button', {
                class: 'deadline-item', style: 'width:100%;background:none;border:none;cursor:pointer;color:inherit;font:inherit;text-align:left',
                onClick: () => navigate(`/tugas/${berikut.id}`),
              },
                h('div', { class: `deadline-time ${isOverdue(berikut) ? 'overdue' : ''}` },
                  h('div', {}, localTimeKey(berikut.due_at)),
                  h('div', { class: 'xs', style: 'font-weight:500;opacity:.85' }, formatRingkas(berikut.due_at).split(',')[0])),
                h('div', { class: 'grow' },
                  h('div', { class: 'small bold' }, berikut.title),
                  h('div', { class: 'xs muted', style: 'margin-top:2px' }, subjName(berikut.subject_id), ' • ', sisaWaktu(berikut.due_at)),
                  h('span', { class: `badge ${priorityInfo(berikut.priority).badge}`, style: 'margin-top:6px' }, priorityInfo(berikut.priority).label)))
              : h('p', { class: 'small muted' }, 'Semua tugas sudah selesai. Kerja bagus!')),

          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Aktivitas Terbaru')),
            activities.length === 0
              ? h('p', { class: 'small muted' }, 'Belum ada aktivitas tercatat.')
              : h('div', {},
                activities.slice(0, 6).map((a) => h('div', { class: 'activity-item' },
                  h('div', { class: 'activity-icon' }, icon(a.type === 'task' ? 'check' : a.type === 'subject' ? 'book' : 'info', 14)),
                  h('div', { class: 'grow' },
                    h('div', { class: 'small' }, a.message),
                    h('div', { class: 'xs muted' }, new Date(a.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))))))),

          h('button', { class: 'btn btn-primary btn-block', onClick: () => navigate('/tugas/baru') }, icon('plus', 16), 'Tambah Tugas'))));
  }

  function greeting(profile, user) {
    const jam = new Date().getHours();
    const sapa = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    const nama = profile?.full_name || user?.email?.split('@')[0] || 'Siswa';
    return h('div', { class: 'card greeting-card' },
      h('div', { class: 'row-between wrap' },
        h('div', {},
          h('h1', { style: 'font-size:22px' }, `${sapa}, ${nama}!`),
          h('p', { class: 'small muted', style: 'margin-top:4px' }, formatTanggal(new Date()))),
        h('button', { class: 'btn btn-primary', onClick: () => navigate('/tugas/baru') }, icon('plus', 16), 'Tambah Tugas')));
  }

  async function handleToggle(task, done) {
    try {
      if (done) {
        const ok = await confirmDialog({
          title: 'Tandai selesai?',
          message: `Tugas "${task.title}" akan ditandai sebagai selesai.`,
          confirmLabel: 'Ya, selesaikan',
        });
        if (!ok) return;
      }
      await taskService.setDone(task.id, done);
      toastSuccess(done ? 'Tugas ditandai selesai.' : 'Tugas dikembalikan ke belum selesai.');
      load();
    } catch (err) {
      toastError(err?.message || 'Gagal memperbarui tugas.');
      load();
    }
  }

  return wrap;
}
