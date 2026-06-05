import { AuditAction, Prisma, TargetModel } from '@prisma/client';
import prisma from '../config/db';

/**
 * Writes an entry to the AuditLog table. Call this from the SERVICE layer
 * on every write action (create / update / delete / publish / deactivate /
 * image upload) — never from controllers (Guide §6.5).
 *
 * `targetId` is a generic reference: when targetModel === INSTITUTION it
 * points at an Institution row; when USER, at a User row.
 */
export const auditLog = async (
  actorId: string,
  action: AuditAction,
  targetModel: TargetModel,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetModel,
      targetId,
      metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
};
