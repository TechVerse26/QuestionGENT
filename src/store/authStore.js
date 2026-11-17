import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config.js';
import { ensureUserDoc } from '../services/authService.js';
import { loadMemberships, loadInstitutions } from '../services/institutionService.js';

const KEY = 'em-institution';
let unsub = null;

export const useAuthStore = create((set, get) => ({
  user: null, profile: null, memberships: [], institutions: {}, currentId: null, isSuper: false, ready: false, error: null, tick: 0,

  init() {
    if (!auth || unsub) { if (!auth) set({ ready: true }); return; }
    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { set({ user: null, profile: null, memberships: [], institutions: {}, currentId: null, isSuper: false, ready: true }); return; }
      await get().hydrate(user);
    });
  },

  async hydrate(user) {
    try {
      const [profile, token] = await Promise.all([ensureUserDoc(user), user.getIdTokenResult()]);
      const memberships = await loadMemberships(user.uid);
      const institutions = await loadInstitutions(memberships.map((m) => m.institutionId));
      let currentId = get().currentId || (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
      if (!memberships.some((m) => m.institutionId === currentId)) currentId = memberships[0] ? memberships[0].institutionId : null;
      set({ user, profile, memberships, institutions, currentId, isSuper: !!token.claims.superAdmin, ready: true, error: null, tick: Date.now() });
    } catch (e) {
      set({ user, ready: true, error: e.message, tick: Date.now() });
    }
  },

  async refresh() {
    const user = auth && auth.currentUser;
    if (!user) return;
    await user.reload();
    await user.getIdToken(true);
    await get().hydrate(auth.currentUser);
  },

  setCurrent(id) {
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    set({ currentId: id });
  },
}));
