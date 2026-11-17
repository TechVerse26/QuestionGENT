import { getDoc, getDocs, updateDoc, writeBatch, query, where, orderBy, limit, collection, arrayUnion, arrayRemove, doc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { col, ref, ts, snapList, commit, keyDoc, millis } from './db.js';
import { newId } from '../utils/id.js';
import { stripUndefined } from '../utils/object.js';
import { questionMarks } from '../utils/marks.js';
import { searchTextOf, fingerprintOf } from '../utils/question.js';

const META = ['className', 'group', 'department', 'subject', 'chapter', 'topic'];

export function packQuestion(q, institutionId) {
  const out = {
    institutionId, type: q.type, marks: questionMarks(q), difficulty: q.difficulty || 'medium', tags: q.tags || [],
    searchText: searchTextOf(q), fingerprint: fingerprintOf(q), data: JSON.stringify(q.body || {}),
  };
  META.forEach((k) => { out[k] = q[k] || ''; });
  return out;
}

export function unpackQuestion(id, d) {
  const { data, ...rest } = d;
  let body = {};
  try { body = JSON.parse(data || '{}'); } catch (e) { body = {}; }
  return { id, ...rest, body, optional: false };
}

export async function listQuestions(institutionId) {
  const s = await getDocs(query(col('questionBank'), where('institutionId', '==', institutionId), orderBy('createdAt', 'desc'), limit(1000)));
  return s.docs.map((d) => unpackQuestion(d.id, d.data()));
}

export async function createQuestion(institutionId, uid, q, key) {
  const id = q.id || newId(16);
  const batch = writeBatch(db);
  batch.set(ref('questionBank', id), stripUndefined({
    ...packQuestion(q, institutionId), createdBy: uid, status: 'active', favoritedBy: [], version: 1, createdAt: ts(), updatedAt: ts(),
  }));
  if (key) batch.set(ref('answerKeys', `b_${id}`), keyDoc({ institutionId, scope: 'bank', questionId: id, key, uid }));
  await batch.commit();
  return id;
}

// Saves the previous version into the history subcollection, then updates the question.
export async function updateQuestion(institutionId, uid, q, key, previous) {
  const batch = writeBatch(db);
  if (previous) {
    batch.set(doc(db, 'questionBank', q.id, 'history', newId(12)), stripUndefined({
      institutionId, createdBy: uid, createdAt: ts(), marks: previous.marks, type: previous.type, data: JSON.stringify(previous.body || {}),
      meta: Object.fromEntries(META.map((k) => [k, previous[k] || ''])), difficulty: previous.difficulty || 'medium',
    }));
  }
  batch.update(ref('questionBank', q.id), stripUndefined({ ...packQuestion(q, institutionId), version: (previous && previous.version ? previous.version : 1) + 1, updatedAt: ts() }));
  if (key !== undefined && key !== null) batch.set(ref('answerKeys', `b_${q.id}`), keyDoc({ institutionId, scope: 'bank', questionId: q.id, key, uid }));
  await batch.commit();
}

export async function getBankKeys(ids) {
  const out = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const s = await getDoc(ref('answerKeys', `b_${id}`));
      if (s.exists()) out[id] = JSON.parse(s.data().data);
    } catch (e) { /* no access to keys */ }
  }));
  return out;
}

export const setArchived = (ids, archived) => commit(ids.map((id) => (b) => b.update(ref('questionBank', id), { status: archived ? 'archived' : 'active', updatedAt: ts() })));
export const bulkUpdateMeta = (ids, patch) => commit(ids.map((id) => (b) => b.update(ref('questionBank', id), stripUndefined({ ...patch, updatedAt: ts() }))));
export const toggleFavorite = (id, uid, on) => updateDoc(ref('questionBank', id), { favoritedBy: on ? arrayUnion(uid) : arrayRemove(uid) });

export async function deleteQuestions(ids, canKeys) {
  const ops = [];
  ids.forEach((id) => {
    ops.push((b) => b.delete(ref('questionBank', id)));
    if (canKeys) ops.push((b) => b.delete(ref('answerKeys', `b_${id}`)));
  });
  await commit(ops);
}

export async function listHistory(institutionId, id) {
  const s = await getDocs(query(collection(db, 'questionBank', id, 'history'), where('institutionId', '==', institutionId)));
  return snapList(s).sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

export async function findDuplicateIds(institutionId, q) {
  const s = await getDocs(query(col('questionBank'), where('institutionId', '==', institutionId), where('fingerprint', '==', fingerprintOf(q)), limit(5)));
  return s.docs.map((d) => d.id).filter((id) => id !== q.id);
}

export const restoreFromHistory = async (institutionId, uid, current, hist) => {
  const body = JSON.parse(hist.data || '{}');
  const restored = { ...current, ...(hist.meta || {}), difficulty: hist.difficulty || current.difficulty, body, marks: hist.marks };
  await updateQuestion(institutionId, uid, restored, undefined, current);
  return restored;
};


// list: [{ question, key }]. Returns the new ids.
export async function createQuestionsBulk(institutionId, uid, list) {
  const ops = [];
  const ids = [];
  list.forEach(({ question, key }) => {
    const id = newId(16);
    ids.push(id);
    ops.push((b) => b.set(ref('questionBank', id), stripUndefined({
      ...packQuestion({ ...question, id }, institutionId), createdBy: uid, status: 'active', favoritedBy: [], version: 1, createdAt: ts(), updatedAt: ts(),
    })));
    if (key) ops.push((b) => b.set(ref('answerKeys', `b_${id}`), keyDoc({ institutionId, scope: 'bank', questionId: id, key, uid })));
  });
  await commit(ops, 12);
  return ids;
}
