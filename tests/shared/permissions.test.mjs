import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROLES as LEGACY_ROLES, ROLE_PERMISSIONS as LEGACY_PERMS, PAPER_FULL_ACCESS as LEGACY_FULL, PUBLISHED_STATUSES as LEGACY_PUBLISHED } from '../../src/constants/roles.js';
import {
  TENANT_ROLES, TENANT_ROLE_PERMISSIONS, TENANT_PERMISSIONS, PAPER_FULL_ACCESS, PUBLISHED_STATUSES, roleCan, rolesWith,
  PLATFORM_ROLES, PLATFORM_PERMISSIONS, DEFAULT_PLATFORM_ROLE_PERMISSIONS, platformCan, grantMatches, RULE_FUNCTIONS, renderRuleHelpers,
} from '../../src/shared/permissions/index.js';

const rulesText = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

test('tenant matrix keeps every legacy role and permission (only the two named extras were added)', () => {
  assert.deepEqual(TENANT_ROLES, LEGACY_ROLES);
  assert.deepEqual(PAPER_FULL_ACCESS, LEGACY_FULL);
  assert.deepEqual(PUBLISHED_STATUSES, LEGACY_PUBLISHED);
  const extras = new Set(['types.manage', 'logs.view']);
  for (const role of LEGACY_ROLES) {
    const legacy = new Set(LEGACY_PERMS[role]);
    const shared = new Set(TENANT_ROLE_PERMISSIONS[role]);
    for (const p of legacy) assert.ok(shared.has(p), `${role} lost ${p}`);
    for (const p of shared) if (!legacy.has(p)) assert.ok(extras.has(p), `${role} gained unexpected ${p}`);
  }
  assert.equal(TENANT_PERMISSIONS.length, 22);
});

test('role helper functions in firestore.rules are exactly what the matrix generates (finding S-15: no drift)', () => {
  const fromRules = new Map();
  for (const m of rulesText.matchAll(/function (\w+)\(r\) \{ return r in (\[[^\]]*\]); \}/g)) fromRules.set(m[1], m[2]);
  const generated = renderRuleHelpers();
  assert.equal(generated.length, RULE_FUNCTIONS.length);
  for (const line of generated) {
    const m = line.match(/^function (\w+)\(r\) \{ return r in (\[[^\]]*\]); \}$/);
    assert.ok(m, `bad generated line: ${line}`);
    assert.ok(fromRules.has(m[1]), `rules file has no function ${m[1]}`);
    assert.equal(fromRules.get(m[1]), m[2], `${m[1]} differs between firestore.rules and the matrix`);
  }
  // and the rules file does not define role-list helpers the matrix does not know about
  assert.deepEqual([...fromRules.keys()].sort(), RULE_FUNCTIONS.map(([n]) => n).sort());
});

test('roleCan / rolesWith behave', () => {
  assert.equal(roleCan('teacher', 'ai.use'), true);
  assert.equal(roleCan('viewer', 'papers.create'), false);
  assert.equal(roleCan(undefined, 'papers.view'), false);
  assert.equal(roleCan('nobody', 'papers.view'), false);
  assert.deepEqual(rolesWith('papers.publish'), ['institution_admin', 'examination_controller']);
  assert.deepEqual(rolesWith('billing.manage'), ['institution_admin']);
});

test('platform roles: the 8 staff roles exist and only hold catalogued permissions', () => {
  assert.equal(PLATFORM_ROLES.length, 8);
  assert.deepEqual(Object.keys(DEFAULT_PLATFORM_ROLE_PERMISSIONS).sort(), [...PLATFORM_ROLES].sort());
  const known = new Set(PLATFORM_PERMISSIONS);
  assert.equal(known.size, PLATFORM_PERMISSIONS.length, 'duplicate permission in catalog');
  for (const [role, grants] of Object.entries(DEFAULT_PLATFORM_ROLE_PERMISSIONS)) {
    if (role === 'super_admin') continue;
    for (const g of grants) assert.ok(known.has(g), `${role} holds unknown permission ${g}`);
    assert.equal(new Set(grants).size, grants.length, `${role} has duplicate grants`);
  }
});

