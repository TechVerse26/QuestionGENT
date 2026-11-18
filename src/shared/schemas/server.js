// Input schemas for the trusted server API (Phase 2 onwards). They mirror today's client forms and the limits already used by
// the legacy Cloud Function, but are STRICTER: unknown keys are rejected, sizes are bounded, enums are closed.
import { z } from 'zod';
import { idSchema, emailSchema, textSchema, longTextSchema, httpsUrlSchema, optionalText, langSchema } from './primitives.js';
import { TENANT_ROLES } from '../permissions/tenant.js';
import { PLATFORM_ROLES } from '../permissions/platform.js';

export const INSTITUTION_TYPE_IDS = ['school', 'college', 'university', 'madrasa', 'coaching', 'academy', 'training', 'other'];

// ---- session: the browser sends the Firebase ID token once after sign-in; the server answers with an HttpOnly cookie
export const sessionCreateInput = z.object({ idToken: z.string().min(50).max(4096).regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'Not a token') }).strict();

// ---- institutions
export const institutionCreateInput = z.object({
  name: textSchema(120, { min: 2 }),
  type: z.enum(INSTITUTION_TYPE_IDS),
  address: optionalText(300),
  phone: optionalText(40),
  email: z.union([emailSchema, z.literal('')]).optional().default(''),
  website: z.union([httpsUrlSchema, z.literal('')]).optional().default(''),
  logoUrl: z.union([httpsUrlSchema, z.literal('')]).optional().default(''),
  info: z.string().max(2000).optional().default(''),
}).strict();

export const inviteCreateInput = z.object({ institutionId: idSchema, email: emailSchema, role: z.enum(TENANT_ROLES) }).strict();
export const memberRoleChangeInput = z.object({ institutionId: idSchema, uid: idSchema, role: z.enum(TENANT_ROLES) }).strict();
export const memberRemoveInput = z.object({ institutionId: idSchema, uid: idSchema }).strict();

// ---- files (Phase 2 skeleton, used fully in Phase 6). No SVG, no HTML, no executables: only types listed here.
const MB = 1024 * 1024;
const IMG = ['image/png', 'image/jpeg', 'image/webp'];
export const UPLOAD_PURPOSES = {
  logo: { types: IMG, maxBytes: 2 * MB },
  avatar: { types: IMG, maxBytes: 1 * MB },
  'question-image': { types: [...IMG, 'image/gif'], maxBytes: 5 * MB },
  attachment: {
    types: [...IMG, 'application/pdf', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxBytes: 15 * MB,
  },
  'voice-message': { types: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'], maxBytes: 10 * MB },
};
export const EXTENSIONS = {
  'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'], 'image/gif': ['gif'], 'application/pdf': ['pdf'], 'text/plain': ['txt'], 'text/csv': ['csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'audio/webm': ['webm'], 'audio/ogg': ['ogg'], 'audio/mp4': ['m4a', 'mp4'], 'audio/mpeg': ['mp3'],
};

// "C:\fakepath\..\my report (final).PDF " -> "my report (final).pdf"
export function sanitizeFileName(name) {
  // eslint-disable-next-line no-control-regex
  let n = String(name ?? '').replace(/[\u0000-\u001F\u007F]/g, '').split(/[\\/]/).pop().trim().replace(/\s+/g, ' ');
  n = n.replace(/^\.+/, '');
  const dot = n.lastIndexOf('.');
  if (dot > 0) n = n.slice(0, dot) + n.slice(dot).toLowerCase();
  return n.slice(-120);
}

export const uploadRequestInput = z.object({
  institutionId: idSchema,
  purpose: z.enum(Object.keys(UPLOAD_PURPOSES)),
  fileName: z.string().min(1).max(400).transform(sanitizeFileName),
  contentType: z.string().max(120).transform((s) => s.toLowerCase().trim()),
  size: z.number().int().positive(),
}).strict().superRefine((v, ctx) => {
  const rule = UPLOAD_PURPOSES[v.purpose];
  if (!rule.types.includes(v.contentType)) ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'This file type is not allowed here' });
  if (v.size > rule.maxBytes) ctx.addIssue({ code: 'custom', path: ['size'], message: `File must be at most ${Math.round(rule.maxBytes / MB)} MB` });
  const ext = v.fileName.includes('.') ? v.fileName.split('.').pop() : '';
  if (!v.fileName || v.fileName === '.' || !(EXTENSIONS[v.contentType] || []).includes(ext)) ctx.addIssue({ code: 'custom', path: ['fileName'], message: 'The file extension does not match the file type' });
});

// ---- AI generation: the same limits the legacy Cloud Function applies
export const AI_QUESTION_TYPES = ['mcq', 'cq', 'short', 'broad', 'math', 'tf'];
export const aiGenerateInput = z.object({
  institutionId: idSchema,
  type: z.enum(AI_QUESTION_TYPES),
  count: z.number().int().min(1).max(20).default(5),
  subject: textSchema(120, { min: 1 }),
  className: optionalText(80),
  chapter: optionalText(160),
  topic: optionalText(160),
  objectives: longTextSchema(1500).optional().default(''),
  material: longTextSchema(12000).optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  language: langSchema.default('bn'),
  marks: z.number().positive().max(50).default(1),
}).strict();

// ---- MFA and staff (Phase 3)
export const totpCodeInput = z.object({ code: z.string().trim().regex(/^\d{3} ?\d{3}$/, 'Enter the 6-digit code') }).strict();
export const recoveryCodeInput = z.object({ code: z.string().trim().regex(/^[0-9a-fA-F]{5}[- ]?[0-9a-fA-F]{5}$/, 'Enter a recovery code') }).strict();
export const staffCreateInput = z.object({ email: emailSchema, roleId: z.enum(PLATFORM_ROLES), displayName: textSchema(80, { min: 2 }) }).strict();
