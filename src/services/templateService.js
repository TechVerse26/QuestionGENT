import { setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, ts, listBy } from './db.js';
import { newId } from '../utils/id.js';
import { stripUndefined } from '../utils/object.js';

export const listTemplates = (institutionId) => listBy('paperTemplates', institutionId);

export async function saveTemplate({ id, institutionId, uid, name, design }) {
  const payload = stripUndefined({ institutionId, name, design });
  if (id) { await updateDoc(ref('paperTemplates', id), { ...payload, updatedAt: ts() }); return id; }
  const nid = newId(14);
  await setDoc(ref('paperTemplates', nid), { ...payload, createdBy: uid, createdAt: ts(), updatedAt: ts() });
  return nid;
}

export const deleteTemplate = (id) => deleteDoc(ref('paperTemplates', id));

// Custom question type definitions (collection: questionTypes)
export const listCustomTypes = (institutionId) => listBy('questionTypes', institutionId);

export async function saveCustomType({ id, institutionId, uid, name, fields }) {
  const payload = stripUndefined({ institutionId, name, fields });
  if (id) { await updateDoc(ref('questionTypes', id), { ...payload, updatedAt: ts() }); return id; }
  const nid = newId(14);
  await setDoc(ref('questionTypes', nid), { ...payload, createdBy: uid, createdAt: ts(), updatedAt: ts() });
  return nid;
}

export const deleteCustomType = (id) => deleteDoc(ref('questionTypes', id));
