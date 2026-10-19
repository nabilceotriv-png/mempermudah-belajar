// Validasi formulir ringan (adaptasi Zod tanpa build step).
// Setiap skema: { field: [ validators ] }, pesan error dalam Bahasa Indonesia.

export const messages = {
  required: 'Kolom ini wajib diisi.',
  email: 'Format email tidak valid.',
  min: (n) => `Minimal ${n} karakter.`,
  max: (n) => `Maksimal ${n} karakter.`,
  password: 'Minimal 8 karakter, harus mengandung huruf dan angka.',
  time: 'Format waktu tidak valid (HH:MM).',
  date: 'Format tanggal tidak valid (YYYY-MM-DD).',
  match: (label) => `${label} tidak sama.`,
};

export function required(value) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return messages.required;
  return null;
}

export function email(value) {
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim()) ? null : messages.email;
}

export function minLen(n) {
  return (value) => (!value || String(value).trim().length >= n ? null : messages.min(n));
}

export function maxLen(n) {
  return (value) => (!value || String(value).trim().length <= n ? null : messages.max(n));
}

export function passwordOk(value) {
  if (!value) return null;
  const v = String(value);
  return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : messages.password;
}

export function timeOk(value) {
  if (!value) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)) ? null : messages.time;
}

export function dateOk(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? null : messages.date;
}

export function oneOf(list) {
  return (value) => (!value || list.includes(value) ? null : `Pilihan tidak valid: ${value}`);
}

/**
 * validate(values, schema) -> { valid, errors }
 * schema: { fieldName: [fn1, fn2, ...] } ; fn(value, values) -> pesan | null
 */
export function validate(values, schema) {
  const errors = {};
  for (const [field, validators] of Object.entries(schema)) {
    for (const v of validators) {
      const msg = v(values[field], values);
      if (msg) { errors[field] = msg; break; }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Terapkan errors ke elemen form: set aria-invalid + tampilkan pesan. */
export function applyErrors(formEl, errors) {
  clearFieldErrors(formEl);
  for (const [field, msg] of Object.entries(errors)) {
    const input = formEl.querySelector(`[name="${field}"]`);
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const holder = input.closest('.field');
    if (holder && !holder.querySelector('.error')) {
      const err = document.createElement('small');
      err.className = 'error';
      err.textContent = msg;
      holder.appendChild(err);
    }
  }
  const first = formEl.querySelector('[aria-invalid="true"]');
  if (first) first.focus();
}

export function clearFieldErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  formEl.querySelectorAll('.error').forEach((el) => el.remove());
}
