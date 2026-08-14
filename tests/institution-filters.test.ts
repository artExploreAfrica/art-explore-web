/** openingHours normalisation, and the rating / openNow / sort query wiring. */
import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
  redis: { scan: vi.fn(), del: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const validVenue = {
  name: 'Gallery',
  type: 'ART_GALLERY',
  address: '1 Road',
  area: 'ISLAND',
  lat: 6.5,
  lng: 3.4,
};

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.redis.get.mockResolvedValue(null);
  mocks.redis.set.mockResolvedValue('OK');
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.institution.findMany.mockResolvedValue([]);
  mocks.prisma.institution.count.mockResolvedValue(0);
  mocks.prisma.$queryRaw.mockResolvedValue([]);
});

describe('openingHours is a validated per-day shape', () => {
  it('accepts day-indexed { open, close } and null for a closed day', async () => {
    mocks.prisma.institution.create.mockResolvedValue({ id: 'inst_1' });

    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send({
        ...validVenue,
        openingHours: {
          '0': null,
          '1': { open: '10:00', close: '18:00' },
          '6': { open: '11:00', close: '16:00' },
        },
      });

    expect(res.status).toBe(201);
  });

  it('rejects the old freeform { "mon": "9am-5pm" } shape', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send({ ...validVenue, openingHours: { mon: '9am-5pm' } });

    expect(res.status).toBe(400);
    expect(mocks.prisma.institution.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed time', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send({ ...validVenue, openingHours: { '1': { open: '25:00', close: '18:00' } } });

    expect(res.status).toBe(400);
  });

  it('allows an overnight range (close before open)', async () => {
    mocks.prisma.institution.create.mockResolvedValue({ id: 'inst_1' });

    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send({ ...validVenue, openingHours: { '5': { open: '20:00', close: '02:00' } } });

    expect(res.status).toBe(201);
  });
});

describe('public list filters', () => {
  it('minRating filters on the denormalised average', async () => {
    await request(app).get('/api/v1/institutions?minRating=4');

    const where = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(where.rating).toMatchObject({ gte: 4 });
  });

  it('sort=rating orders by rating with nulls last', async () => {
    await request(app).get('/api/v1/institutions?sort=rating');

    const orderBy = mocks.prisma.institution.findMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toMatchObject({ rating: { sort: 'desc', nulls: 'last' } });
  });

  it('openNow narrows to the ids the SQL pass returned', async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: 'inst_1' }, { id: 'inst_2' }]);

    await request(app).get('/api/v1/institutions?openNow=true');

    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
    const where = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(where.id).toMatchObject({ in: ['inst_1', 'inst_2'] });
  });

  it('does not run the openNow query when the filter is absent', async () => {
    await request(app).get('/api/v1/institutions');

    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(
      mocks.prisma.institution.findMany.mock.calls[0][0].where.id,
    ).toBeUndefined();
  });

  it('rejects an out-of-range minRating', async () => {
    const res = await request(app).get('/api/v1/institutions?minRating=7');
    expect(res.status).toBe(400);
  });

  it('rejects an unknown sort key', async () => {
    const res = await request(app).get('/api/v1/institutions?sort=popularity');
    expect(res.status).toBe(400);
  });

  it('caches distinctly per query so openNow does not poison the plain list', async () => {
    await request(app).get('/api/v1/institutions?openNow=true');
    const keyA = mocks.redis.set.mock.calls[0][0];

    vi.clearAllMocks();
    mocks.redis.get.mockResolvedValue(null);
    mocks.prisma.institution.findMany.mockResolvedValue([]);
    mocks.prisma.institution.count.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValue([]);

    await request(app).get('/api/v1/institutions');
    const keyB = mocks.redis.set.mock.calls[0][0];

    expect(keyA).not.toBe(keyB);
  });
});
