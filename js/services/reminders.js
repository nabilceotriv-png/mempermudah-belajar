// Layanan pengingat + penjadwal pemeriksaan pengingat.
//
// CATATAN JUJUR TENTANG JANGKAUAN NOTIFIKASI:
// - Mekanisme ini berjalan selama aplikasi terbuka di peramban (in-app +
//   Notification API). Jadwal pengingat disimpan di basis data, bukan di memori.
// - Pengiriman ketika web ditutup sepenuhnya membutuhkan proses server:
//   Supabase Edge Function + pg_cron (tersedia di supabase/functions dan
//   supabase/migrations) yang menandai pengingat jatuh tempo & mengirim Web Push.
//   Lihat README bagian "Pengingat & Notifikasi".

import { adapter, withUser, requireUserId } from '../store/index.js';
import { toast } from '../ui/toast.js';
import { formatRingkas } from '../utils/date.js';

export const reminderService = {
  async list() { return withUser((uid) => adapter.listReminders(uid)); },
  async logs() { return withUser((uid) => adapter.listNotificationLogs(uid)); },
  async toggle(id, enabled) { return withUser((uid) => adapter.updateReminder(uid, id, { is_enabled: enabled })); },
  async markRead(id) { return withUser((uid) => adapter.markNotificationRead(uid, id)); },
  async markAllRead() { return withUser((uid) => adapter.markAllNotificationsRead(uid)); },
};

export function notificationPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

function dalamJamTenang(jamTenang) {
  if (!jamTenang?.enabled) return false;
  const now = new Date();
  const menit = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = String(jamTenang.start || '22:00').split(':').map(Number);
  const [eh, em] = String(jamTenang.end || '06:00').split(':').map(Number);
  const mulai = sh * 60 + sm, akhir = eh * 60 + em;
  if (mulai <= akhir) return menit >= mulai && menit < akhir;
  return menit >= mulai || menit < akhir; // melewati tengah malam
}

/** Periksa pengingat jatuh tempo & kirim (tanpa notifikasi ganda). */
export async function checkDueReminders({ silentIfNone = true } = {}) {
  let userId = null;
  try { userId = requireUserId(); } catch { return 0; }

  const settings = adapter.getSettings(userId);
  const prefs = settings?.notification_preferences || { in_app: true, browser: false };
  const reminders = adapter.listReminders(userId);
  const nowMs = Date.now();
  const due = reminders.filter((r) => r.is_enabled && !r.sent_at && new Date(r.remind_at).getTime() <= nowMs);
  if (due.length === 0) return 0;

  if (dalamJamTenang(settings?.quiet_hours)) return 0; // tunda sampai jam tenang berakhir

  const tasks = adapter.listTasks(userId);
  let terkirim = 0;
  for (const r of due) {
    const task = tasks.find((t) => t.id === r.task_id);
    if (!task) { adapter.markReminderSent(userId, r.id); continue; }
    const judul = `Pengingat: ${task.title}`;
    const isi = task.status === 'selesai'
      ? 'Tugas ini sudah selesai. Pengingat ditandai terkirim.'
      : `Tenggat ${formatRingkas(task.due_at)}.`;
    // Log dengan kunci unik (task_id, remind_at) => anti notifikasi ganda.
    adapter.logNotification(userId, { task_id: task.id, title: judul, body: isi, remind_at: r.remind_at });
    adapter.markReminderSent(userId, r.id);
    if (task.status !== 'selesai') {
      if (prefs.in_app !== false) toast(`⏰ ${judul} — ${isi}`, 'warning', 7000);
      if (prefs.browser && notificationPermissionState() === 'granted') {
        try { new Notification('TaskMate', { body: `${judul}\n${isi}`, tag: `taskmate-${task.id}` }); } catch { /* abaikan */ }
      }
      terkirim++;
    }
  }
  if (!silentIfNone) return terkirim;
  return terkirim;
}

let timer = null;
let visibilityHandler = null;
let focusHandler = null;

export function startScheduler() {
  stopScheduler();
  visibilityHandler = () => { checkDueReminders().catch(() => {}); };
  focusHandler = visibilityHandler;
  timer = setInterval(visibilityHandler, 20000);
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('focus', focusHandler);
  checkDueReminders().catch(() => {});
}

export function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
  if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null; }
  if (focusHandler) { window.removeEventListener('focus', focusHandler); focusHandler = null; }
}
