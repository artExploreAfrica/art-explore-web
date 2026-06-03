import { Role, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { redis } from '../config/redis';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../utils/AppError';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwtHelper';
import { JwtPayload } from '../types/auth';

const BCRYPT_ROUNDS = 10;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const refreshKey = (userId: string): string => `refresh:${userId}`;

/** Public-safe user shape — never expose the password hash. */
export type SafeUser = Omit<User, 'password'>;

const toSafeUser = (user: User): SafeUser => {
  // Strip the password field without using `any`.
  const { password: _password, ...safe } = user;
  return safe;
};

const buildPayload = (user: Pick<User, 'id' | 'email' | 'role'>): JwtPayload => ({
  sub: user.id,
  email: user.email,
  role: user.role,
});

/**
 * Issues an access + refresh token pair and stores the HASHED refresh token
 * in Redis at `refresh:{userId}` with a 7-day TTL.
 */
const issueTokens = async (
  user: Pick<User, 'id' | 'email' | 'role'>,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload = buildPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const hashedRefresh = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
  await redis.set(refreshKey(user.id), hashedRefresh, { ex: REFRESH_TTL_SECONDS });

  return { accessToken, refreshToken };
};

/**
 * Register a new admin. Triggered by a Super Admin only (Guide §3.2) — the
 * route enforces that via roleGuard before this runs.
 */
export const register = async (input: {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}): Promise<SafeUser> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ConflictError('An account with that email already exists');
  }

  const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      password: hashed,
      role: input.role,
    },
  });

  return toSafeUser(user);
};

/** Validate credentials and issue tokens. */
export const login = async (
  email: string,
  password: string,
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw UnauthorizedError('Invalid email or password');
  }
  if (!user.isActive) {
    throw ForbiddenError('This account has been deactivated');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw UnauthorizedError('Invalid email or password');
  }

  const tokens = await issueTokens(user);
  return { user: toSafeUser(user), ...tokens };
};

/**
 * Rotate tokens from a valid refresh token. The presented token is verified
 * cryptographically AND checked against the hash stored in Redis, so a logged
 * out (deleted) token can no longer be used.
 */
export const refresh = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw UnauthorizedError('Invalid or expired refresh token');
  }

  const stored = await redis.get<string>(refreshKey(payload.sub));
  if (!stored) {
    throw UnauthorizedError('Refresh token has been revoked');
  }

  const matches = await bcrypt.compare(refreshToken, stored);
  if (!matches) {
    throw UnauthorizedError('Refresh token mismatch');
  }

  // Confirm the user still exists and is active before re-issuing.
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw UnauthorizedError('Account is no longer active');
  }

  return issueTokens(user);
};

/** Invalidate a user's refresh token by deleting the Redis key. */
export const logout = async (refreshToken: string): Promise<void> => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await redis.del(refreshKey(payload.sub));
  } catch {
    // Token already invalid/expired — nothing to revoke. Treat as success.
  }
};
