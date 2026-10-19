// Halaman autentikasi: Masuk, Registrasi, Lupa Kata Sandi, Reset Kata Sandi.
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { authService } from '../services/auth.js';
import { validate, required, email as emailRule, passwordOk, minLen, applyErrors } from '../utils/validation.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { storageMode } from '../store/index.js';

function authShell(title, subtitle, ...children) {
  return h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-card' },
      h('div', { class: 'auth-brand' },
        h('div', { class: 'brand-mark' }, icon('target', 20)),
        h('div', { class: 'brand-text' },
          h('span', { class: 'brand-name' }, 'TaskMate'),
          h('span', { class: 'brand-sub' }, 'Pengingat Tugas Siswa'))),
      h('h1', { style: 'font-size:20px;margin-bottom:4px' }, title),
      h('p', { class: 'small muted', style: 'margin-bottom:var(--sp-5)' }, subtitle),
      ...children));
}

function submitButton(label) {
  const btn = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, label);
  btn.__setLoading = (state) => {
    btn.disabled = state;
    btn.replaceChildren(state ? [h('span', { class: 'spinner' }), 'Memproses…'] : [label]);
  };
  return btn;
}

function localModeNotice() {
  return storageMode === 'local'
    ? h('div', { class: 'alert alert-info', style: 'margin-bottom:var(--sp-4)' }, icon('info', 15),
      h('span', {}, 'Mode penyimpanan lokal aktif (data tersimpan di peramban ini). Untuk autentikasi produksi, hubungkan Supabase — lihat README.'))
    : null;
}

