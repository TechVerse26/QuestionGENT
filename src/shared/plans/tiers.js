// Plan tiers in ascending order. A plan's `rank` is its index here; higher ranks include everything below.
// The set of PLANS is dynamic (Firestore `plans`, Phase 4); these five ids are only the seeded defaults and
// the vocabulary of the template-access matrix. Do not hard-code "how many plans exist" anywhere else.
export const TIER_IDS = ['free', 'starter', 'professional', 'institution', 'enterprise'];
export const tierRank = (id) => Math.max(0, TIER_IDS.indexOf(id));
