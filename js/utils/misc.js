// Utilitas ID & konfigurasi
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Konfigurasi runtime.
 * Mode lokal (bawaan): adapter penyimpanan lokal di browser (localStorage).
 * Mode Supabase: isi window.__TASKMATE_ENV__ (lihat .env.example / README).
 */
export function getConfig() {
  const env = (typeof window !== 'undefined' && window.__TASKMATE_ENV__) || {};
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || '';
  return {
    supabaseUrl,
    supabaseAnonKey,
    mode: supabaseUrl && supabaseAnonKey ? 'supabase' : 'local',
  };
}
