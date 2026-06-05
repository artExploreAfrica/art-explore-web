import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    institution: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  redis: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const sampleInstitution = {
  id: 'inst_1',
  name: 'Test Gallery',
  description: 'A gallery',
  type: 'GALLERY',
  address: '1 Test St',
  area: 'ISLAND',
  lat: 6.45,
  lng: 3.4,
  images: [],
  website: null,
  phone: null,
  email: null,
  openingHours: null,
  tags: ['modern'],
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GET /api/v1/institutions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.get.mockResolvedValue(null); // cache miss → hit the DB
    mocks.redis.set.mockResolvedValue('OK');
  });

  it('returns a paginated list in the standard envelope', async () => {
    mocks.prisma.institution.findMany.mockResolvedValue([sampleInstitution]);
    mocks.prisma.institution.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/institutions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('400s on an out-of-range limit', async () => {
    const res = await request(app).get('/api/v1/institutions?limit=500');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('only queries published, non-deleted institutions', async () => {
    mocks.prisma.institution.findMany.mockResolvedValue([]);
    mocks.prisma.institution.count.mockResolvedValue(0);

    await request(app).get('/api/v1/institutions');

    const whereArg = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(whereArg.isPublished).toBe(true);
    expect(whereArg.deletedAt).toBeNull();
  });
});

describe('GET /api/v1/institutions/map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.get.mockResolvedValue(null);
    mocks.redis.set.mockResolvedValue('OK');
  });

  it('returns lightweight pins', async () => {
    mocks.prisma.institution.findMany.mockResolvedValue([
      { id: 'inst_1', name: 'Test Gallery', lat: 6.45, lng: 3.4, type: 'GALLERY' },
    ]);

    const res = await request(app).get('/api/v1/institutions/map');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ id: 'inst_1', lat: 6.45, lng: 3.4 });

    const whereArg = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(whereArg.isPublished).toBe(true);
    expect(whereArg.deletedAt).toBeNull();
  });
});

describe('GET /api/v1/institutions/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404s when the institution is not found or unpublished', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/institutions/missing_id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
