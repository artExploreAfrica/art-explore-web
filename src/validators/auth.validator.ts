import { Role } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'fullName must be at least 2 characters'),
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  role: z.nativeEnum(Role).optional().default(Role.ADMIN),
});

/**
 * Public self-registration. Has no `role` field — the role is forced to USER
 * server-side so a caller can never grant themselves admin access.
 */
export const publicRegisterSchema = z.object({
  fullName: z.string().min(2, 'fullName must be at least 2 characters'),
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type PublicRegisterInput = z.infer<typeof publicRegisterSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
