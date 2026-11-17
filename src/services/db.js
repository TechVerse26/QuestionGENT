import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

export const col = (name) => collection(db, name);
export const ref = (name, id) => doc(db, name, id);
export const ts = serverTimestamp;
export const snapList = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

export function millis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  return v.seconds ? v.seconds * 1000 : 0;
}

// Every list query must carry the institution filter: security rules are not filters.
export async function listBy(name, institutionId, ...constraints) {
  return snapList(await getDocs(query(col(name), where('institutionId', '==', institutionId), ...constraints)));
}

// Runs write operations in small batches (security rules cap document-access calls per batch)
export async function commit(ops, size = 16) {
  for (let i = 0; i < ops.length; i += size) {
    const b = writeBatch(db);
    ops.slice(i, i + size).forEach((fn) => fn(b));
    await b.commit();
  }
}

export const keyDoc = ({ institutionId, scope, paperId = null, questionId, key, uid }) => ({
  institutionId, scope, paperId, questionId, data: JSON.stringify(key), createdBy: uid, updatedAt: ts(),
});
