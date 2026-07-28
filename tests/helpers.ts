import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Mock } from 'vitest';

/** Sign a valid access token for a given role, using the test JWT secret. */
export const signAccess = (
  role: Role,
  id = 'user_test',
  email = 'admin@test.dev',
): string =>
  jwt.sign({ sub: id, email, role }, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: '15m',
  });

/** Authorization header helper for supertest. */
export const bearer = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Stub `prisma.user.findUnique` so `authenticate` (DB isActive + role check)
 * succeeds for the given role. Call in beforeEach or per-test before requests
 * that send a Bearer token.
 */
export const stubActiveUser = (
  findUnique: Mock,
  role: Role,
  overrides: Partial<{
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
  }> = {},
): void => {
  const id = overrides.id ?? 'user_test';
  const email = overrides.email ?? 'admin@test.dev';
  findUnique.mockResolvedValue({
    id,
    email,
    fullName: overrides.fullName ?? 'Test User',
    role,
    isActive: overrides.isActive ?? true,
    password: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};
