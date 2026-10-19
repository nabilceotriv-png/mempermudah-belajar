// Adapter penyimpanan lokal — meniru kontrak API Supabase
// (autentikasi, tabel, RLS) agar dapat ditukar tanpa mengubah lapisan layanan.
// PERHATIAN: untuk penggunaan produksi nyata, gunakan adapter Supabase
// (lihat js/store/supabase-adapter.js dan supabase/migrations).

import { db, sessionStore, assertOwner } from './db.js';
import { uid } from '../utils/misc.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari
const now = () => new Date().toISOString();

// ---------- Kriptografi kata sandi (WebCrypto, PBKDF2-SHA256) ----------
const enc = new TextEncoder();

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

async function hashPassword(password, saltB64, iterations = 120000) {
  const salt = saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256
  );
  return { salt: bufToB64(salt), hash: bufToB64(bits), iterations };
}

async function verifyPassword(password, stored) {
  const { hash } = await hashPassword(password, stored.salt, stored.iterations);
  return hash === stored.hash;
}

// ---------- Manajemen sesi ----------
function makeSession(userId) {
  return { token: uid(), user_id: userId, expires_at: Date.now() + SESSION_TTL_MS };
}

function currentSession() {
  const s = sessionStore.get();
  if (!s) return null;
  if (s.expires_at < Date.now()) { sessionStore.clear(); return null; }
  return s;
}

function authError(msg) {
  const e = new Error(msg);
  e.code = 'AUTH';
  return e;
}

// ---------- Emulasi RLS ----------
function scoped(table, userId) {
  const rows = db.find(table, (r) => r.user_id === userId);
  return rows;
}

function logActivity(userId, type, message, refId = null) {
  db.insert('activity_logs', { id: uid(), user_id: userId, type, message, ref_id: refId, created_at: now() });
}

function ensureDefaultSettings(userId) {
  if (!db.findOne('user_settings', (r) => r.user_id === userId)) {
    db.insert('user_settings', {
      id: uid(), user_id: userId,
      theme: 'dark',
      default_reminder_minutes: 60,
      notification_preferences: { in_app: true, browser: false },
      quiet_hours: { enabled: false, start: '22:00', end: '06:00' },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
      updated_at: now(), created_at: now(),
    });
  }
}

