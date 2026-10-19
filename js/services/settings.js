// Layanan pengaturan pengguna (tersimpan di database).
import { adapter, withUser } from '../store/index.js';

export const settingsService = {
  async get() {
    return withUser(async (uid) => {
      let s = await adapter.getSettings(uid);
      if (!s) {
        s = {
          theme: 'dark',
          default_reminder_minutes: 60,
          notification_preferences: { in_app: true, browser: false },
          quiet_hours: { enabled: false, start: '22:00', end: '06:00' },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
        };
      }
      return s;
    });
  },
  async update(patch) { return withUser((uid) => adapter.updateSettings(uid, patch)); },
};

export const dataService = {
  async exportAll() { return withUser((uid) => adapter.exportAll(uid)); },
  async deleteAllTasks() { return withUser((uid) => adapter.deleteAllTasks(uid)); },
  async activities() { return withUser((uid) => adapter.listActivities(uid)); },
};

/** Unduh berkas JSON/CSV dari data pengguna. */
export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function tasksToCsv(tasks, subjects) {
  const subjName = (id) => subjects.find((s) => s.id === id)?.name || '—';
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Judul', 'Mata Pelajaran', 'Tenggat', 'Prioritas', 'Status', 'Pengingat', 'Dibuat', 'Selesai Pada'];
  const rows = tasks.map((t) => [
    t.title, subjName(t.subject_id), t.due_at, t.priority, t.status,
    t.reminder_enabled ? 'aktif' : 'nonaktif', t.created_at, t.completed_at || '',
  ].map(esc).join(','));
  return [header.map(esc).join(','), ...rows].join('\r\n');
}
