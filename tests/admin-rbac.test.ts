import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
  redis: {},
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

describe('Admin route auth & RBAC — GET /api/v1/admin/users (Super Admin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401s with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/admin/users');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401s with a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(bearer('not-a-real-jwt'));

    expect(res.status).toBe(401);
  });

  it('403s for an ADMIN (insufficient role)', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(bearer(signAccess(Role.ADMIN)));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('200s for a SUPER_ADMIN', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.SUPER_ADMIN);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
    const whereArg = mocks.prisma.user.findMany.mock.calls[0][0].where;
    expect(whereArg.role.in).toEqual(expect.arrayContaining([Role.ADMIN, Role.SUPER_ADMIN]));
  });

  it('lists public USER accounts when role=USER is supplied', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.SUPER_ADMIN);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/admin/users?role=USER')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(200);
    // Without this filter public accounts are unreachable, so they can never be
    // found in order to be deactivated.
    expect(mocks.prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: Role.USER });
  });

  it('400s on an unknown role filter', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.SUPER_ADMIN);

    const res = await request(app)
      .get('/api/v1/admin/users?role=NOPE')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(400);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('401s when the account is deactivated even with a valid JWT', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.SUPER_ADMIN, { isActive: false });

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/admin/audit-logs — filtering (Super Admin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubActiveUser(mocks.prisma.user.findUnique, Role.SUPER_ADMIN);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
    mocks.prisma.auditLog.count.mockResolvedValue(0);
  });

  it('builds a where clause from the query filters', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=CREATE&targetModel=INSTITUTION&actorId=user_9')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(200);
    const whereArg = mocks.prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      action: 'CREATE',
      targetModel: 'INSTITUTION',
      actorId: 'user_9',
    });
  });

  it('400s on an invalid action filter', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=NOPE')
      .set(bearer(signAccess(Role.SUPER_ADMIN)));

    expect(res.status).toBe(400);
  });
});
