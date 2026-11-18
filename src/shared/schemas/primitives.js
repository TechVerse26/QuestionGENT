// Small reusable Zod building blocks. Server handlers validate EVERY input with these (spec section 17: Zod validation).
import { z } from 'zod';

// Control characters (except tab/newline in long text) never belong in a name, title or id.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');

export const emailSchema = z.string().trim().toLowerCase().min(3).max(254).email('Enter a valid email address');

export const textSchema = (max, { min = 0 } = {}) => z.string().trim().min(min).max(max).refine((s) => !CONTROL.test(s), 'Contains invalid characters');

export const longTextSchema = (max) => z.string().max(max).refine((s) => !CONTROL.test(s), 'Contains invalid characters');

export const httpsUrlSchema = z.string().trim().max(2048).url().refine((u) => u.startsWith('https://'), 'Use a full address starting with https://');

export const langSchema = z.enum(['en', 'bn']);

export const optionalText = (max) => textSchema(max).optional().default('');
