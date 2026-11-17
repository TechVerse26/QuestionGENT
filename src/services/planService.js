import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';
import { countAll, countBetween, monthStart } from './activityService.js';
import { limitOf } from '../constants/plans.js';

const cache = new Map();

export async function getUsage(institutionId, force = false) {
  const hit = cache.get(institutionId);
  if (!force && hit && Date.now() - hit.t < 30000) return hit.v;
  const now = new Date();
  const [questions, papers, users, exportsMonth] = await Promise.all([
    countAll('questionBank', institutionId),
    countAll('questionPapers', institutionId),
    countAll('memberships', institutionId),
    countBetween('exports', institutionId, monthStart(now), new Date(now.getFullYear(), now.getMonth() + 1, 1)),
  ]);
  const v = { questions, papers, users, exportsMonth };
  cache.set(institutionId, { t: Date.now(), v });
  return v;
}

export const invalidateUsage = (institutionId) => cache.delete(institutionId);

const USAGE_KEY = { questions: 'questions', papers: 'papers', users: 'users', exportsPerMonth: 'exportsMonth' };

// Returns an error message when the plan limit is reached, otherwise null.
// This is a client-side guard; see PROJECT_DOCUMENTATION.md for server-side enforcement notes.
export async function checkLimit(institution, key, adding = 1) {
  const limit = limitOf(institution.plan, key);
  if (limit === -1) return null;
  const usage = await getUsage(institution.id);
  if ((usage[USAGE_KEY[key]] || 0) + adding > limit) return `Your ${institution.plan} plan allows ${limit} ${key === 'exportsPerMonth' ? 'exports per month' : key}. Upgrade the plan to continue.`;
  return null;
}

export async function startPayment({ institutionId, plan }) {
  const fn = httpsCallable(functions, 'createPaymentSession');
  const res = await fn({ institutionId, plan, returnUrl: window.location.origin });
  return res.data;
}