export const localAdapter = {
  mode: 'local',

  // =================== AUTENTIKASI ===================
  async signUp({ email, password, fullName }) {
    const normEmail = String(email).trim().toLowerCase();
    if (db.findOne('users', (u) => u.email === normEmail)) {
      throw authError('Email sudah terdaftar. Gunakan email lain atau masuk ke akun Anda.');
    }
    const pw = await hashPassword(password);
    const user = { id: uid(), email: normEmail, password: pw, created_at: now() };
    db.insert('users', user);
    db.insert('profiles', { id: uid(), user_id: user.id, full_name: fullName.trim(), created_at: now(), updated_at: now() });
    ensureDefaultSettings(user.id);
    const session = makeSession(user.id);
    sessionStore.set(session);
    return { session, user: { id: user.id, email: normEmail }, profile: { full_name: fullName.trim() } };
  },

  async signIn({ email, password }) {
    const normEmail = String(email).trim().toLowerCase();
    const user = db.findOne('users', (u) => u.email === normEmail);
    if (!user || !(await verifyPassword(password, user.password))) {
      throw authError('Email atau kata sandi salah.');
    }
    const session = makeSession(user.id);
    sessionStore.set(session);
    ensureDefaultSettings(user.id);
    return { session, user: { id: user.id, email: normEmail } };
  },

  async signOut() { sessionStore.clear(); },

  getSession() {
    const s = currentSession();
    if (!s) return null;
    const user = db.findOne('users', (u) => u.id === s.user_id);
    if (!user) { sessionStore.clear(); return null; }
    return { ...s, user: { id: user.id, email: user.email } };
  },

  async updatePassword({ newPassword, currentPassword }) {
    const s = this.getSession();
    if (!s) throw authError('Sesi Anda berakhir. Silakan masuk kembali.');
    const user = db.findOne('users', (u) => u.id === s.user.id);
    if (currentPassword && !(await verifyPassword(currentPassword, user.password))) {
      throw authError('Kata sandi saat ini tidak sesuai.');
    }
    user.password = await hashPassword(newPassword);
    const rows = db.select('users');
    const i = rows.findIndex((u) => u.id === user.id);
    rows[i] = user;
    localStorage.setItem('taskmate:v1:users', JSON.stringify(rows));
    logActivity(user.id, 'security', 'Kata sandi diperbarui.');
    return true;
  },

  // Alur pemulihan lokal: tanpa email, token ditampilkan langsung (mode demo).
  requestPasswordReset({ email }) {
    const normEmail = String(email).trim().toLowerCase();
    const user = db.findOne('users', (u) => u.email === normEmail);
    if (!user) throw authError('Email tidak terdaftar.');
    const token = uid();
    db.insert('reset_tokens', { id: uid(), user_id: user.id, token, used: false, created_at: now(), expires_at: Date.now() + 1000 * 60 * 30 });
    return { token, email: normEmail };
  },

  async completePasswordReset({ token, password }) {
    const rec = db.findOne('reset_tokens', (t) => t.token === String(token).trim() && !t.used && t.expires_at > Date.now());
    if (!rec) throw authError('Token pemulihan tidak valid atau kedaluwarsa.');
    const rows = db.select('reset_tokens');
    const i = rows.findIndex((r) => r.id === rec.id);
    rows[i].used = true;
    localStorage.setItem('taskmate:v1:reset_tokens', JSON.stringify(rows));
    const user = db.findOne('users', (u) => u.id === rec.user_id);
    user.password = await hashPassword(password);
    const urows = db.select('users');
    urows[urows.findIndex((u) => u.id === user.id)] = user;
    localStorage.setItem('taskmate:v1:users', JSON.stringify(urows));
    return true;
  },

  // =================== PROFIL ===================
  getProfile(userId) {
    const p = db.findOne('profiles', (r) => r.user_id === userId);
    return p ? { full_name: p.full_name } : { full_name: '' };
  },

  updateProfile(userId, { full_name }) {
    const p = db.findOne('profiles', (r) => r.user_id === userId);
    if (!p) throw new Error('Profil tidak ditemukan.');
    db.update('profiles', p.id, { full_name: String(full_name).trim() });
    logActivity(userId, 'profile', 'Profil diperbarui.');
    return this.getProfile(userId);
  },

  // =================== MATA PELAJARAN ===================
  listSubjects(userId) {
    return scoped('subjects', userId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  },

  createSubject(userId, { name, color }) {
    const clean = String(name || '').trim();
    if (!clean) { const e = new Error('Nama mata pelajaran wajib diisi.'); e.field = 'name'; throw e; }
    if (scoped('subjects', userId).some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      const e = new Error('Mata pelajaran dengan nama tersebut sudah ada.'); e.field = 'name'; throw e;
    }
    const row = { id: uid(), user_id: userId, name: clean, color: color || '#60A5FA', created_at: now(), updated_at: now() };
    db.insert('subjects', row);
    logActivity(userId, 'subject', `Mata pelajaran "${clean}" ditambahkan.`);
    return row;
  },

  updateSubject(userId, id, patch) {
    const row = db.findOne('subjects', (s) => s.id === id);
    assertOwner(row, userId, 'Mata pelajaran');
    if (patch.name !== undefined) {
      const clean = String(patch.name).trim();
      if (!clean) { const e = new Error('Nama mata pelajaran wajib diisi.'); e.field = 'name'; throw e; }
      patch.name = clean;
    }
    const updated = db.update('subjects', id, patch);
    logActivity(userId, 'subject', `Mata pelajaran "${updated.name}" diperbarui.`);
    return updated;
  },

  /** Hapus mata pelajaran. Mengembalikan daftar tugas yang masih terkait. */
  subjectTasks(userId, subjectId) {
    return scoped('tasks', userId).filter((t) => t.subject_id === subjectId);
  },

  deleteSubject(userId, id, { reassignTo = null, deleteTasks = false } = {}) {
    const row = db.findOne('subjects', (s) => s.id === id);
    assertOwner(row, userId, 'Mata pelajaran');
    const related = this.subjectTasks(userId, id);
    if (deleteTasks) {
      for (const t of related) db.remove('reminders', (r) => r.task_id === t.id);
      db.remove('tasks', (t) => t.subject_id === id && t.user_id === userId);
    } else if (reassignTo) {
      assertOwner(db.findOne('subjects', (s) => s.id === reassignTo), userId, 'Mata pelajaran tujuan');
      for (const t of related) db.update('tasks', t.id, { subject_id: reassignTo });
    }
    db.remove('subjects', (s) => s.id === id && s.user_id === userId);
    logActivity(userId, 'subject', `Mata pelajaran "${row.name}" dihapus.`);
    return { deleted: true, affected: related.length };
  },

  // =================== TUGAS ===================
  listTasks(userId) {
    return scoped('tasks', userId).slice().sort((a, b) => (a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0));
  },

  getTask(userId, id) {
    const row = db.findOne('tasks', (t) => t.id === id);
    assertOwner(row, userId, 'Tugas');
    return row;
  },

  createTask(userId, data) {
    if (data.subject_id) {
      const subject = db.findOne('subjects', (s) => s.id === data.subject_id);
      assertOwner(subject, userId, 'Mata pelajaran');
    }
    const row = {
      id: uid(),
      user_id: userId,
      subject_id: data.subject_id,
      title: String(data.title).trim(),
      description: String(data.description || '').trim(),
      due_at: data.due_at,
      priority: data.priority,
      status: data.status || 'belum',
      reminder_enabled: data.reminder_enabled !== false,
      reminder_minutes_before: Number.isFinite(data.reminder_minutes_before) ? data.reminder_minutes_before : 60,
      created_at: now(),
      updated_at: now(),
      completed_at: data.status === 'selesai' ? now() : null,
    };
    db.insert('tasks', row);
    logActivity(userId, 'task', `Tugas "${row.title}" ditambahkan.`, row.id);
    return row;
  },

  updateTask(userId, id, data) {
    const row = this.getTask(userId, id);
    if (data.subject_id) assertOwner(db.findOne('subjects', (s) => s.id === data.subject_id), userId, 'Mata pelajaran');
    const patch = { ...data, updated_at: now() };
    if (data.status === 'selesai' && row.status !== 'selesai') patch.completed_at = now();
    if (data.status && data.status !== 'selesai') patch.completed_at = null;
    if (data.title !== undefined) patch.title = String(data.title).trim();
    if (data.description !== undefined) patch.description = String(data.description || '').trim();
    return db.update('tasks', id, patch);
  },

  deleteTask(userId, id) {
    const row = this.getTask(userId, id);
    db.remove('reminders', (r) => r.task_id === id);
    db.remove('tasks', (t) => t.id === id);
    logActivity(userId, 'task', `Tugas "${row.title}" dihapus.`, id);
    return { deleted: true };
  },

  // =================== PENGINGAT ===================
  listReminders(userId) {
    return scoped('reminders', userId).slice().sort((a, b) => (a.remind_at < b.remind_at ? -1 : 1));
  },

  listNotificationLogs(userId) {
    return scoped('notification_logs', userId).slice().sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  },

  /**
   * Sinkronkan pengingat sebuah tugas dengan tenggat & preferensinya.
   * Mencegah notifikasi ganda: baris yang sudah terkirim tidak disentuh,
   * hanya baris yang belum terkirim yang diperbarui/dihapus/dibuat.
   */
  syncReminders(userId, task) {
    assertOwner(task, userId, 'Tugas');
    const existing = db.find('reminders', (r) => r.task_id === task.id);
    if (!task.reminder_enabled) {
      for (const r of existing.filter((r) => !r.sent_at)) db.remove('reminders', (x) => x.id === r.id);
      return;
    }
    const target = new Date(task.due_at).getTime() - task.reminder_minutes_before * 60000;
    const targetIso = new Date(target).toISOString();
    const unsent = existing.filter((r) => !r.sent_at);
    if (unsent.length > 0) {
      const first = unsent[0];
      db.update('reminders', first.id, { remind_at: targetIso, is_enabled: true });
      for (const extra of unsent.slice(1)) db.remove('reminders', (x) => x.id === extra.id);
    } else if (!existing.some((r) => r.remind_at === targetIso)) {
      db.insert('reminders', {
        id: uid(), task_id: task.id, user_id: userId, remind_at: targetIso,
        is_enabled: true, sent_at: null, read_at: null, created_at: now(),
      });
    }
  },

  updateReminder(userId, id, patch) {
    const row = db.findOne('reminders', (r) => r.id === id);
    assertOwner(row, userId, 'Pengingat');
    return db.update('reminders', id, patch);
  },

  markReminderSent(userId, id) {
    return this.updateReminder(userId, id, { sent_at: now() });
  },

  logNotification(userId, { task_id, title, body, remind_at }) {
    // Cegah duplikasi: satu log per tugas + waktu pengingat.
    const dup = db.findOne('notification_logs', (n) => n.task_id === task_id && n.remind_at === remind_at);
    if (dup) return dup;
    const row = {
      id: uid(), user_id: userId, task_id, title, body, remind_at,
      sent_at: now(), read_at: null, created_at: now(),
    };
    db.insert('notification_logs', row);
    return row;
  },

  markNotificationRead(userId, id) {
    const row = db.findOne('notification_logs', (n) => n.id === id);
    assertOwner(row, userId, 'Notifikasi');
    const rows = db.select('notification_logs');
    const i = rows.findIndex((r) => r.id === id);
    rows[i].read_at = now();
    localStorage.setItem('taskmate:v1:notification_logs', JSON.stringify(rows));
    return rows[i];
  },

  markAllNotificationsRead(userId) {
    const rows = db.select('notification_logs');
    let count = 0;
    for (const r of rows) {
      if (r.user_id === userId && !r.read_at) { r.read_at = now(); count++; }
    }
    localStorage.setItem('taskmate:v1:notification_logs', JSON.stringify(rows));
    return count;
  },

  // =================== PENGATURAN ===================
  getSettings(userId) {
    ensureDefaultSettings(userId);
    return db.findOne('user_settings', (r) => r.user_id === userId);
  },

  updateSettings(userId, patch) {
    ensureDefaultSettings(userId);
    const row = db.findOne('user_settings', (r) => r.user_id === userId);
    return db.update('user_settings', row.id, patch);
  },

  // =================== AKTIVITAS ===================
  listActivities(userId) {
    return scoped('activity_logs', userId)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 12);
  },

  // =================== DATA & EKSPOR ===================
  exportAll(userId) {
    return {
      exported_at: now(),
      app: 'TaskMate',
      profile: this.getProfile(userId),
      settings: this.getSettings(userId),
      subjects: scoped('subjects', userId),
      tasks: scoped('tasks', userId),
      reminders: scoped('reminders', userId),
      notification_logs: scoped('notification_logs', userId),
    };
  },

  deleteAllTasks(userId) {
    const removed = db.remove('tasks', (t) => t.user_id === userId);
    db.remove('reminders', (r) => r.user_id === userId);
    logActivity(userId, 'data', `${removed} tugas dihapus permanen.`);
    return removed;
  },
};
