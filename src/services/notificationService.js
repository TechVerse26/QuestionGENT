import { addDoc, getDocs, query, where, orderBy, limit, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { col, ref, ts, snapList, millis } from './db.js';

export const notify = ({ institutionId, userId, createdBy, type, title, body = '', link = '' }) =>
  addDoc(col('notifications'), { institutionId, userId, createdBy, type, title, body, link, read: false, createdAt: ts() }).catch(() => null);

export async function listNotifications(userId, n = 50) {
  const s = await getDocs(query(col('notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(n)));
  return snapList(s);
}

export function watchUnread(userId, cb, types) {
  const filters = [where('userId', '==', userId), where('read', '==', false)];
  if (types && types.length) filters.push(where('type', 'in', types));
  return onSnapshot(query(col('notifications'), ...filters), (s) => cb(s.size), () => cb(0));
}

export const markRead = (id) => updateDoc(ref('notifications', id), { read: true });

export async function markAllRead(userId) {
  const s = await getDocs(query(col('notifications'), where('userId', '==', userId), where('read', '==', false)));
  const b = writeBatch(db);
  s.docs.slice(0, 400).forEach((d) => b.update(d.ref, { read: true }));
  await b.commit();
}

export const sortByDate = (list) => list.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
