import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useAcademic } from '../store/academicStore.js';
import { roleCan } from '../constants/roles.js';

export function useCurrent() {
  const { user, profile, memberships, institutions, currentId, isSuper } = useAuthStore();
  const membership = memberships.find((m) => m.institutionId === currentId) || null;
  const institution = currentId && institutions[currentId] ? institutions[currentId] : null;
  const role = membership ? membership.role : null;
  const can = useCallback((perm) => roleCan(role, perm), [role]);
  return { user, profile, institution, institutionId: currentId, membership, role, can, isSuper };
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

// Loads class/subject/etc. name lists once per institution (used for suggestions)
export function useAcademicLists() {
  const { institutionId } = useCurrent();
  const lists = useAcademic((s) => s.lists);
  useEffect(() => { useAcademic.getState().load(institutionId); }, [institutionId]);
  return lists;
}
