import { Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    tag: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const stored = {
  id: 'tag_1',
  name: 'ABSTRACT',
  label: 'Abstract',
  category: 'STYLE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('POST /api/v1/admin/tags', () => {
  it('creates a tag without a category (hidden in the admin) and stores the STYLE default', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'WOMEN_OWNED', label: 'Women Owned' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.tag.create.mock.calls[0][0].data).toEqual({
      name: 'WOMEN_OWNED',
      label: 'Women Owned',
      category: 'STYLE',
    });
  });

  it('still honours a category if an older caller sends one', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ARTIST_LED', label: 'Artist Led', category: 'OWNERSHIP' });

    expect(mocks.prisma.tag.create.mock.calls[0][0].data.category).toBe('OWNERSHIP');
  });

  it('201s and logs CREATE + invalidates cache', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ABSTRACT', label: 'Abstract', category: 'STYLE' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      targetModel: 'TAG',
      targetId: 'tag_1',
    });
    expect(mocks.redis.scan).toHaveBeenCalled();
  });

  it('409s on a duplicate name (P2002)', async () => {
    mocks.prisma.tag.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ABSTRACT', label: 'Abstract', category: 'STYLE' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/v1/admin/tags/:id', () => {
  it('200s and logs DELETE', async () => {
    mocks.prisma.tag.findUnique.mockResolvedValue(stored);
    mocks.prisma.tag.delete.mockResolvedValue(stored);

    const res = await request(app).delete('/api/v1/admin/tags/tag_1').set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DELETE',
      targetModel: 'TAG',
    });
  });
});
