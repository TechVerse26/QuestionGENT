// Which notification types each preference switch controls
export const NOTIFY_GROUPS = {
  reviews: ['paper_review', 'paper_approved', 'paper_published', 'paper_draft'],
  invitations: ['invitation'],
  exports: ['export'],
};
export const ALWAYS_TYPES = ['announcement', 'subscription'];

export function allowedTypes(prefs) {
  const n = (prefs && prefs.notify) || {};
  const out = [...ALWAYS_TYPES];
  Object.entries(NOTIFY_GROUPS).forEach(([k, list]) => { if (n[k] !== false) out.push(...list); });
  return out;
}
