// Layanan mata pelajaran.
import { adapter, withUser } from '../store/index.js';

export const subjectService = {
  async list() { return withUser((uid) => adapter.listSubjects(uid)); },
  async create(data) { return withUser((uid) => adapter.createSubject(uid, data)); },
  async update(id, data) { return withUser((uid) => adapter.updateSubject(uid, id, data)); },
  async tasks(subjectId) { return withUser((uid) => adapter.subjectTasks(uid, subjectId)); },
  async remove(id, opts) { return withUser((uid) => adapter.deleteSubject(uid, id, opts)); },
};

/** Warna kategori yang tersedia. */
export const WARNA = [
  '#60A5FA', '#818CF8', '#A78BFA', '#C084FC', '#E879F9',
  '#F472B6', '#FB7185', '#F87171', '#FB923C', '#FBBF24',
  '#FACC15', '#A3E635', '#4ADE80', '#34D399', '#2DD4BF',
  '#38BDF8', '#94A3B8', '#64748B',
];
