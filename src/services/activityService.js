import { addDoc, getDocs, query, where, orderBy, limit, getCountFromServer, Timestamp } from 'firebase/firestore';
import { col, ts, snapList } from './db.js';

export async function logActivity(institutionId, userId, action, meta = {}) {
  try { await addDoc(col('activityLogs'), { institutionId, userId, action, meta, createdAt: ts() }); } catch (e) { /* logging must never block the user */ }
}

export async function listActivity(institutionId, n = 10) {
  const s = await getDocs(query(col('activityLogs'), where('institutionId', '==', institutionId), orderBy('createdAt', 'desc'), limit(n)));
  return snapList(s);
}

export async function logExport(institutionId, userId, paperId, format, extra = {}) {
  try { await addDoc(col('exports'), { institutionId, userId, paperId, format, ...extra, createdAt: ts() }); } catch (e) { /* ignore */ }
}

export async function logImport(institutionId, userId, summary) {
  try { await addDoc(col('imports'), { institutionId, userId, ...summary, createdAt: ts() }); } catch (e) { /* ignore */ }
}

export async function listLogs(name, institutionId, n = 50) {
  const s = await getDocs(query(col(name), where('institutionId', '==', institutionId), orderBy('createdAt', 'desc'), limit(n)));
  return snapList(s);
}

export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export async function countBetween(name, institutionId, from, to, ...extra) {
  const q = query(col(name), where('institutionId', '==', institutionId), ...extra, where('createdAt', '>=', Timestamp.fromDate(from)), where('createdAt', '<', Timestamp.fromDate(to)));
  return (await getCountFromServer(q)).data().count;
}

export async function countAll(name, institutionId, ...constraints) {
  return (await getCountFromServer(query(col(name), where('institutionId', '==', institutionId), ...constraints))).data().count;
}
