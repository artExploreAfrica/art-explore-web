import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
  redis: { set: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 10);

const activeUser = {
  id: 'user_1',
  fullName: 'Test Admin',
  email: 'admin@test.dev',
  password: passwordHash,
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.set.mockResolvedValue('OK');
  });

  it('400s when the body fails validation', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });

  it('401s on an unknown email', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('403s when the account is deactivated', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: activeUser.email, password: PASSWORD });

    expect(res.status).toBe(403);
  });

  it('200s with a token pair and no password leak on valid credentials', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: activeUser.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.password).toBeUndefined();
    // Refresh token must be persisted to Redis (hashed) on login.
    expect(mocks.redis.set).toHaveBeenCalledOnce();
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('200s with the current user and no password leak', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);

    const res = await request(app)
      .get('/api/auth/me')
      .set(bearer(signAccess(Role.ADMIN, activeUser.id, activeUser.email)));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: activeUser.id, email: activeUser.email });
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s when the new password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(bearer(signAccess(Role.ADMIN, activeUser.id, activeUser.email)))
      .send({ currentPassword: PASSWORD, newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('401s when the current password is wrong', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set(bearer(signAccess(Role.ADMIN, activeUser.id, activeUser.email)))
      .send({ currentPassword: 'wrong-password', newPassword: 'newpassword123' });

    expect(res.status).toBe(401);
  });
});
