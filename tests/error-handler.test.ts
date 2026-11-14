import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    institution: { findMany: vi.fn(), count: vi.fn() },
  },
  redis: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('database problem', { code, clientVersion: 'test' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.get.mockResolvedValue(null); // cache miss → hit the DB
  mocks.redis.set.mockResolvedValue('OK');
  mocks.prisma.institution.count.mockResolvedValue(0);
});

describe('database outages', () => {
  it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])(
    'answers 503, not 400, when Prisma reports %s',
    async (code) => {
      mocks.prisma.institution.findMany.mockRejectedValue(known(code));

      const res = await request(app).get('/api/v1/institutions');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, message: 'Database temporarily unavailable' });
    },
  );

  it('answers 503 when Prisma cannot connect at all', async () => {
    mocks.prisma.institution.findMany.mockRejectedValue(
      new Prisma.PrismaClientInitializationError("Can't reach database server", 'test'),
    );

    const res = await request(app).get('/api/v1/institutions');

    expect(res.status).toBe(503);
  });

  it('still answers 400 for other database request errors', async () => {
    mocks.prisma.institution.findMany.mockRejectedValue(known('P2011'));

    const res = await request(app).get('/api/v1/institutions');

    expect(res.status).toBe(400);
  });
});
