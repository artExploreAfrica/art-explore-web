import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn(), count: vi.fn() },
  },
  redis: {},
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

describe('Admin route auth & RBAC — GET /api/admin/users (Super Admin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401s with no Authorization header', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401s with a malformed token', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set(bearer('not-a-real-jwt'));

    expect(res.status).toBe(401);
  });

  it('403s for an ADMIN (insufficient role)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set(bearer(signAccess(Role.ADMIN)));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('200s for a SUPER_ADMIN', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/admin/users')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});
