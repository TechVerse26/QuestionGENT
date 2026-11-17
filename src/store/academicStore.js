import { create } from 'zustand';
import { listAcademic } from '../services/academicService.js';

const LISTS = ['classes', 'groups', 'departments', 'subjects', 'chapters', 'topics'];

export const useAcademic = create((set, get) => ({
  lists: {}, loadedFor: null,
  async load(institutionId, force = false) {
    if (!institutionId || (!force && get().loadedFor === institutionId)) return;
    set({ loadedFor: institutionId });
    const out = {};
    await Promise.all(LISTS.map(async (c) => {
      try { out[c] = await listAcademic(c, institutionId); } catch (e) { out[c] = []; }
    }));
    set({ lists: out });
  },
}));

export const namesOf = (lists, coll) => [...new Set((lists[coll] || []).map((x) => x.name).filter(Boolean))].sort();
