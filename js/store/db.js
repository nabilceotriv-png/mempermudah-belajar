// Mesin penyimpanan lokal (localStorage) — simulasi basis data relasional
// dengan relasi, kepemilikan baris, dan penegakan otorisasi (emulasi RLS).
// Adapter ini adalah fallback bawaan ketika Supabase belum dikonfigurasi.

const PREFIX = 'taskmate:v1:';
const SESSION_KEY = PREFIX + 'session';

const TABLES = ['users', 'profiles', 'subjects', 'tasks', 'reminders', 'user_settings', 'notification_logs', 'activity_logs', 'reset_tokens'];

function readTable(name) {
  if (!TABLES.includes(name)) throw new Error(`Tabel tidak dikenal: ${name}`);
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTable(name, rows) {
  if (!TABLES.includes(name)) throw new Error(`Tabel tidak dikenal: ${name}`);
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(rows));
  } catch (e) {
    const err = new Error('Penyimpanan browser penuh atau diblokir. Data tidak dapat disimpan.');
    err.cause = e;
    throw err;
  }
}

export const db = {
  select(name) { return readTable(name); },
  insert(name, row) {
    const rows = readTable(name);
    rows.push(row);
    writeTable(name, rows);
    return row;
  },
  update(name, id, patch) {
    const rows = readTable(name);
    const i = rows.findIndex((r) => r.id === id || r.user_id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
    writeTable(name, rows);
    return rows[i];
  },
  remove(name, predicate) {
    const rows = readTable(name);
    const kept = rows.filter((r) => !predicate(r));
    writeTable(name, kept);
    return rows.length - kept.length;
  },
  find(name, predicate) { return readTable(name).filter(predicate); },
  findOne(name, predicate) { return readTable(name).find(predicate) || null; },
  clearAll() { for (const t of TABLES) localStorage.removeItem(PREFIX + t); localStorage.removeItem(SESSION_KEY); },
};

export const sessionStore = {
  get() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  },
  set(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clear() { localStorage.removeItem(SESSION_KEY); },
};

/** Penegakan kepemilikan baris (emulasi Row Level Security). */
export function assertOwner(row, userId, label = 'Data') {
  if (!row || row.user_id !== userId) {
    const err = new Error(`${label} tidak ditemukan atau bukan milik Anda.`);
    err.code = 'RLS';
    throw err;
  }
  return row;
}
