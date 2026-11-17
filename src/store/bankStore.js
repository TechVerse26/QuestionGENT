import { create } from 'zustand';
import { listQuestions } from '../services/questionService.js';

export const useBank = create((set, get) => ({
  items: [], loadedFor: null, loading: false, error: null,
  async load(institutionId, force = false) {
    if (!institutionId || (!force && get().loadedFor === institutionId)) return;
    set({ loading: true, error: null });
    try {
      const items = await listQuestions(institutionId);
      set({ items, loadedFor: institutionId, loading: false });
    } catch (e) {
      set({ loading: false, error: e.message });
    }
  },
  invalidate() { set({ loadedFor: null }); },
}));
