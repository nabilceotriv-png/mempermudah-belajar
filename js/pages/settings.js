// Halaman Pengaturan — Profil, Preferensi Pengingat, Kelola Data, Tampilan, Keamanan.
import { h, icon, clear } from '../utils/dom.js';
import { navigate } from '../router.js';
import { authService } from '../services/auth.js';
import { settingsService, dataService, downloadFile, tasksToCsv } from '../services/settings.js';
import { taskService } from '../services/tasks.js';
import { subjectService } from '../services/subjects.js';
import { LoadingState, ErrorState } from '../ui/states.js';
import { confirmDialog } from '../ui/dialog.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { REMINDER_OPTIONS } from '../features/task-domain.js';
import { validate, required, minLen, passwordOk, applyErrors } from '../utils/validation.js';
import { applyTheme, currentTheme } from '../app/theme.js';

const TABS = [
  { id: 'profil', label: 'Profil Saya', iconName: 'user' },
  { id: 'pengingat', label: 'Preferensi Pengingat', iconName: 'bell' },
  { id: 'data', label: 'Kelola Data Tugas', iconName: 'download' },
  { id: 'tampilan', label: 'Preferensi Tampilan', iconName: 'palette' },
  { id: 'keamanan', label: 'Keamanan', iconName: 'eye' },
];

