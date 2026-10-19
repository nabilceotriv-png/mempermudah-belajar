// Pemilih adapter & lapisan sesi pengguna bersama.
import { getConfig } from '../utils/misc.js';
import { localAdapter } from './local-adapter.js';
import { supabaseAdapter } from './supabase-adapter.js';

const config = getConfig();

/** Adapter aktif: Supabase bila dikonfigurasi, selain itu penyimpanan lokal. */
export const adapter = config.mode === 'supabase' ? supabaseAdapter : localAdapter;
export const storageMode = adapter.mode;

// ---------- Bus perubahan sesi ----------
const listeners = new Set();
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emitAuth() { for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } }

let cachedSession = adapter.getSession();

export const session = {
  get() { return cachedSession; },
  async set(s) { cachedSession = s; emitAuth(); },
  clear() { cachedSession = null; emitAuth(); },
  refresh() { cachedSession = adapter.getSession(); return cachedSession; },
};

/** Ambil ID pengguna aktif atau lempar error sesi berakhir. */
export function requireUserId() {
  cachedSession = adapter.getSession();
  if (!cachedSession?.user?.id) {
    const e = new Error('Sesi Anda berakhir. Silakan masuk kembali.');
    e.code = 'SESSION_EXPIRED';
    throw e;
  }
  return cachedSession.user.id;
}

/** Bungkus pemanggilan adapter: responsif terhadap sesi kedaluwarsa. */
export async function withUser(fn) {
  const userId = requireUserId();
  try {
    return await fn(userId);
  } catch (err) {
    if (err?.status === 401 || err?.code === 'SESSION_EXPIRED') {
      session.clear();
    }
    throw err;
  }
}
