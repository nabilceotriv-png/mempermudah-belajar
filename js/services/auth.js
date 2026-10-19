// Layanan autentikasi & profil.
import { adapter, session } from '../store/index.js';

export const authService = {
  async signUp({ email, password, fullName }) {
    const res = await adapter.signUp({ email, password, fullName });
    await session.set(adapter.getSession() || res.session);
    return res;
  },
  async signIn({ email, password }) {
    const res = await adapter.signIn({ email, password });
    await session.set(adapter.getSession());
    return res;
  },
  async signOut() {
    await adapter.signOut();
    session.clear();
  },
  getSession() { return adapter.getSession(); },
  async getProfile(userId) { return adapter.getProfile(userId); },
  async updateProfile(userId, data) { return adapter.updateProfile(userId, data); },
  async updatePassword(payload) { return adapter.updatePassword(payload); },
  async requestPasswordReset(email) { return adapter.requestPasswordReset({ email }); },
  async completePasswordReset(payload) { return adapter.completePasswordReset(payload); },
};
