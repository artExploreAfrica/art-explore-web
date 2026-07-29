import { Role } from '@prisma/client';
import { z } from 'zod';

/** Staff roles only — public USER accounts are created via /auth/signup. */
export const staffRoleSchema = z.enum([Role.ADMIN, Role.SUPER_ADMIN]);

export const createUserSchema = z.object({
  fullName: z.string().min(2, 'fullName must be at least 2 characters'),
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  role: staffRoleSchema.optional().default(Role.ADMIN),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
