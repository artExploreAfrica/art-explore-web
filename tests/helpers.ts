import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';

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
