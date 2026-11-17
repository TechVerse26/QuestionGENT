import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
  sendPasswordResetEmail, sendEmailVerification, signOut, updateProfile,
} from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../firebase/config.js';
import { ref, ts } from './db.js';

export async function ensureUserDoc(user, extra = {}) {
  const r = ref('users', user.uid);
  const snap = await getDoc(r);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const data = {
    uid: user.uid, email: (user.email || '').toLowerCase(), displayName: extra.displayName || user.displayName || '', photoURL: user.photoURL || '',
    status: 'active', prefs: { lang: 'en', theme: 'light', notify: { invitations: true, reviews: true, exports: false } }, createdAt: ts(),
  };
  await setDoc(r, data);
  return { id: user.uid, ...data };
}

export async function registerWithEmail({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await ensureUserDoc(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  return cred.user;
}

export const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export const sendReset = (email) => sendPasswordResetEmail(auth, email);
export const resendVerification = () => sendEmailVerification(auth.currentUser);
export const logout = () => signOut(auth);

export async function updateUserProfile(user, { displayName, photoURL }) {
  await updateProfile(user, { displayName, photoURL: photoURL || null });
  await updateDoc(ref('users', user.uid), { displayName, photoURL: photoURL || '', updatedAt: ts() });
}

export const savePrefs = (uid, prefs) => updateDoc(ref('users', uid), { prefs, updatedAt: ts() });

export const friendlyAuthError = (e) => {
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[e && e.code] || (e && e.message) || 'Something went wrong.';
};