export function SettingsPage({ params }) {
  const activeTab = TABS.some((t) => t.id === params.tab) ? params.tab : 'profil';
  let settings = null;
  let user = null;

  const wrap = h('div', { class: 'stack' });
  const body = h('div', {});
  load();

  async function load() {
    body.replaceChildren(LoadingState('Memuat pengaturan…'));
    try {
      user = authService.getSession()?.user;
      settings = await settingsService.get();
      renderBody();
    } catch (err) {
      console.error(err);
      body.replaceChildren(ErrorState(err?.message || 'Gagal memuat pengaturan.', load));
    }
  }

  function renderBody() {
    const views = {
      profil: profilTab, pengingat: pengingatTab, data: dataTab, tampilan: tampilanTab, keamanan: keamananTab,
    };
    clear(body);
    body.appendChild((views[activeTab] || profilTab)());
  }

  // ---------------- Profil ----------------
  function profilTab() {
    const alertBox = h('div', { class: 'hidden' });
    const nameInput = h('input', { type: 'text', name: 'full_name', value: '', placeholder: 'Nama lengkap Anda' });
    authService.getProfile(user.id).then((p) => { nameInput.value = p?.full_name || ''; }).catch(() => {});

    const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); save(); } },
      alertBox,
      h('div', { class: 'field' }, h('label', {}, 'Nama pengguna ', h('span', { class: 'req' }, '*')), nameInput),
      h('div', { class: 'field' }, h('label', {}, 'Email'), h('input', { type: 'email', value: user.email, disabled: true, 'aria-label': 'Email terdaftar' }),
        h('small', { class: 'hint' }, 'Email tidak dapat diubah setelah akun dibuat.')),
      h('div', { class: 'row', style: 'gap:var(--sp-2)' },
        h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save', 15), 'Simpan Profil')));

    async function save() {
      alertBox.className = 'hidden';
      clear(form.querySelectorAll('.error'));
      const { valid, errors } = validate({ full_name: nameInput.value }, { full_name: [required, minLen(2)] });
      if (!valid) { applyErrors(form, errors); return; }
      try {
        await authService.updateProfile(user.id, { full_name: nameInput.value.trim() });
        toastSuccess('Profil berhasil diperbarui.');
        window.dispatchEvent(new CustomEvent('taskmate:profile-changed'));
      } catch (err) {
        alertBox.className = 'alert alert-danger';
        alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal memperbarui profil.'));
      }
    }

    return card('Profil Saya', 'Perbarui informasi akun Anda.', form);
  }

  // ---------------- Preferensi Pengingat ----------------
  function pengingatTab() {
    const defaultOn = h('input', { type: 'checkbox', checked: settings.notification_preferences?.in_app !== false });
    const browserOn = h('input', { type: 'checkbox', checked: !!settings.notification_preferences?.browser });
    const minutesSel = h('select', {}, REMINDER_OPTIONS.map((o) =>
      h('option', { value: o.value, selected: Number(settings.default_reminder_minutes) === o.value }, o.label)));
    const quietOn = h('input', { type: 'checkbox', checked: !!settings.quiet_hours?.enabled });
    const quietStart = h('input', { type: 'time', value: settings.quiet_hours?.start || '22:00', style: 'width:130px' });
    const quietEnd = h('input', { type: 'time', value: settings.quiet_hours?.end || '06:00', style: 'width:130px' });

    const form = h('form', { class: 'stack', onSubmit: (e) => { e.preventDefault(); save(); } },
      h('div', { class: 'card', style: 'background:var(--card-2)' },
        switchRow('Pengingat in-app aktif', 'Tampilkan pengingat sebagai toast & pusat notifikasi.', defaultOn),
        switchRow('Izinkan notifikasi browser', 'Butuh izin peramban; hanya berjalan selama aplikasi terbuka.', browserOn),
        h('div', { class: 'switch-row' },
          h('div', { class: 'switch-copy' }, h('strong', {}, 'Waktu pengingat default'), h('span', {}, 'Dipakai otomatis saat membuat tugas baru.')),
          minutesSel),
        switchRow('Jam tenang', 'Jangan kirim pengingat pada rentang waktu tertentu.', quietOn),
        h('div', { class: 'switch-row' },
          h('div', { class: 'switch-copy' }, h('strong', {}, 'Rentang jam tenang'), h('span', {}, 'Pengingat akan ditunda sampai jam tenang berakhir.')),
          h('div', { class: 'row' }, quietStart, h('span', { class: 'muted' }, 's.d.'), quietEnd))),
      h('div', {},
        h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save', 15), 'Simpan Preferensi')));

    async function save() {
      try {
        await settingsService.update({
          default_reminder_minutes: Number(minutesSel.value),
          notification_preferences: { in_app: defaultOn.checked, browser: browserOn.checked },
          quiet_hours: { enabled: quietOn.checked, start: quietStart.value || '22:00', end: quietEnd.value || '06:00' },
        });
        settings = await settingsService.get();
        toastSuccess('Preferensi pengingat tersimpan.');
      } catch (err) {
        toastError(err?.message || 'Gagal menyimpan preferensi.');
      }
    }

    return card('Preferensi Pengingat', 'Atur perilaku pengingat dan notifikasi.', form,
      h('div', { class: 'alert alert-info', style: 'margin-top:var(--sp-4)' }, icon('info', 15),
        h('span', {}, 'Pengingat baru dibuat mengikuti waktu pengingat default ini. Untuk pengiriman otomatis saat aplikasi tertutup, hubungkan Supabase (lihat README).')));
  }

  // ---------------- Kelola Data ----------------
  function dataTab() {
    let tasks = [];
    let subjects = [];
    const tableWrap = h('div', {}, LoadingState('Memuat data tugas…'));

    (async () => {
      try {
        [tasks, subjects] = await Promise.all([taskService.list(), subjectService.list()]);
        renderTable();
      } catch (err) {
        tableWrap.replaceChildren(ErrorState(err?.message || 'Gagal memuat data.', () => navigate('/pengaturan/data')));
      }
    })();

    function renderTable() {
      const rows = tasks.slice(0, 50);
      clear(tableWrap);
      tableWrap.appendChild(
        h('div', { class: 'data-table-wrap' },
          h('table', { class: 'data-table' },
            h('thead', {}, h('tr', {},
              ['Judul', 'Mata Pelajaran', 'Tenggat', 'Prioritas', 'Status'].map((th) => h('th', { scope: 'col' }, th)))),
            h('tbody', {},
              rows.length === 0
                ? h('tr', {}, h('td', { colspan: 5, class: 'muted center' }, 'Belum ada tugas tersimpan.'))
                : rows.map((t) => h('tr', {},
                  h('td', {}, t.title),
                  h('td', {}, subjects.find((s) => s.id === t.subject_id)?.name || '—'),
                  h('td', {}, new Date(t.due_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
                  h('td', {}, t.priority),
                  h('td', {}, t.status))))),
          tasks.length > 50 ? h('div', { style: 'padding:8px 12px' }, h('span', { class: 'xs muted' }, `Menampilkan 50 dari ${tasks.length} tugas.`)) : null));
    }

    const actions = h('div', { class: 'row wrap', style: 'gap:var(--sp-2);margin-top:var(--sp-4)' },
      h('button', {
        class: 'btn', disabled: tasks.length === 0,
        onClick: async () => {
          try {
            const data = await dataService.exportAll();
            downloadFile(`taskmate-ekspor-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
            toastSuccess('Ekspor JSON berhasil diunduh.');
          } catch (err) { toastError(err?.message || 'Gagal mengekspor data.'); }
        },
      }, icon('download', 15), 'Ekspor JSON'),
      h('button', {
        class: 'btn', disabled: tasks.length === 0,
        onClick: () => {
          downloadFile(`taskmate-tugas-${new Date().toISOString().slice(0, 10)}.csv`, tasksToCsv(tasks, subjects), 'text/csv');
          toastSuccess('Ekspor CSV berhasil diunduh.');
        },
      }, icon('download', 15), 'Ekspor CSV'),
      h('div', { class: 'grow' }),
      h('button', {
        class: 'btn btn-danger',
        onClick: async () => {
          if (tasks.length === 0) { toastError('Tidak ada tugas untuk dihapus.'); return; }
          const ok = await confirmDialog({
            title: 'Hapus SEMUA tugas?',
            message: `${tasks.length} tugas beserta seluruh jadwal pengingatnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
            confirmLabel: 'Hapus semua', danger: true,
          });
          if (!ok) return;
          try {
            const n = await dataService.deleteAllTasks();
            toastSuccess(`${n} tugas berhasil dihapus permanen.`);
            load();
          } catch (err) { toastError(err?.message || 'Gagal menghapus data.'); }
        },
      }, icon('trash', 15), 'Hapus Semua Tugas'));

    return card('Kelola Data Tugas', 'Lihat, ekspor, atau hapus data tugas Anda.', h('div', {}, tableWrap, actions));
  }

  // ---------------- Tampilan ----------------
  function tampilanTab() {
    const opts = [
      { value: 'dark', label: 'Mode Gelap', desc: 'Tema bawaan TaskMate.', iconName: 'moon' },
      { value: 'light', label: 'Mode Terang', desc: 'Tema terang untuk cahaya bright.', iconName: 'sun' },
      { value: 'system', label: 'Ikuti Sistem', desc: 'Sesuaikan preferensi perangkat.', iconName: 'settings' },
    ];
    let chosen = settings.theme || 'dark';

    const cards = h('div', { class: 'grid grid-3' },
      opts.map((o) => {
        const btn = h('button', {
          class: `card`, style: `text-align:left;cursor:pointer;${chosen === o.value ? 'border-color:var(--primary);background:var(--primary-soft)' : ''}`,
          'aria-pressed': chosen === o.value ? 'true' : 'false',
          onClick: async () => {
            chosen = o.value;
            try {
              await settingsService.update({ theme: o.value });
              settings = await settingsService.get();
              applyTheme(o.value);
              renderBody();
              toastSuccess(`Tema ${o.label} diterapkan.`);
            } catch (err) { toastError(err?.message || 'Gagal menyimpan tema.'); }
          },
        },
          h('div', { class: 'row', style: 'gap:10px' },
            icon(o.iconName, 18),
            h('div', {},
              h('div', { class: 'small bold' }, o.label),
              h('div', { class: 'xs muted' }, o.desc))),
          chosen === o.value ? h('div', { class: 'xs', style: 'color:var(--primary);margin-top:8px;font-weight:700' }, '✓ Aktif') : null);
        return btn;
      }));

    return card('Preferensi Tampilan', 'Tema disimpan pada akun Anda dan berlaku di semua perangkat.', cards);
  }

  // ---------------- Keamanan ----------------
  function keamananTab() {
    const alertBox = h('div', { class: 'hidden' });
    const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); save(); } },
      alertBox,
      h('div', { class: 'field' },
        h('label', {}, 'Kata sandi saat ini ', h('span', { class: 'req' }, '*')),
        h('input', { type: 'password', name: 'current', autocomplete: 'current-password' })),
      h('div', { class: 'field' },
        h('label', {}, 'Kata sandi baru ', h('span', { class: 'req' }, '*')),
        h('input', { type: 'password', name: 'new', autocomplete: 'new-password' }),
        h('small', { class: 'hint' }, 'Minimal 8 karakter, mengandung huruf dan angka.')),
      h('div', { class: 'field' },
        h('label', {}, 'Ulangi kata sandi baru ', h('span', { class: 'req' }, '*')),
        h('input', { type: 'password', name: 'confirm', autocomplete: 'new-password' })),
      h('button', { type: 'submit', class: 'btn btn-primary' }, icon('save', 15), 'Perbarui Kata Sandi'));

    async function save() {
      alertBox.className = 'hidden';
      clear(form.querySelectorAll('.error'));
      const values = { current: form.current.value, new: form.new.value, confirm: form.confirm.value };
      const { valid, errors } = validate(values, {
        current: [required],
        new: [required, passwordOk],
        confirm: [(v) => (v === values.new ? null : 'Kata sandi tidak sama.')],
      });
      if (!valid) { applyErrors(form, errors); return; }
      try {
        await authService.updatePassword({ newPassword: values.new, currentPassword: values.current });
        toastSuccess('Kata sandi berhasil diperbarui.');
        form.reset();
      } catch (err) {
        alertBox.className = 'alert alert-danger';
        alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal memperbarui kata sandi.'));
      }
    }

    return card('Keamanan', 'Perbarui kata sandi atau keluar dari akun.', h('div', { class: 'stack-lg' }, form,
      h('div', { class: 'card', style: 'background:var(--card-2)' },
        h('div', { class: 'switch-row', style: 'padding-top:0' },
          h('div', { class: 'switch-copy' }, h('strong', {}, 'Keluar dari akun'), h('span', {}, 'Sesi aktif akan dihapus dari perangkat ini.')),
          h('button', {
            class: 'btn btn-danger',
            onClick: async () => {
              const ok = await confirmDialog({ title: 'Keluar dari akun?', message: 'Anda perlu masuk kembali untuk mengakses data tugas.', confirmLabel: 'Ya, keluar', danger: true });
              if (!ok) return;
              await authService.signOut();
              toastSuccess('Anda telah keluar.');
              navigate('/masuk', {}, { replace: true });
              window.dispatchEvent(new CustomEvent('taskmate:auth-changed'));
            },
          }, icon('logout', 15), 'Keluar')))));
  }

  function card(title, subtitle, ...content) {
    return h('div', { class: 'card stack-lg' },
      h('div', {}, h('h2', {}, title), h('p', { class: 'small muted', style: 'margin-top:4px' }, subtitle)),
      ...content);
  }

  wrap.append(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Pengaturan'), h('p', {}, 'Kelola profil, preferensi, data, dan keamanan akun Anda.'))),
    h('div', { class: 'settings-layout' },
      h('nav', { class: 'settings-nav', 'aria-label': 'Bagian pengaturan' },
        TABS.map((t) => h('a', {
          class: `nav-item ${activeTab === t.id ? 'active' : ''}`,
          href: `#/pengaturan/${t.id}`, 'aria-current': activeTab === t.id ? 'page' : null,
        }, icon(t.iconName, 17), h('span', {}, t.label)))),
      body));
  return wrap;
}
