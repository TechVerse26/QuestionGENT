// Where the user's own Gemini key lives: this browser only. It is never sent to Firestore or committed to the repository.
// Stored per signed-in user, so two teachers sharing one computer do not use each other's key.
const memory = new Map();
const keyName = (uid) => `em-gemini-key:${uid || 'anon'}`;
const modelName = (uid) => `em-gemini-model:${uid || 'anon'}`;

function read(name) {
  try {
    const v = globalThis.localStorage && globalThis.localStorage.getItem(name);
    if (v) return v;
  } catch (e) { /* storage blocked */ }
  return memory.get(name) || '';
}

function write(name, value) {
  if (value) memory.set(name, value); else memory.delete(name);
  try {
    if (!globalThis.localStorage) return;
    if (value) globalThis.localStorage.setItem(name, value); else globalThis.localStorage.removeItem(name);
  } catch (e) { /* storage blocked: the in-memory copy still works for this visit */ }
}

export const getAiKey = (uid) => read(keyName(uid));
export const setAiKey = (uid, key) => write(keyName(uid), String(key || '').trim());
export const clearAiKey = (uid) => write(keyName(uid), '');
export const getAiModel = (uid) => read(modelName(uid));
export const setAiModel = (uid, id) => write(modelName(uid), String(id || '').trim());

// Gemini keys have changed format before, so only the character set and a minimum length are checked.
export const looksLikeKey = (s) => /^[\w.-]{20,}$/.test(String(s || '').trim());
