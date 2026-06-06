import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
  redis: {},
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const validBody = {
  fullName: 'Ada Lovelace',
  email: 'ada@test.dev',
  password: 'password123',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/auth/signup', () => {
  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400s if a role is supplied (no such field — extra keys ignored, still creates USER)', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({
      id: 'user_1',
      fullName: validBody.fullName,
      email: validBody.email,
      password: 'hash',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // A caller trying to self-elevate: the role key is ignored and USER is forced.
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...validBody, role: 'SUPER_ADMIN' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.user.create.mock.calls[0][0].data.role).toBe('USER');
  });

  it('201s, forces the USER role, and never leaks the password', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({
      id: 'user_1',
      fullName: validBody.fullName,
      email: validBody.email,
      password: 'hash',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).post('/api/v1/auth/signup').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('USER');
    expect(res.body.data.password).toBeUndefined();
    expect(mocks.prisma.user.create.mock.calls[0][0].data.role).toBe('USER');
  });

  it('409s when the email already exists', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    const res = await request(app).post('/api/v1/auth/signup').send(validBody);

    expect(res.status).toBe(409);
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});
