import { z } from 'zod';

const email = z.string().trim().email('Enter a valid email address');

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const resetSchema = z.object({ email });
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const institutionSchema = z.object({
  name: z.string().trim().min(2, 'Enter the institution name'),
  type: z.string().min(1, 'Choose a type'),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  website: z.string().trim().url('Enter a full address starting with https://').optional().or(z.literal('')),
  info: z.string().optional(),
});
