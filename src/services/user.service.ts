import { AuditAction, Prisma, Role, TargetModel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { redis } from '../config/redis';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { sendWelcomeEmail } from '../utils/mailer';
import { PaginationMeta } from '../utils/response';
import { CreateUserInput, ListUsersQuery } from '../validators/user.validator';

const BCRYPT_ROUNDS = 10;

/** Staff accounts managed via the Super Admin user panel. */
const STAFF_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Never return password hashes from this service. */
const SAFE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_SELECT }>;

interface ListResult {
  data: SafeUser[];
  pagination: PaginationMeta;
}

/**
 * List users (Super Admin only). Defaults to staff, which is what this endpoint
 * has always returned; `role=USER` surfaces public accounts, which were
 * otherwise only visible as a count on the dashboard and so could never be
 * found in order to be deactivated.
 */
export const list = async (query: ListUsersQuery): Promise<ListResult> => {
  const { page, limit, role } = query;
  const where: Prisma.UserWhereInput = { role: role ?? { in: STAFF_ROLES } };
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

/** Create a new staff user (Super Admin only). */
export const create = async (
  actorId: string,
  input: CreateUserInput,
): Promise<SafeUser> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ConflictError('An account with that email already exists');

  const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      password: hashed,
      role: input.role,
    },
    select: SAFE_SELECT,
  });

  await auditLog(actorId, AuditAction.CREATE, TargetModel.USER, user.id, {
    email: user.email,
    role: user.role,
  });

  // Best-effort welcome email — never fail the create if Resend is unset/down.
  void sendWelcomeEmail(user.email, user.fullName, user.role);

  return user;
};

/** Deactivate a staff user and revoke their refresh token. */
export const deactivate = async (actorId: string, targetId: string): Promise<SafeUser> => {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw NotFoundError('User');

  if (target.id === actorId) {
    throw new AppError('You cannot deactivate your own account', 400);
  }
  if (target.role === Role.SUPER_ADMIN) {
    throw new AppError('Super Admin accounts cannot be deactivated', 403);
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
    select: SAFE_SELECT,
  });

  // Revoke any active session immediately.
  await redis.del(`refresh:${targetId}`);

  await auditLog(actorId, AuditAction.DEACTIVATE, TargetModel.USER, targetId);
  return user;
};

/** Reactivate a previously deactivated staff user. */
export const activate = async (actorId: string, targetId: string): Promise<SafeUser> => {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw NotFoundError('User');

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: true },
    select: SAFE_SELECT,
  });

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.USER, targetId, {
    action: 'ACTIVATE',
  });
  return user;
};

/** Used by the dashboard counts — staff roles only. */
export const countAdmins = (): Promise<number> =>
  prisma.user.count({ where: { role: { in: STAFF_ROLES } } });
