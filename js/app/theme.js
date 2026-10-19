// Modul tema: dark mode bawaan, light mode opsional, ikut sistem bila dipilih.
const KEY = 'taskmate:v1:theme';

export function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(pref) {
  const effective = pref === 'system' ? systemTheme() : (pref === 'light' ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', effective);
  try { localStorage.setItem(KEY, pref || 'dark'); } catch { /* abaikan */ }
  return effective;
}

export function currentTheme() {
  try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; }
}

/** Ganti cepat dark <-> light (dipakai tombol header). */
export function quickToggleTheme() {
  const eff = document.documentElement.getAttribute('data-theme');
  const next = eff === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

// Terapkan preferensi sistem bila pengguna memilih "system".
window.matchMedia?.('(prefers-color-scheme: light)')?.addEventListener?.('change', () => {
  if (currentTheme() === 'system') applyTheme('system');
});
