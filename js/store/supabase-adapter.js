// Adapter Supabase — implementasi nyata memakai REST GoTrue + PostgREST
// melalui fetch (tanpa SDK/build step). Diamankan oleh Row Level Security
// di database (lihat supabase/migrations/0001_init.sql).
//
// Adapter ini aktif HANYA ketika window.__TASKMATE_ENV__ diisi
// (lihat .env.example dan README bagian "Konfigurasi Supabase").
// Kontrak metodenya sama dengan local-adapter sehingga lapisan layanan
// tidak perlu berubah.

import { getConfig, uid } from '../utils/misc.js';

const cfg = getConfig();

function authHeaders(extra = {}) {
  const s = sessionStoreSafe();
  return {
    apikey: cfg.supabaseAnonKey,
    Authorization: `Bearer ${s?.access_token || cfg.supabaseAnonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

let _session = null;
function sessionStoreSafe() { return _session; }

function httpError(status, payload) {
  const e = new Error(payload?.message || payload?.error_description || payload?.error || `Kesalahan server (${status})`);
  e.status = status;
  return e;
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${cfg.supabaseUrl}${path}`, { method, headers: authHeaders(headers), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw httpError(res.status, data);
  return data;
}

function loadSession() {
  try { _session = JSON.parse(localStorage.getItem('taskmate:supabase-session') || 'null'); } catch { _session = null; }
  return _session;
}
function saveSession(s) { _session = s; localStorage.setItem('taskmate:supabase-session', JSON.stringify(s)); }
function clearSession() { _session = null; localStorage.removeItem('taskmate:supabase-session'); }

loadSession();

function authError(msg) { const e = new Error(msg); e.code = 'AUTH'; return e; }

function logActivity(userId, type, message, refId = null) {
  request('/rest/v1/activity_logs', { method: 'POST', body: { user_id: userId, type, message, ref_id: refId } }).catch(() => {});
}

export const supabaseAdapter = {
  mode: 'supabase',

  // =================== AUTENTIKASI ===================
  async signUp({ email, password, fullName }) {
    const data = await request('/auth/v1/signup', {
      method: 'POST',
      body: { email, password, data: { full_name: fullName } },
    });
    if (data.access_token) {
      saveSession({ ...data, expires_at: Date.now() + data.expires_in * 1000 });
    }
    return { session: data, user: data.user, profile: { full_name: fullName } };
  },

  async signIn({ email, password }) {
    const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    saveSession({ ...data, expires_at: Date.now() + data.expires_in * 1000 });
    return { session: data, user: data.user };
  },

  async signOut() {
    try { await request('/auth/v1/logout', { method: 'POST' }); } catch { /* abaikan */ }
    clearSession();
  },

  getSession() {
    loadSession();
    if (!_session?.access_token) return null;
    if (_session.expires_at && _session.expires_at < Date.now()) { clearSession(); return null; }
    return { user: _session.user, access_token: _session.access_token };
  },

  async updatePassword({ newPassword }) {
    await request('/auth/v1/user', { method: 'PUT', body: { password: newPassword } });
    return true;
  },

  async requestPasswordReset({ email }) {
    await request('/auth/v1/recover', { method: 'POST', body: { email } });
    return { sent: true };
  },

  async completePasswordReset({ token, password }) {
    const data = await request('/auth/v1/verify', { method: 'POST', body: { type: 'recovery', token, password } });
    if (data?.access_token) saveSession({ ...data, expires_at: Date.now() + data.expires_in * 1000 });
    return true;
  },

  // =================== PROFIL ===================
  async getProfile(userId) {
    const rows = await request(`/rest/v1/profiles?user_id=eq.${userId}&select=full_name`);
    return rows[0] || { full_name: '' };
  },

  async updateProfile(userId, { full_name }) {
    await request(`/rest/v1/profiles?user_id=eq.${userId}`, { method: 'PATCH', body: { full_name } });
    logActivity(userId, 'profile', 'Profil diperbarui.');
    return { full_name };
  },

  // =================== MATA PELAJARAN ===================
  async listSubjects(userId) {
    return request(`/rest/v1/subjects?user_id=eq.${userId}&order=name.asc`);
  },

  async createSubject(userId, { name, color }) {
    const rows = await request('/rest/v1/subjects', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { user_id: userId, name, color } });
    logActivity(userId, 'subject', `Mata pelajaran "${name}" ditambahkan.`);
    return rows[0];
  },

  async updateSubject(userId, id, patch) {
    const rows = await request(`/rest/v1/subjects?id=eq.${id}&user_id=eq.${userId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
    if (!rows?.length) throw new Error('Mata pelajaran tidak ditemukan atau bukan milik Anda.');
    return rows[0];
  },

  async subjectTasks(userId, subjectId) {
    return request(`/rest/v1/tasks?user_id=eq.${userId}&subject_id=eq.${subjectId}`);
  },

  async deleteSubject(userId, id, { reassignTo = null, deleteTasks = false } = {}) {
    if (deleteTasks) {
      const tasks = await this.subjectTasks(userId, id);
      await request(`/rest/v1/tasks?user_id=eq.${userId}&subject_id=eq.${id}`, { method: 'DELETE' });
      return { deleted: true, affected: tasks.length };
    }
    if (reassignTo) {
      const tasks = await this.subjectTasks(userId, id);
      await request(`/rest/v1/tasks?user_id=eq.${userId}&subject_id=eq.${id}`, { method: 'PATCH', body: { subject_id: reassignTo } });
      await request(`/rest/v1/subjects?id=eq.${id}&user_id=eq.${userId}`, { method: 'DELETE' });
      return { deleted: true, affected: tasks.length };
    }
    const tasks = await this.subjectTasks(userId, id);
    if (tasks.length > 0) {
      const e = new Error('Masih ada tugas pada mata pelajaran ini. Pindahkan atau hapus tugasnya terlebih dahulu.');
      e.tasks = tasks;
      throw e;
    }
    await request(`/rest/v1/subjects?id=eq.${id}&user_id=eq.${userId}`, { method: 'DELETE' });
    return { deleted: true, affected: 0 };
  },

  // =================== TUGAS ===================
  async listTasks(userId) {
    return request(`/rest/v1/tasks?user_id=eq.${userId}&order=due_at.asc`);
  },

  async getTask(userId, id) {
    const rows = await request(`/rest/v1/tasks?id=eq.${id}&user_id=eq.${userId}`);
    if (!rows.length) throw new Error('Tugas tidak ditemukan atau bukan milik Anda.');
    return rows[0];
  },

  async createTask(userId, data) {
    const rows = await request('/rest/v1/tasks', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { ...data, user_id: userId } });
    logActivity(userId, 'task', `Tugas "${data.title}" ditambahkan.`, rows[0].id);
    return rows[0];
  },

  async updateTask(userId, id, data) {
    const rows = await request(`/rest/v1/tasks?id=eq.${id}&user_id=eq.${userId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: data });
    if (!rows?.length) throw new Error('Tugas tidak ditemukan atau bukan milik Anda.');
    return rows[0];
  },

  async deleteTask(userId, id) {
    await request(`/rest/v1/tasks?id=eq.${id}&user_id=eq.${userId}`, { method: 'DELETE' });
    return { deleted: true };
  },

  /** Sinkronisasi pengingat ditangani trigger di database (sync_task_reminders). */
  async syncReminders(userId, task) {
    await request('/rest/v1/rpc/sync_task_reminders', { method: 'POST', body: { p_task_id: task.id } });
  },

  // =================== PENGINGAT ===================
  async listReminders(userId) {
    return request(`/rest/v1/reminders?user_id=eq.${userId}&order=remind_at.asc`);
  },

  async listNotificationLogs(userId) {
    return request(`/rest/v1/notification_logs?user_id=eq.${userId}&order=created_at.desc`);
  },

  async updateReminder(userId, id, patch) {
    const rows = await request(`/rest/v1/reminders?id=eq.${id}&user_id=eq.${userId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
    if (!rows?.length) throw new Error('Pengingat tidak ditemukan atau bukan milik Anda.');
    return rows[0];
  },

  async markReminderSent(userId, id) { return this.updateReminder(userId, id, { sent_at: new Date().toISOString() }); },

  async logNotification(userId, { task_id, title, body, remind_at }) {
    const rows = await request('/rest/v1/notification_logs', {
      method: 'POST', headers: { Prefer: 'return=representation', 'On-Conflict': 'task_id,remind_at' },
      body: { user_id: userId, task_id, title, body, remind_at, sent_at: remind_at },
    });
    return rows?.[0];
  },

  async markNotificationRead(userId, id) {
    await request(`/rest/v1/notification_logs?id=eq.${id}&user_id=eq.${userId}`, { method: 'PATCH', body: { read_at: new Date().toISOString() } });
  },

  async markAllNotificationsRead(userId) {
    await request(`/rest/v1/notification_logs?user_id=eq.${userId}&read_at=is.null`, { method: 'PATCH', body: { read_at: new Date().toISOString() } });
  },

  // =================== PENGATURAN ===================
  async getSettings(userId) {
    const rows = await request(`/rest/v1/user_settings?user_id=eq.${userId}`);
    return rows[0] || null;
  },

  async updateSettings(userId, patch) {
    const rows = await request(`/rest/v1/user_settings?user_id=eq.${userId}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: patch });
    return rows?.[0];
  },

  async listActivities(userId) {
    return request(`/rest/v1/activity_logs?user_id=eq.${userId}&order=created_at.desc&limit=12`);
  },

  async exportAll(userId) {
    const [subjects, tasks, reminders, settings, profile] = await Promise.all([
      this.listSubjects(userId), this.listTasks(userId), this.listReminders(userId),
      this.getSettings(userId), this.getProfile(userId),
    ]);
    return { exported_at: new Date().toISOString(), app: 'TaskMate', profile, settings, subjects, tasks, reminders };
  },

  async deleteAllTasks(userId) {
    const tasks = await this.listTasks(userId);
    await request(`/rest/v1/tasks?user_id=eq.${userId}`, { method: 'DELETE' });
    return tasks.length;
  },
};

export function newId() { return uid(); }
