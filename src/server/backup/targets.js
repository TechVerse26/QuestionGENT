// What a backup covers. A test compares these lists with firestore.rules so a new collection can never be forgotten.
// `rateLimits` is deliberately excluded (ephemeral, server-only).
export const TOP_LEVEL_COLLECTIONS = [
  'users', 'institutions', 'memberships', 'invitations',
  'branches', 'departments', 'classes', 'groups', 'subjects', 'sessions', 'chapters', 'topics', 'examinations',
  'questionBank', 'answerKeys', 'questionPapers', 'paperTemplates', 'questionTypes',
  'notifications', 'activityLogs', 'exports', 'imports', 'subscriptions', 'payments', 'systemSettings',
];

// Subcollections, read with a collection-group query: questionBank/*/history, questionPapers/*/items, questionPapers/*/versions
export const SUBCOLLECTION_GROUPS = ['history', 'items', 'versions'];

export const BACKUP_UNITS = [
  ...TOP_LEVEL_COLLECTIONS.map((id) => ({ id, type: 'collection' })),
  ...SUBCOLLECTION_GROUPS.map((id) => ({ id, type: 'group' })),
];

export const unitFileName = (unit, encrypted) => `${unit.type === 'group' ? 'g__' : ''}${unit.id}.ndjson.gz${encrypted ? '.enc' : ''}`;
