import { getDoc, getDocs, query, where, writeBatch, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { col, ref, ts, snapList, listBy } from './db.js';
import { newId } from '../utils/id.js';
import { stripUndefined } from '../utils/object.js';

export async function loadMemberships(uid) {
  return snapList(await getDocs(query(col('memberships'), where('uid', '==', uid))));
}

export async function loadInstitutions(ids) {
  const out = {};
  await Promise.all([...new Set(ids)].map(async (id) => {
    const s = await getDoc(ref('institutions', id));
    if (s.exists()) out[id] = { id, ...s.data() };
  }));
  return out;
}

export async function createInstitution(user, data) {
  const id = newId(16);
  const batch = writeBatch(db);
  batch.set(ref('institutions', id), stripUndefined({
    name: data.name, type: data.type, address: data.address || '', phone: data.phone || '', email: data.email || '', website: data.website || '',
    logoUrl: data.logoUrl || '', info: data.info || '', plan: 'free', aiUsed: 0, createdBy: user.uid, createdAt: ts(), updatedAt: ts(),
  }));
  batch.set(ref('memberships', `${user.uid}_${id}`), {
    uid: user.uid, institutionId: id, role: 'institution_admin', displayName: user.displayName || '', email: (user.email || '').toLowerCase(), photoURL: user.photoURL || '', createdAt: ts(),
  });
  await batch.commit();
  return id;
}

export const updateInstitution = (id, patch) => updateDoc(ref('institutions', id), stripUndefined({ ...patch, updatedAt: ts() }));

export const listMembers = (institutionId) => listBy('memberships', institutionId);
export const updateMemberRole = (institutionId, uid, role) => updateDoc(ref('memberships', `${uid}_${institutionId}`), { role });
export const removeMember = (institutionId, uid) => deleteDoc(ref('memberships', `${uid}_${institutionId}`));

export async function createInvitation({ institutionId, institutionName, email, role, uid }) {
  const id = newId(16);
  await setDoc(ref('invitations', id), {
    institutionId, institutionName, email: email.trim().toLowerCase(), role, status: 'pending', invitedBy: uid, createdAt: ts(),
  });
  return id;
}

export const listInvitations = (institutionId) => listBy('invitations', institutionId, where('status', '==', 'pending'));
export const revokeInvitation = (id) => deleteDoc(ref('invitations', id));

export async function listMyInvitations(email) {
  if (!email) return [];
  return snapList(await getDocs(query(col('invitations'), where('email', '==', email.toLowerCase()), where('status', '==', 'pending'))));
}

export async function acceptInvitation(inv, user) {
  const batch = writeBatch(db);
  batch.set(ref('memberships', `${user.uid}_${inv.institutionId}`), {
    uid: user.uid, institutionId: inv.institutionId, role: inv.role, invitationId: inv.id,
    displayName: user.displayName || '', email: (user.email || '').toLowerCase(), photoURL: user.photoURL || '', createdAt: ts(),
  });
  batch.update(ref('invitations', inv.id), { status: 'accepted', acceptedBy: user.uid, respondedAt: ts() });
  await batch.commit();
}

export const declineInvitation = (inv, user) => updateDoc(ref('invitations', inv.id), { status: 'declined', acceptedBy: user.uid, respondedAt: ts() });
