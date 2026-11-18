// PLATFORM-LEVEL (staff) permissions for the Super Admin Control Center.
// These are the SEEDED DEFAULTS of the `adminRoles` collection; the Super Admin can edit them later,
// but code must never grant a staff member anything that is not in the table for their role.
// Permission strings are namespaced. A role may hold '*' (everything) or 'prefix.*' (a whole namespace).

export const PLATFORM_PERMISSIONS = [
  'users.read', 'users.write', 'users.suspend', 'users.delete', 'users.restore', 'users.plan', 'users.notify', 'users.impersonate',
  'institutions.read', 'institutions.write', 'institutions.suspend', 'institutions.delete',
  'plans.read', 'plans.write', 'plans.delete',
  'payments.read', 'payments.verify', 'payments.refund', 'payments.gateway',
  'invoices.read', 'invoices.write', 'coupons.read', 'coupons.write',
  'templates.read', 'templates.write', 'templates.publish', 'templates.delete', 'templates.pricing',
  'cms.read', 'cms.write', 'cms.publish', 'announcements.write', 'notifications.broadcast',
  'ai.read', 'ai.configure', 'ai.test', 'ai.credits',
  'security.read', 'security.write', 'audit.read',
  'system.read', 'system.write', 'featureflags.write', 'maintenance.toggle', 'backups.read', 'backups.run',
  'staff.read', 'staff.manage',
  'support.read', 'support.reply', 'support.assign',
  'moderation.review', 'moderation.access',
  'analytics.users.read', 'analytics.revenue.read', 'analytics.exams.read', 'analytics.ai.read', 'analytics.templates.read',
];

export const PLATFORM_ROLES = ['super_admin', 'platform_admin', 'finance_admin', 'user_support_admin', 'template_manager', 'content_manager', 'technical_admin', 'analytics_manager'];

export const PLATFORM_ROLE_LABELS = {
  super_admin: { en: 'Super Admin', bn: 'সুপার অ্যাডমিন' },
  platform_admin: { en: 'Platform Admin', bn: 'প্ল্যাটফর্ম অ্যাডমিন' },
  finance_admin: { en: 'Finance Admin', bn: 'ফাইন্যান্স অ্যাডমিন' },
  user_support_admin: { en: 'User Support Admin', bn: 'ইউজার সাপোর্ট অ্যাডমিন' },
  template_manager: { en: 'Template Manager', bn: 'টেমপ্লেট ম্যানেজার' },
  content_manager: { en: 'Content Manager', bn: 'কনটেন্ট ম্যানেজার' },
  technical_admin: { en: 'Technical Admin', bn: 'টেকনিক্যাল অ্যাডমিন' },
  analytics_manager: { en: 'Analytics Manager', bn: 'অ্যানালিটিক্স ম্যানেজার' },
};

export const DEFAULT_PLATFORM_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  platform_admin: ['users.read', 'users.write', 'users.suspend', 'users.restore', 'users.plan', 'users.notify', 'institutions.read', 'institutions.write', 'institutions.suspend', 'plans.read', 'templates.read', 'cms.read', 'announcements.write', 'notifications.broadcast', 'support.read', 'support.reply', 'support.assign', 'analytics.users.read', 'analytics.exams.read', 'audit.read', 'system.read'],
  finance_admin: ['payments.read', 'payments.verify', 'payments.refund', 'payments.gateway', 'invoices.read', 'invoices.write', 'coupons.read', 'coupons.write', 'plans.read', 'plans.write', 'users.read', 'users.plan', 'institutions.read', 'analytics.revenue.read'],
  user_support_admin: ['users.read', 'users.notify', 'institutions.read', 'support.read', 'support.reply', 'support.assign', 'moderation.review'],
  template_manager: ['templates.read', 'templates.write', 'templates.publish', 'templates.delete', 'templates.pricing', 'analytics.templates.read'],
  content_manager: ['cms.read', 'cms.write', 'cms.publish', 'announcements.write', 'notifications.broadcast'],
  technical_admin: ['system.read', 'system.write', 'featureflags.write', 'maintenance.toggle', 'backups.read', 'backups.run', 'ai.read', 'ai.configure', 'ai.test', 'ai.credits', 'security.read', 'security.write', 'audit.read', 'analytics.ai.read'],
  analytics_manager: ['analytics.users.read', 'analytics.revenue.read', 'analytics.exams.read', 'analytics.ai.read', 'analytics.templates.read'],
};

// True when one granted entry covers the requested permission.
export function grantMatches(granted, perm) {
  if (granted === '*') return true;
  if (granted === perm) return true;
  return granted.endsWith('.*') && perm.startsWith(granted.slice(0, -1));
}

export function platformCan(roleId, perm, table = DEFAULT_PLATFORM_ROLE_PERMISSIONS) {
  if (!roleId || typeof perm !== 'string' || !perm) return false;
  const grants = table[roleId];
  if (!Array.isArray(grants)) return false;
  return grants.some((g) => grantMatches(g, perm));
}
