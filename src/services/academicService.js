import { setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, ts, listBy } from './db.js';
import { newId } from '../utils/id.js';
import { stripUndefined } from '../utils/object.js';

// Collections that behave as simple institution-scoped lists (see the generic rule in firestore.rules)
export const ACADEMIC = ['branches', 'departments', 'classes', 'groups', 'subjects', 'sessions', 'chapters', 'topics', 'examinations'];

export const listAcademic = (coll, institutionId) => listBy(coll, institutionId);

export async function saveAcademic(coll, institutionId, uid, data, id) {
  const base = stripUndefined({ ...data, institutionId });
  if (id) { await updateDoc(ref(coll, id), { ...base, updatedAt: ts() }); return id; }
  const nid = newId(14);
  await setDoc(ref(coll, nid), { ...base, createdBy: uid, createdAt: ts(), updatedAt: ts() });
  return nid;
}

export const removeAcademic = (coll, id) => deleteDoc(ref(coll, id));