// =================== LOGIN ===================
export function LoginPage() {
  const alertBox = h('div', { class: 'hidden', style: 'margin-bottom:var(--sp-4)' });
  const btn = submitButton('Masuk');

  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } },
    alertBox,
    localModeNotice(),
    h('div', { class: 'field' },
      h('label', {}, 'Email ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'email', name: 'email', autocomplete: 'email', placeholder: 'nama@sekolah.sch.id' })),
    h('div', { class: 'field' },
      h('label', {}, 'Kata sandi ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'password', name: 'password', autocomplete: 'current-password', placeholder: 'Kata sandi Anda' })),
    btn,
    h('div', { class: 'row-between', style: 'margin-top:4px' },
      h('a', { href: '#/lupa-sandi', class: 'small' }, 'Lupa kata sandi?'),
      h('a', { href: '#/daftar', class: 'small' }, 'Belum punya akun? Daftar')));

  async function submit() {
    alertBox.className = 'hidden';
    clearErrors();
    const values = { email: form.email.value, password: form.password.value };
    const { valid, errors } = validate(values, { email: [required, emailRule], password: [required] });
    if (!valid) { applyErrors(form, errors); return; }
    btn.__setLoading(true);
    try {
      await authService.signIn(values);
      toastSuccess('Berhasil masuk. Selamat datang kembali!');
      navigate('/dashboard', {}, { replace: true });
    } catch (err) {
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal masuk. Periksa email dan kata sandi Anda.'));
      btn.__setLoading(false);
    }
  }
  function clearErrors() { form.querySelectorAll('.error').forEach((e) => e.remove()); form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid')); }

  return authShell('Masuk ke akun Anda', 'Kelola tugas sekolah dengan lebih teratur.', form);
}

// =================== REGISTRASI ===================
export function RegisterPage() {
  const alertBox = h('div', { class: 'hidden', style: 'margin-bottom:var(--sp-4)' });
  const btn = submitButton('Buat Akun');

  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } },
    alertBox,
    localModeNotice(),
    h('div', { class: 'field' },
      h('label', {}, 'Nama lengkap ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'text', name: 'full_name', autocomplete: 'name', placeholder: 'Contoh: Siti Rahma' })),
    h('div', { class: 'field' },
      h('label', {}, 'Email ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'email', name: 'email', autocomplete: 'email', placeholder: 'nama@sekolah.sch.id' })),
    h('div', { class: 'field' },
      h('label', {}, 'Kata sandi ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'password', name: 'password', autocomplete: 'new-password', placeholder: 'Minimal 8 karakter, huruf & angka' }),
      h('small', { class: 'hint' }, 'Gunakan minimal 8 karakter yang mengandung huruf dan angka.')),
    h('div', { class: 'field' },
      h('label', {}, 'Ulangi kata sandi ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'password', name: 'confirm', autocomplete: 'new-password', placeholder: 'Ketik ulang kata sandi' })),
    btn);

  async function submit() {
    alertBox.className = 'hidden';
    form.querySelectorAll('.error').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    const values = {
      full_name: form.full_name.value, email: form.email.value,
      password: form.password.value, confirm: form.confirm.value,
    };
    const { valid, errors } = validate(values, {
      full_name: [required, minLen(2)],
      email: [required, emailRule],
      password: [required, passwordOk],
      confirm: [(v) => (v === values.password ? null : 'Kata sandi tidak sama.')],
    });
    if (!valid) { applyErrors(form, errors); return; }
    btn.__setLoading(true);
    try {
      await authService.signUp({ email: values.email, password: values.password, fullName: values.full_name });
      toastSuccess('Akun berhasil dibuat. Selamat datang di TaskMate!');
      navigate('/dashboard', {}, { replace: true });
    } catch (err) {
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal membuat akun. Coba lagi.'));
      btn.__setLoading(false);
    }
  }

  return authShell('Buat akun baru', 'Gratis untuk siswa. Mulai kelola tugas hari ini.', form,
    h('p', { class: 'auth-alt' }, 'Sudah punya akun? ', h('a', { href: '#/masuk' }, 'Masuk')));
}

// =================== LUPA KATA SANDI ===================
export function ForgotPage() {
  const alertBox = h('div', { class: 'hidden', style: 'margin-bottom:var(--sp-4)' });
  const successBox = h('div', { class: 'hidden', style: 'margin-bottom:var(--sp-4)' });
  const btn = submitButton('Kirim Link Pemulihan');

  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } },
    alertBox, successBox,
    localModeNotice(),
    h('div', { class: 'field' },
      h('label', {}, 'Email ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'email', name: 'email', autocomplete: 'email', placeholder: 'nama@sekolah.sch.id' })),
    btn);

  async function submit() {
    alertBox.className = 'hidden'; successBox.className = 'hidden';
    form.querySelectorAll('.error').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    const email = form.email.value;
    const { valid, errors } = validate({ email }, { email: [required, emailRule] });
    if (!valid) { applyErrors(form, errors); return; }
    btn.__setLoading(true);
    try {
      const res = await authService.requestPasswordReset(email);
      if (res?.token) {
        // Mode lokal: tidak ada email keluar; token ditampilkan langsung.
        successBox.className = 'alert alert-success';
        successBox.replaceChildren(icon('check', 15),
          h('div', {},
            h('strong', {}, 'Token pemulihan dibuat:'),
            h('p', { class: 'xs', style: 'margin:4px 0' }, 'Dalam mode penyimpanan lokal, email tidak dikirim. Salin token ini lalu lanjutkan ke halaman reset.'),
            h('div', { class: 'reset-token-box' }, res.token),
            h('button', {
              class: 'btn btn-sm', style: 'margin-top:8px',
              onClick: () => { navigate('/reset-sandi', { token: res.token }); },
            }, 'Lanjut ke reset kata sandi')));
      } else {
        successBox.className = 'alert alert-success';
        successBox.replaceChildren(icon('check', 15), h('span', {}, 'Jika email terdaftar, link pemulihan telah dikirim. Periksa kotak masuk email Anda.'));
      }
      btn.__setLoading(false);
    } catch (err) {
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal memproses permintaan pemulihan.'));
      btn.__setLoading(false);
    }
  }

  return authShell('Lupa kata sandi?', 'Masukkan email Anda untuk membuat kata sandi baru.', form,
    h('p', { class: 'auth-alt' }, h('a', { href: '#/masuk' }, 'Kembali ke halaman masuk')));
}

// =================== RESET KATA SANDI ===================
export function ResetPage({ query }) {
  const alertBox = h('div', { class: 'hidden', style: 'margin-bottom:var(--sp-4)' });
  const btn = submitButton('Simpan Kata Sandi Baru');
  const tokenInput = h('input', { type: 'text', name: 'token', value: query.token || '', placeholder: 'Token pemulihan dari email/lupa sandi', style: 'font-family:monospace' });

  const form = h('form', { class: 'stack', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } },
    alertBox,
    localModeNotice(),
    h('div', { class: 'field' },
      h('label', {}, 'Token pemulihan ', h('span', { class: 'req' }, '*')), tokenInput),
    h('div', { class: 'field' },
      h('label', {}, 'Kata sandi baru ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'password', name: 'password', autocomplete: 'new-password', placeholder: 'Minimal 8 karakter, huruf & angka' })),
    h('div', { class: 'field' },
      h('label', {}, 'Ulangi kata sandi baru ', h('span', { class: 'req' }, '*')),
      h('input', { type: 'password', name: 'confirm', autocomplete: 'new-password' })),
    btn);

  async function submit() {
    alertBox.className = 'hidden';
    form.querySelectorAll('.error').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    const values = { token: tokenInput.value, password: form.password.value, confirm: form.confirm.value };
    const { valid, errors } = validate(values, {
      token: [required],
      password: [required, passwordOk],
      confirm: [(v) => (v === values.password ? null : 'Kata sandi tidak sama.')],
    });
    if (!valid) { applyErrors(form, errors); return; }
    btn.__setLoading(true);
    try {
      await authService.completePasswordReset({ token: values.token, password: values.password });
      toastSuccess('Kata sandi berhasil diperbarui. Silakan masuk.');
      navigate('/masuk', {}, { replace: true });
    } catch (err) {
      alertBox.className = 'alert alert-danger';
      alertBox.replaceChildren(icon('alert', 15), h('span', {}, err?.message || 'Gagal mereset kata sandi. Token mungkin kedaluwarsa.'));
      btn.__setLoading(false);
    }
  }

  return authShell('Buat kata sandi baru', 'Masukkan token pemulihan dan kata sandi baru Anda.', form);
}