test('platform roles: no staff member can do anything outside their role (least privilege)', () => {
  // sensitive capabilities exist for super_admin only
  const superOnly = ['staff.manage', 'staff.read', 'users.impersonate', 'moderation.access', 'users.delete', 'institutions.delete', 'plans.delete'];
  for (const role of PLATFORM_ROLES.filter((r) => r !== 'super_admin')) {
    for (const p of superOnly) assert.equal(platformCan(role, p), false, `${role} must not have ${p}`);
  }
  for (const p of PLATFORM_PERMISSIONS) assert.equal(platformCan('super_admin', p), true);

  const expectNo = {
    finance_admin: ['users.suspend', 'templates.publish', 'cms.write', 'system.write', 'security.write', 'ai.configure', 'backups.run'],
    user_support_admin: ['payments.read', 'payments.refund', 'plans.write', 'templates.write', 'system.read', 'users.suspend', 'users.write'],
    template_manager: ['payments.read', 'users.read', 'cms.write', 'ai.read', 'system.read', 'analytics.revenue.read'],
    content_manager: ['users.read', 'payments.read', 'templates.write', 'system.write', 'ai.configure'],
    technical_admin: ['payments.refund', 'users.suspend', 'cms.write', 'templates.publish', 'plans.write'],
    analytics_manager: ['users.read', 'payments.read', 'templates.write', 'cms.write', 'system.write', 'audit.read'],
    platform_admin: ['payments.refund', 'plans.write', 'system.write', 'staff.manage', 'backups.run', 'ai.configure', 'security.write'],
  };
  for (const [role, perms] of Object.entries(expectNo)) for (const p of perms) assert.equal(platformCan(role, p), false, `${role} must not have ${p}`);

  const expectYes = {
    finance_admin: ['payments.refund', 'invoices.write', 'coupons.write', 'analytics.revenue.read'],
    user_support_admin: ['users.read', 'support.reply', 'moderation.review'],
    template_manager: ['templates.publish', 'templates.pricing', 'analytics.templates.read'],
    content_manager: ['cms.publish', 'announcements.write'],
    technical_admin: ['maintenance.toggle', 'backups.run', 'ai.configure', 'security.write'],
    analytics_manager: ['analytics.users.read', 'analytics.ai.read'],
    platform_admin: ['users.suspend', 'institutions.suspend', 'support.assign'],
  };
  for (const [role, perms] of Object.entries(expectYes)) for (const p of perms) assert.equal(platformCan(role, p), true, `${role} should have ${p}`);
});

test('every catalogued platform permission is granted to at least one non-super role, except the super-only ones', () => {
  const superOnly = new Set(['staff.manage', 'staff.read', 'users.impersonate', 'moderation.access', 'users.delete', 'institutions.delete', 'plans.delete']);
  for (const p of PLATFORM_PERMISSIONS) {
    if (superOnly.has(p)) continue;
    const holders = PLATFORM_ROLES.filter((r) => r !== 'super_admin' && platformCan(r, p));
    assert.ok(holders.length > 0, `${p} is granted to nobody`);
  }
});

test('grant matching: wildcard, namespace wildcard and exact; unknown inputs are denied', () => {
  assert.equal(grantMatches('*', 'anything.at.all'), true);
  assert.equal(grantMatches('users.*', 'users.read'), true);
  assert.equal(grantMatches('users.*', 'usersx.read'), false);
  assert.equal(grantMatches('users.*', 'institutions.read'), false);
  assert.equal(grantMatches('users.read', 'users.read'), true);
  assert.equal(grantMatches('users.read', 'users.readall'), false);
  const table = { custom: ['analytics.*'] };
  assert.equal(platformCan('custom', 'analytics.revenue.read', table), true);
  assert.equal(platformCan('custom', 'users.read', table), false);
  assert.equal(platformCan('ghost', 'users.read', table), false);
  assert.equal(platformCan('', 'users.read'), false);
  assert.equal(platformCan('super_admin', ''), false);
  assert.equal(platformCan('super_admin', undefined), false);
});
