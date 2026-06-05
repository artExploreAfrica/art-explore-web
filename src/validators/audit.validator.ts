import { AuditAction, TargetModel } from '@prisma/client';
import { z } from 'zod';

/** Pagination + optional filters for the audit trail. */
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  actorId: z.string().min(1).optional(),
  action: z.nativeEnum(AuditAction).optional(),
  targetModel: z.nativeEnum(TargetModel).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
