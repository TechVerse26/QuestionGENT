// Renders the role-list helper functions of firestore.rules from the tenant matrix, so the rules can never drift from it.
import { TENANT_ROLES, PAPER_FULL_ACCESS, rolesWith } from './tenant.js';

// rule function name -> permission it mirrors (paperFullRead is special: a fixed list)
export const RULE_FUNCTIONS = [
  ['canViewQuestions', 'questions.view'],
  ['canWriteQuestions', 'questions.create'],
  ['canEditAllQuestions', 'questions.edit_all'],
  ['canDeleteQuestions', 'questions.delete'],
  ['canWritePapers', 'papers.create'],
  ['canEditAllPapers', 'papers.edit_all'],
  ['canReviewPapers', 'papers.review'],
  ['canPublishPapers', 'papers.publish'],
  ['paperFullRead', null],
  ['canViewKeys', 'answerKeys.view'],
  ['canEditKeys', 'answerKeys.edit'],
  ['canManageAcademics', 'academics.manage'],
  ['canManageTypes', 'types.manage'],
  ['canManageTemplates', 'templates.manage'],
  ['canSeeLogs', 'logs.view'],
];

const list = (roles) => `[${roles.map((r) => `'${r}'`).join(', ')}]`;

export function renderRuleHelpers() {
  return RULE_FUNCTIONS.map(([name, perm]) => {
    const roles = perm ? rolesWith(perm) : PAPER_FULL_ACCESS;
    return `function ${name}(r) { return r in ${list(roles)}; }`;
  });
}

export { TENANT_ROLES };
