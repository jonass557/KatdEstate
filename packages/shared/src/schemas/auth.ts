import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Adresse email invalide').max(254, 'Adresse email trop longue');
export const passwordSchema = z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères').max(128, 'Le mot de passe est trop long').regex(/[a-z]/, 'Au moins une lettre minuscule est requise').regex(/[A-Z]/, 'Au moins une lettre majuscule est requise').regex(/[0-9]/, 'Au moins un chiffre est requis');
export const displayNameSchema = z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(120, 'Le nom est trop long');
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Le mot de passe est requis').max(128) }).strict();
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  role: z.enum(['OWNER', 'TENANT', 'AGENT', 'NEIGHBORHOOD_LEADER', 'BLOCK_LEADER', 'RESIDENT']).optional(),
  phone: z.string().max(32).optional(),
}).strict();
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(20).max(4096).optional() }).strict();
export const passwordResetRequestSchema = z.object({ email: emailSchema }).strict();
export const passwordResetSchema = z.object({ token: z.string().min(20).max(4096), password: passwordSchema }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'), newPassword: passwordSchema }).strict();
export const emailVerificationSchema = z.object({ token: z.string().min(20).max(4096) }).strict();
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterOutput = z.output<typeof registerSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
