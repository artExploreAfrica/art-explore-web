import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { findFirst: vi.fn() },
    exhibition: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const URL = '/api/v1/submissions/exhibitions/public';

const validBody = {
  institutionId: 'inst_1',
  name: 'Tides of Lagos',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  startTime: '10:00',
  endTime: '18:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
  mocks.prisma.exhibition.create.mockResolvedValue({ id: 'ex_pub_1', ...validBody });
});

describe('POST /api/v1/submissions/exhibitions/public', () => {
  it('stores an exhibition without a token, PENDING and inactive', async () => {
    const res = await request(app).post(URL).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeNull();
    const { data } = mocks.prisma.exhibition.create.mock.calls[0][0];
    expect(data).toMatchObject({
      institutionId: 'inst_1',
      name: 'Tides of Lagos',
      approvalStatus: 'PENDING',
      isActive: false,
    });
    expect(data.submittedById).toBeUndefined();
  });

  it('only targets a published, approved venue', async () => {
    await request(app).post(URL).send(validBody);
    const { where } = mocks.prisma.institution.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ isPublished: true, approvalStatus: 'APPROVED', deletedAt: null });
  });

  it('404s an unknown venue and stores nothing', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(null);
    const res = await request(app).post(URL).send(validBody);

    expect(res.status).toBe(404);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });

  it('writes the visitor contact into notes', async () => {
    await request(app)
      .post(URL)
      .send({ ...validBody, submitterName: 'Ada', submitterEmail: 'ada@example.com' });

    const { data } = mocks.prisma.exhibition.create.mock.calls[0][0];
    expect(data.notes).toContain('Submitted by: Ada <ada@example.com>');
    expect(data).not.toHaveProperty('submitterName');
    expect(data).not.toHaveProperty('submitterEmail');
  });

  it('refuses images, approval state and an end before the start', async () => {
    const withImages = await request(app)
      .post(URL)
      .send({ ...validBody, images: ['https://example.com/a.jpg'] });
    await request(app).post(URL).send({ ...validBody, approvalStatus: 'APPROVED', isActive: true });
    const backwards = await request(app).post(URL).send({ ...validBody, endDate: '2026-10-01' });

    expect(backwards.status).toBe(400);
    // Visitor-sent images and approval fields are dropped, never stored;
    // `images` is always written as [] (the column is NOT NULL, no default).
    expect(withImages.status).toBe(201);
    for (const [{ data }] of mocks.prisma.exhibition.create.mock.calls) {
      expect(data.images).toEqual([]);
      expect(data.approvalStatus).toBe('PENDING');
      expect(data.isActive).toBe(false);
    }
  });

  it('silently drops a submission that filled the honeypot', async () => {
    const res = await request(app).post(URL).send({ ...validBody, company: 'Spam Ltd' });
    expect(res.status).toBe(201);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });
});
