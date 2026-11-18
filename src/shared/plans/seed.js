// Seed data for the `plans` collection = exactly today's five tiers (limits and prices mirror src/constants/plans.js,
// functions/src/payments/sslcommerz.js PRICES and functions/src/ai/generateQuestions.js AI_CREDITS; a test enforces it).
// -1 means unlimited. Values marked PROPOSED are new in the enterprise spec and are placeholders for the Phase 4 admin
// screens to edit; they never reduce what a plan could already do.
import { TIER_IDS } from './tiers.js';

const FEATURES_BASE = { customTemplates: true, collaboration: true, advancedAnalytics: false, messaging: false, apiAccess: false, whiteLabel: false, prioritySupport: false };

const mk = (id, name, price, limits, features = {}) => ({
  id,
  name,
  rank: TIER_IDS.indexOf(id),
  status: 'active',
  visibility: 'public',
  currency: 'BDT',
  pricing: { monthly: price, yearly: null, trialDays: 0, graceDays: 0 }, // yearly/trial/grace: PROPOSED, decide in Phase 4
  limits,
  features: { ...FEATURES_BASE, ...features }, // new keys are PROPOSED defaults
  templateAccess: { mode: 'rank', maxRank: TIER_IDS.indexOf(id) },
});

export const PLAN_SEED = {
  free: mk('free', { en: 'Free', bn: 'ফ্রি' }, 0, { users: 3, papers: 5, questions: 100, aiCredits: 5, exportsPerMonth: 10 }),
  starter: mk('starter', { en: 'Starter', bn: 'স্টার্টার' }, 500, { users: 10, papers: 50, questions: 1000, aiCredits: 50, exportsPerMonth: 100 }, { messaging: true }),
  professional: mk('professional', { en: 'Professional', bn: 'প্রফেশনাল' }, 1500, { users: 30, papers: 300, questions: 10000, aiCredits: 300, exportsPerMonth: 1000 }, { messaging: true, advancedAnalytics: true }),
  institution: mk('institution', { en: 'Institution', bn: 'ইনস্টিটিউশন' }, 4000, { users: 150, papers: -1, questions: -1, aiCredits: 1500, exportsPerMonth: -1 }, { messaging: true, advancedAnalytics: true, prioritySupport: true }),
  enterprise: mk('enterprise', { en: 'Enterprise', bn: 'এন্টারপ্রাইজ' }, null, { users: -1, papers: -1, questions: -1, aiCredits: -1, exportsPerMonth: -1 }, { messaging: true, advancedAnalytics: true, prioritySupport: true, apiAccess: true, whiteLabel: true }),
};

export const PLAN_SEED_LIST = TIER_IDS.map((id) => PLAN_SEED[id]);

// Old shape used by the legacy UI (src/constants/plans.js): lets legacy code read from the new source during migration.
export const legacyPlanView = (plan) => ({
  id: plan.id,
  price: plan.pricing.monthly,
  limits: { ...plan.limits, advancedTemplates: plan.templateAccess.maxRank >= 1 },
});
