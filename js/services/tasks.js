// Layanan tugas: CRUD + sinkronisasi pengingat + status turunan.
import { adapter, withUser } from '../store/index.js';

export const taskService = {
  async list() { return withUser((uid) => adapter.listTasks(uid)); },

  async get(id) { return withUser((uid) => adapter.getTask(uid, id)); },

  /** Buat tugas lalu sinkronkan jadwal pengingatnya. */
  async create(data) {
    return withUser(async (uid) => {
      const task = await adapter.createTask(uid, data);
      await adapter.syncReminders(uid, task);
      return task;
    });
  },

  /** Perbarui tugas; perubahan tenggat otomatis memperbarui jadwal pengingat. */
  async update(id, data) {
    return withUser(async (uid) => {
      const task = await adapter.updateTask(uid, id, data);
      await adapter.syncReminders(uid, task);
      return task;
    });
  },

  async remove(id) { return withUser((uid) => adapter.deleteTask(uid, id)); },

  async setDone(id, done) {
    return this.update(id, { status: done ? 'selesai' : 'belum' });
  },
};
