const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');

// Subset of src/constants/roles.js that server code needs. Keep in sync.
const PERMS = {
  institution_admin: ['*'],
  teacher: ['ai.use'],
  department_head: ['ai.use'],
};

// Verifies the caller is signed in, belongs to the institution and has the permission. Never trusts the client.
async function requirePermission(request, institutionId, perm) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (typeof institutionId !== 'string' || !institutionId) throw new HttpsError('invalid-argument', 'institutionId is required.');
  const snap = await admin.firestore().doc(`memberships/${request.auth.uid}_${institutionId}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'You are not a member of this institution.');
  const role = snap.data().role;
  const list = PERMS[role] || [];
  if (!list.includes('*') && !list.includes(perm)) throw new HttpsError('permission-denied', 'Your role cannot do this.');
  return { role, member: snap.data() };
}

// Fixed-window limiter stored in Firestore (collection rateLimits is server-only in the rules).
async function rateLimit(uid, key, max, windowSec) {
  const db = admin.firestore();
  const ref = db.doc(`rateLimits/${uid}_${key}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    let d = snap.exists ? snap.data() : { start: now, count: 0 };
    if (now - d.start > windowSec * 1000) d = { start: now, count: 0 };
    if (d.count >= max) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a moment and try again.');
    tx.set(ref, { start: d.start, count: d.count + 1 });
  });
}

module.exports = { requirePermission, rateLimit };
