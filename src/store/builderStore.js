import { create } from 'zustand';
import { newSection, cloneItem } from '../utils/paper.js';
import { clone } from '../utils/object.js';

const move = (arr, from, to) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
const addUnique = (list, ...ids) => [...new Set([...list, ...ids])];
const blank = { paper: null, items: {}, keys: {}, dirtyIds: [], removed: [], dirty: false, saving: false, savedAt: null, rev: 0 };

export const useBuilder = create((set, get) => {
  // every mutation marks the paper dirty and bumps rev (used to detect edits made while a save is running)
  const mut = (fn) => set((s) => ({ ...fn(s), dirty: true, rev: s.rev + 1 }));
  const mapSections = (s, fn) => ({ paper: { ...s.paper, sections: s.paper.sections.map(fn) } });

  return {
    ...blank,
    load: (paper, items, keys) => set({ ...blank, paper, items, keys: keys || {} }),
    loadAllDirty: (paper, items, keys) => mut((s) => ({ paper, items, keys: keys || {}, dirtyIds: Object.keys(items), removed: Object.keys(s.items).filter((id) => !items[id]) })),
    reset: () => set({ ...blank }),
    setSaving: (saving) => set({ saving }),
    markSaved: (savedIds, rev, removedIds) => set((s) => ({
      dirtyIds: s.dirtyIds.filter((id) => !savedIds.includes(id)),
      removed: s.removed.filter((id) => !removedIds.includes(id)),
      dirty: s.rev !== rev, saving: false, savedAt: Date.now(),
    })),

    patchPaper: (patch) => mut((s) => ({ paper: { ...s.paper, ...patch } })),
    setInfo: (patch) => mut((s) => ({ paper: { ...s.paper, info: { ...s.paper.info, ...patch } } })),
    setDesign: (design) => mut((s) => ({ paper: { ...s.paper, design } })),

    addSection: (o) => mut((s) => ({ paper: { ...s.paper, sections: [...s.paper.sections, newSection(o)] } })),
    updateSection: (id, patch) => mut((s) => mapSections(s, (x) => (x.id === id ? { ...x, ...patch } : x))),
    moveSection: (from, to) => mut((s) => ({ paper: { ...s.paper, sections: move(s.paper.sections, from, to) } })),
    removeSection: (id) => mut((s) => {
      const sec = s.paper.sections.find((x) => x.id === id);
      const gone = sec ? sec.itemIds : [];
      const items = { ...s.items };
      const keys = { ...s.keys };
      gone.forEach((i) => { delete items[i]; delete keys[i]; });
      return { paper: { ...s.paper, sections: s.paper.sections.filter((x) => x.id !== id) }, items, keys, removed: addUnique(s.removed, ...gone), dirtyIds: s.dirtyIds.filter((i) => !gone.includes(i)) };
    }),
    duplicateSection: (id) => mut((s) => {
      const idx = s.paper.sections.findIndex((x) => x.id === id);
      if (idx < 0) return {};
      const src = s.paper.sections[idx];
      const items = { ...s.items };
      const keys = { ...s.keys };
      const ids = src.itemIds.map((iid) => {
        const copy = cloneItem(s.items[iid]);
        items[copy.id] = copy;
        if (s.keys[iid]) keys[copy.id] = clone(s.keys[iid]);
        return copy.id;
      });
      const sec = newSection({ ...clone(src), id: undefined, title: `${src.title} (copy)`, itemIds: ids });
      const sections = s.paper.sections.slice();
      sections.splice(idx + 1, 0, { ...sec, id: newSection().id });
      return { paper: { ...s.paper, sections }, items, keys, dirtyIds: addUnique(s.dirtyIds, ...ids) };
    }),

    addItem: (sectionId, q, key) => mut((s) => ({
      ...mapSections(s, (x) => (x.id === sectionId ? { ...x, itemIds: [...x.itemIds, q.id] } : x)),
      items: { ...s.items, [q.id]: q }, keys: key ? { ...s.keys, [q.id]: key } : s.keys, dirtyIds: addUnique(s.dirtyIds, q.id),
    })),
    updateItem: (q, key) => mut((s) => ({
      items: { ...s.items, [q.id]: q }, keys: key !== undefined && key !== null ? { ...s.keys, [q.id]: key } : s.keys, dirtyIds: addUnique(s.dirtyIds, q.id),
    })),
    setItemFlag: (id, patch) => mut((s) => ({ items: { ...s.items, [id]: { ...s.items[id], ...patch } }, dirtyIds: addUnique(s.dirtyIds, id) })),
    removeItem: (id) => mut((s) => {
      const items = { ...s.items };
      const keys = { ...s.keys };
      delete items[id];
      delete keys[id];
      return { ...mapSections(s, (x) => ({ ...x, itemIds: x.itemIds.filter((i) => i !== id) })), items, keys, removed: addUnique(s.removed, id), dirtyIds: s.dirtyIds.filter((i) => i !== id) };
    }),
    duplicateItem: (id) => mut((s) => {
      const copy = cloneItem(s.items[id]);
      return {
        ...mapSections(s, (x) => { const i = x.itemIds.indexOf(id); if (i < 0) return x; const ids = x.itemIds.slice(); ids.splice(i + 1, 0, copy.id); return { ...x, itemIds: ids }; }),
        items: { ...s.items, [copy.id]: copy }, keys: s.keys[id] ? { ...s.keys, [copy.id]: clone(s.keys[id]) } : s.keys, dirtyIds: addUnique(s.dirtyIds, copy.id),
      };
    }),
    reorderItems: (sectionId, ids) => mut((s) => mapSections(s, (x) => (x.id === sectionId ? { ...x, itemIds: ids } : x))),
    moveItemTo: (id, toSectionId) => mut((s) => mapSections(s, (x) => {
      if (x.id === toSectionId) return { ...x, itemIds: x.itemIds.includes(id) ? x.itemIds : [...x.itemIds, id] };
      return { ...x, itemIds: x.itemIds.filter((i) => i !== id) };
    })),
  };
});
