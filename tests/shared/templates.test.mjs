import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_TEMPLATES } from '../../src/constants/plans.js';
import { BUILTIN_TEMPLATES } from '../../src/constants/templates.js';
import { PLAN_SEED_LIST, resolveEntitlements } from '../../src/shared/plans/index.js';
import {
  TEMPLATE_CATALOG, TEMPLATE_ACCESS_MATRIX, LEGACY_TEMPLATE_IDS, SYSTEM_TEMPLATE_IDS, TIER_IDS, accessibleTemplates, canUseTemplate, templateById,
} from '../../src/shared/templates/catalog.js';

test('catalog: 50 templates, numbered 1..50, unique ids, 20 free + 30 paid', () => {
  assert.equal(TEMPLATE_CATALOG.length, 50);
  assert.deepEqual(TEMPLATE_CATALOG.map((t) => t.number), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(new Set(TEMPLATE_CATALOG.map((t) => t.id)).size, 50, 'duplicate template id');
  assert.equal(new Set(TEMPLATE_CATALOG.map((t) => t.name.en)).size, 50, 'duplicate template name');
  assert.equal(TEMPLATE_CATALOG.filter((t) => t.tier === 'free').length, 20);
  assert.equal(TEMPLATE_CATALOG.filter((t) => t.tier !== 'free').length, 30);
  for (const t of TEMPLATE_CATALOG) assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${t.id}`);
});

test('access matrix: Free 20 / Starter 28 / Professional 38 / Institution 45 / Enterprise 50, each tier includes all lower tiers', () => {
  let previous = new Set();
  TIER_IDS.forEach((tier, rank) => {
    const ids = new Set(accessibleTemplates(rank).map((t) => t.id));
    assert.equal(ids.size, TEMPLATE_ACCESS_MATRIX[tier], `${tier} should see ${TEMPLATE_ACCESS_MATRIX[tier]}`);
    for (const id of previous) assert.ok(ids.has(id), `${tier} lost ${id} from a lower tier`);
    previous = ids;
  });
  assert.deepEqual(TEMPLATE_ACCESS_MATRIX, { free: 20, starter: 28, professional: 38, institution: 45, enterprise: 50 });
});

test('the matrix is wired to the seeded plans: a plan\'s maxRank yields exactly its template count', () => {
  for (const p of PLAN_SEED_LIST) {
    const ent = resolveEntitlements({ subscription: p.id === 'free' ? null : { planId: p.id, status: 'active' } });
    assert.equal(accessibleTemplates(ent.templateAccess.maxRank).length, TEMPLATE_ACCESS_MATRIX[p.id], p.id);
  }
});

test('canUseTemplate is a server-side gate: paid ids refused on lower plans, unknown ids refused, blank layout always allowed', () => {
  assert.equal(canUseTemplate('classic', 0), true);
  assert.equal(canUseTemplate('omr-mcq', 0), false);
  assert.equal(canUseTemplate('omr-mcq', 1), true);
  assert.equal(canUseTemplate('bloom-blueprint', 1), false);
  assert.equal(canUseTemplate('bloom-blueprint', 2), true);
  assert.equal(canUseTemplate('qr-barcode-verified', 2), false);
  assert.equal(canUseTemplate('qr-barcode-verified', 3), true);
  assert.equal(canUseTemplate('enterprise-configurable', 3), false);
  assert.equal(canUseTemplate('enterprise-configurable', 4), true);
  assert.equal(canUseTemplate('does-not-exist', 4), false);
  assert.equal(canUseTemplate('', 4), false);
  for (const id of SYSTEM_TEMPLATE_IDS) assert.equal(canUseTemplate(id, 0), true);
});

test('every preset that exists today keeps its id, so stored papers stay valid', () => {
  const legacyIds = BUILTIN_TEMPLATES.map((t) => t.id);
  assert.deepEqual([...legacyIds].sort(), [...LEGACY_TEMPLATE_IDS].sort(), 'legacy preset list changed; update LEGACY_TEMPLATE_IDS');
  for (const id of LEGACY_TEMPLATE_IDS) assert.ok(templateById(id) || SYSTEM_TEMPLATE_IDS.includes(id), `legacy template ${id} missing from the catalog`);
});

test('BEHAVIOUR CHANGE (decision D4): the five presets locked behind paid plans today are Free in the master prompt', () => {
  for (const id of ADVANCED_TEMPLATES) assert.equal(templateById(id).tier, 'free', `${id} is ${templateById(id).tier} in the catalog`);
});

test('spot-check names against the master prompt list', () => {
  assert.equal(templateById('classic').name.en, 'Classic Academic');
  assert.equal(TEMPLATE_CATALOG[8].name.en, 'SSC Board Style');
  assert.equal(TEMPLATE_CATALOG[9].name.en, 'HSC Board Style');
  assert.equal(TEMPLATE_CATALOG[28].name.en, "Bloom's Taxonomy Blueprint");
  assert.equal(TEMPLATE_CATALOG[44].name.en, 'Term & Semester Assessment');
  assert.equal(TEMPLATE_CATALOG[49].name.en, 'Fully Configurable Enterprise Layout');
});
