import { getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit, collection, doc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { col, ref, ts, snapList, commit, keyDoc, millis } from './db.js';
import { newId } from '../utils/id.js';
import { stripUndefined, clone } from '../utils/object.js';
import { paperSummary } from '../utils/marks.js';
import { PAPER_FULL_ACCESS as FULL_ACCESS, PUBLISHED_STATUSES as PUBLISHED } from '../constants/roles.js';

const itemRef = (paperId, id) => doc(db, 'questionPapers', paperId, 'items', id);
const itemsCol = (paperId) => collection(db, 'questionPapers', paperId, 'items');
const versionsCol = (paperId) => collection(db, 'questionPapers', paperId, 'versions');
const keyRef = (paperId, id) => ref('answerKeys', `p_${paperId}_${id}`);

function packItem(q, institutionId, paperId) {
  const { body, key, ...meta } = q;
  return stripUndefined({ ...meta, institutionId, paperId, data: JSON.stringify(body || {}), updatedAt: ts() });
}

function unpackItem(id, d) {
  const { data, ...rest } = d;
  let body = {};
  try { body = JSON.parse(data || '{}'); } catch (e) { body = {}; }
  return { ...rest, id, body };
}

export async function createPaper({ institutionId, uid, title, info, design, sections = [] }) {
  const id = newId(16);
  await setDoc(ref('questionPapers', id), stripUndefined({
    institutionId, createdBy: uid, title, status: 'draft', version: 1, info, design, sections,
    totals: { marks: 0, questions: 0 }, createdAt: ts(), updatedAt: ts(),
  }));
  return id;
}


// Mirrors the paper read rule in firestore.rules
export async function listPapers(institutionId, { uid, role }) {
  const inst = where('institutionId', '==', institutionId);
  const order = orderBy('updatedAt', 'desc');
  const run = async (...c) => snapList(await getDocs(query(col('questionPapers'), inst, ...c, order, limit(300))));
  let list;
  if (FULL_ACCESS.includes(role)) list = await run();
  else if (role === 'teacher') list = [...(await run(where('createdBy', '==', uid))), ...(await run(where('status', 'in', PUBLISHED)))];
  else list = await run(where('status', 'in', PUBLISHED));
  const seen = new Set();
  return list.filter((p) => (seen.has(p.id) ? false : seen.add(p.id))).sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
}

export async function loadPaper(paperId, institutionId, canKeys) {
  const snap = await getDoc(ref('questionPapers', paperId));
  if (!snap.exists()) throw new Error('Paper not found');
  const paper = { id: snap.id, ...snap.data() };
  if (paper.institutionId !== institutionId) throw new Error('Paper not found');
  const items = {};
  (await getDocs(query(itemsCol(paperId), where('institutionId', '==', institutionId)))).docs.forEach((d) => { items[d.id] = unpackItem(d.id, d.data()); });
  const keys = {};
  if (canKeys) {
    const ks = await getDocs(query(col('answerKeys'), where('institutionId', '==', institutionId), where('paperId', '==', paperId)));
    ks.docs.forEach((d) => { const x = d.data(); try { keys[x.questionId] = JSON.parse(x.data); } catch (e) { /* skip */ } });
  }
  return { paper, items, keys };
}

// Only changed items are written: autosave must not burn quota.
export async function savePaper({ paper, items, keys, dirtyIds, removed, uid, canKeys }) {
  const paperId = paper.id;
  const institutionId = paper.institutionId;
  const ops = [];
  dirtyIds.filter((id) => items[id]).forEach((id) => {
    ops.push((b) => b.set(itemRef(paperId, id), packItem(items[id], institutionId, paperId)));
    if (canKeys && keys[id]) ops.push((b) => b.set(keyRef(paperId, id), keyDoc({ institutionId, scope: 'paper', paperId, questionId: id, key: keys[id], uid })));
  });
  removed.forEach((id) => {
    ops.push((b) => b.delete(itemRef(paperId, id)));
    if (canKeys) ops.push((b) => b.delete(keyRef(paperId, id)));
  });
  await commit(ops, 8);
  const summary = paperSummary(paper, items);
  await updateDoc(ref('questionPapers', paperId), stripUndefined({
    title: paper.title || '', info: paper.info, design: paper.design, sections: paper.sections, setLabel: paper.setLabel || null,
    totals: { marks: summary.total, questions: summary.questionCount }, updatedAt: ts(),
  }));
}

export const setPaperStatus = (paperId, status, uid, note = '') => updateDoc(ref('questionPapers', paperId), { status, reviewNote: note, reviewedBy: uid, updatedAt: ts() });

export async function duplicatePaper({ paper, items, keys, uid, canKeys, title }) {
  const id = await createPaper({ institutionId: paper.institutionId, uid, title: title || `${paper.title || ''} (copy)`, info: clone(paper.info), design: clone(paper.design), sections: clone(paper.sections) });
  const copy = { ...paper, id, title: title || `${paper.title || ''} (copy)`, setLabel: paper.setLabel || null };
  await savePaper({ paper: copy, items, keys: keys || {}, dirtyIds: Object.keys(items), removed: [], uid, canKeys });
  return id;
}

export async function deletePaper(paper, canKeys) {
  const { id: paperId, institutionId } = paper;
  const ops = [];
  (await getDocs(query(itemsCol(paperId), where('institutionId', '==', institutionId)))).docs.forEach((d) => {
    ops.push((b) => b.delete(d.ref));
    if (canKeys) ops.push((b) => b.delete(keyRef(paperId, d.id)));
  });
  (await getDocs(query(versionsCol(paperId), where('institutionId', '==', institutionId)))).docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
  ops.push((b) => b.delete(ref('questionPapers', paperId)));
  await commit(ops, 6);
}

export async function saveVersion({ paper, items, uid, label }) {
  const snapshot = JSON.stringify({ paper: { title: paper.title, info: paper.info, design: paper.design, sections: paper.sections }, items });
  if (snapshot.length > 900000) throw new Error('This paper is too large to snapshot.');
  await setDoc(doc(versionsCol(paper.id), newId(12)), {
    institutionId: paper.institutionId, createdBy: uid, label: label || '', questionCount: Object.keys(items).length, snapshot, createdAt: ts(),
  });
}

export async function listVersions(paperId, institutionId) {
  const s = await getDocs(query(versionsCol(paperId), where('institutionId', '==', institutionId)));
  return snapList(s).sort((a, b) => millis(b.createdAt) - millis(a.createdAt)).slice(0, 30);
}
