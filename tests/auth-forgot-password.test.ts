import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const activeUser = {
  id: 'user_1',
  fullName: 'Test Admin',
  email: 'admin@test.dev',
  password: bcrypt.hashSync('oldpassword123', 10),
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.set.mockResolvedValue('OK');
  });

  it('400s when the email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('200s and stores a reset token for a known active account', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: activeUser.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The hash is stored at reset:{hash} -> userId, plus a reverse index at
    // reset:user:{id} -> hash so a later request can revoke this token.
    const sets = Object.fromEntries(
      mocks.redis.set.mock.calls.map((c) => [c[0], c[1]] as [string, string]),
    );
    const tokenHash = sets[`reset:user:${activeUser.id}`];
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sets[`reset:${tokenHash}`]).toBe(activeUser.id);
  });

  it('revokes the previously issued reset token', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);
    mocks.redis.get.mockResolvedValue('previoushash');

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: activeUser.email });

    expect(res.status).toBe(200);
    expect(mocks.redis.del).toHaveBeenCalledWith('reset:previoushash');
  });

  it('200s without storing a token for an unknown email (no enumeration)', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.dev' });

    expect(res.status).toBe(200);
    expect(mocks.redis.set).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.del.mockResolvedValue(1);
    mocks.prisma.user.update.mockResolvedValue(activeUser);
  });

  it('400s when the new password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'sometoken', newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('401s on an invalid or expired token', async () => {
    mocks.redis.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'badtoken', newPassword: 'newpassword123' });

    expect(res.status).toBe(401);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('200s, updates the password, consumes the token, and revokes sessions', async () => {
    mocks.redis.get.mockResolvedValue(activeUser.id);
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'goodtoken', newPassword: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledOnce();
    // Both the reset token and the refresh token are deleted.
    const deletedKeys = mocks.redis.del.mock.calls.map((c) => c[0] as string);
    expect(deletedKeys.some((k) => k.startsWith('reset:'))).toBe(true);
    expect(deletedKeys).toContain(`refresh:${activeUser.id}`);
  });
});
