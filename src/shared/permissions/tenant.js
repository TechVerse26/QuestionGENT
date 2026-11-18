// Single source of truth for INSTITUTION-LEVEL (tenant) permissions.
// Pure data + tiny helpers: no Firebase, no React, safe to import from the browser, route handlers and scripts.
// The Firestore rule helper functions are generated from this file (see rulesHelpers.js) and a test
// proves that the committed firestore.rules and this matrix agree (finding S-15).

export const TENANT_ROLES = ['institution_admin', 'teacher', 'department_head', 'examination_controller', 'paper_reviewer', 'editor', 'viewer', 'print_operator'];

export const TENANT_ROLE_LABELS = {
  institution_admin: { en: 'Institution admin', bn: 'প্রতিষ্ঠান অ্যাডমিন' },
  teacher: { en: 'Teacher', bn: 'শিক্ষক' },
  department_head: { en: 'Department head', bn: 'বিভাগীয় প্রধান' },
  examination_controller: { en: 'Examination controller', bn: 'পরীক্ষা নিয়ন্ত্রক' },
  paper_reviewer: { en: 'Paper reviewer', bn: 'প্রশ্নপত্র পর্যালোচক' },
  editor: { en: 'Editor', bn: 'সম্পাদক' },
  viewer: { en: 'Viewer', bn: 'দর্শক' },
  print_operator: { en: 'Print operator', bn: 'প্রিন্ট অপারেটর' },
};

const ALL = [
  'institution.manage', 'members.manage', 'academics.manage',
  'questions.view', 'questions.create', 'questions.edit_all', 'questions.delete',
  'papers.view', 'papers.create', 'papers.edit_all', 'papers.review', 'papers.publish', 'papers.export',
  'answerKeys.view', 'answerKeys.edit', 'templates.manage', 'analytics.view', 'import.use', 'ai.use', 'billing.manage',
  // added to the legacy matrix so the rule helpers canManageTypes / canSeeLogs have a named permission
  'types.manage', 'logs.view',
];
export const TENANT_PERMISSIONS = ALL;

export const TENANT_ROLE_PERMISSIONS = {
  institution_admin: ALL,
  teacher: ['questions.view', 'questions.create', 'papers.view', 'papers.create', 'papers.export', 'answerKeys.view', 'answerKeys.edit', 'templates.manage', 'import.use', 'ai.use'],
  department_head: ['questions.view', 'questions.create', 'questions.edit_all', 'papers.view', 'papers.create', 'papers.edit_all', 'papers.review', 'papers.export', 'answerKeys.view', 'answerKeys.edit', 'templates.manage', 'analytics.view', 'academics.manage', 'import.use', 'ai.use', 'types.manage', 'logs.view'],
  examination_controller: ['questions.view', 'papers.view', 'papers.review', 'papers.publish', 'papers.export', 'answerKeys.view', 'templates.manage', 'analytics.view', 'academics.manage', 'logs.view'],
  paper_reviewer: ['questions.view', 'papers.view', 'papers.review', 'answerKeys.view'],
  editor: ['questions.view', 'questions.create', 'questions.edit_all', 'questions.delete', 'papers.view', 'papers.create', 'papers.edit_all', 'papers.export', 'answerKeys.view', 'answerKeys.edit', 'templates.manage', 'import.use', 'types.manage'],
  viewer: ['questions.view', 'papers.view'],
  print_operator: ['papers.view', 'papers.export'],
};

// Roles that may read every paper of the institution (others see own / approved ones). Mirrors firestore.rules.
export const PAPER_FULL_ACCESS = ['institution_admin', 'examination_controller', 'paper_reviewer', 'department_head', 'editor'];
export const PUBLISHED_STATUSES = ['approved', 'published'];

export const roleCan = (role, perm) => !!role && (TENANT_ROLE_PERMISSIONS[role] || []).includes(perm);
export const rolesWith = (perm) => TENANT_ROLES.filter((r) => roleCan(r, perm));
