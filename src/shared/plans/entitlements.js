// Pure entitlement engine: no I/O. The server wraps these in Firestore transactions; the UI may call them only to
// PREDICT (e.g. grey out a button) - never as the enforcement.
import { PLAN_SEED } from './seed.js';

export const UNLIMITED = -1;

// limit key -> which usage counter backs it, and whether it resets monthly.
// NOTE (decision D11): legacy `aiCredits` was a lifetime allowance (institutions.aiUsed). A monthly window is proposed.
export const LIMIT_DEFS = {
  users: { counter: 'members', window: 'total' },
  papers: { counter: 'papers', window: 'total' },
  questions: { counter: 'questions', window: 'total' },
  exportsPerMonth: { counter: 'exports', window: 'month' },
  aiCredits: { counter: 'aiCredits', window: 'month' },
};

// Calendar month in Asia/Dhaka (UTC+6) by default so monthly limits roll over at local midnight.
export function monthKey(now = Date.now(), tzOffsetMinutes = 360) {
  const d = new Date(Number(now) + tzOffsetMinutes * 60000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const emptyUsage = () => ({ counters: {}, months: {} });

export function counterValue(usage, limitKey, now = Date.now(), tz = 360) {
  const def = LIMIT_DEFS[limitKey];
  if (!def) return 0;
  if (def.window === 'month') return Number(usage?.months?.[monthKey(now, tz)]?.[def.counter]) || 0;
  return Number(usage?.counters?.[def.counter]) || 0;
}

export function applyUsage(usage, limitKey, delta, now = Date.now(), tz = 360) {
  const def = LIMIT_DEFS[limitKey];
  if (!def) throw new Error(`Unknown limit key: ${limitKey}`);
  const base = usage || emptyUsage();
  const next = { counters: { ...(base.counters || {}) }, months: { ...(base.months || {}) } };
  if (def.window === 'month') {
    const mk = monthKey(now, tz);
    const cur = { ...(next.months[mk] || {}) };
    cur[def.counter] = Math.max(0, (Number(cur[def.counter]) || 0) + delta);
    next.months[mk] = cur;
  } else {
    next.counters[def.counter] = Math.max(0, (Number(next.counters[def.counter]) || 0) + delta);
  }
  return next;
}

const toMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

// Subscription -> effective status at `now`. Nothing here ever deletes data: expiry only changes what can be CREATED.
export function effectiveStatus(sub, now = Date.now()) {
  if (!sub) return { status: 'none', graceEndsAt: null };
  const end = toMs(sub.period?.end);
  const grace = toMs(sub.graceEndsAt);
  const inGrace = grace != null && now <= grace;
  switch (sub.status) {
    case 'active':
    case 'trialing':
      if (end == null || now <= end) return { status: sub.status, graceEndsAt: null };
      return inGrace ? { status: 'grace', graceEndsAt: grace } : { status: 'expired', graceEndsAt: null };
    case 'past_due':
    case 'grace':
      return inGrace ? { status: 'grace', graceEndsAt: grace } : { status: 'expired', graceEndsAt: null };
    default: // canceled, expired, unknown -> treated as ended
      return { status: 'expired', graceEndsAt: null };
  }
}

export function resolveEntitlements({ subscription = null, now = Date.now(), plans = PLAN_SEED } = {}) {
  const { status, graceEndsAt } = effectiveStatus(subscription, now);
  const expired = status === 'expired';
  const wantedId = !subscription || expired ? 'free' : subscription.planId;
  const plan = plans[wantedId] || plans.free || PLAN_SEED.free;
  const useOverrides = !!subscription && !expired;
  return {
    planId: plan.id,
    subscribedPlanId: subscription?.planId ?? null,
    status,
    graceEndsAt,
    softLocked: expired, // expired tenants fall back to the free plan: read/export stay, creating beyond free limits is refused
    limits: { ...plan.limits, ...(useOverrides ? subscription.overrides?.limits : {}) },
    features: { ...plan.features, ...(useOverrides ? subscription.overrides?.features : {}) },
    templateAccess: { ...plan.templateAccess, ...(useOverrides ? subscription.overrides?.templateAccess : {}) },
  };
}

// delta > 0 consumes, delta <= 0 releases (always allowed).
export function checkLimit(ent, usage, limitKey, delta = 1, now = Date.now(), tz = 360) {
  if (!LIMIT_DEFS[limitKey]) return { ok: false, code: 'UNKNOWN_LIMIT', key: limitKey };
  if (!(delta > 0)) return { ok: true };
  const limit = ent?.limits?.[limitKey];
  if (limit === undefined || limit === null) return { ok: false, code: 'LIMIT_NOT_CONFIGURED', key: limitKey };
  if (limit === UNLIMITED) return { ok: true, limit, used: counterValue(usage, limitKey, now, tz) };
  const used = counterValue(usage, limitKey, now, tz);
  if (used + delta <= limit) return { ok: true, limit, used, remaining: limit - used - delta };
  return {
    ok: false,
    code: ent.softLocked ? 'SUBSCRIPTION_EXPIRED' : 'LIMIT_EXCEEDED',
    key: limitKey,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
