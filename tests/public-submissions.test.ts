import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const URL = '/api/v1/submissions/public';

const validBody = {
  name: 'Lagoon Side Gallery',
  type: 'ART_GALLERY',
  area: 'ISLAND',
  address: '12 Akin Adesola St, Victoria Island',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.institution.create.mockResolvedValue({ id: 'inst_pub_1', ...validBody });
});

describe('POST /api/v1/submissions/public', () => {
  it('accepts a suggestion without a token and stores it PENDING and unpublished', async () => {
    const res = await request(app).post(URL).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { data } = mocks.prisma.institution.create.mock.calls[0][0];
    expect(data).toMatchObject({
      ...validBody,
      approvalStatus: 'PENDING',
      isPublished: false,
    });
    expect(data.submittedById).toBeUndefined();
    expect(data.notes).toContain('public home-page form');
  });

  it('does not echo the stored row back to an anonymous caller', async () => {
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.data).toBeNull();
  });

  it('writes the visitor contact into notes, not into venue fields', async () => {
    await request(app)
      .post(URL)
      .send({ ...validBody, submitterName: 'Ada', submitterEmail: 'ada@example.com' });

    const { data } = mocks.prisma.institution.create.mock.calls[0][0];
    expect(data.notes).toContain('Suggested by: Ada <ada@example.com>');
    expect(data.email).toBeUndefined();
    expect(data).not.toHaveProperty('submitterName');
    expect(data).not.toHaveProperty('submitterEmail');
  });

  it('ignores fields a visitor may not set', async () => {
    await request(app)
      .post(URL)
      .send({ ...validBody, isPublished: true, approvalStatus: 'APPROVED', lat: 1, lng: 2 });

    const { data } = mocks.prisma.institution.create.mock.calls[0][0];
    expect(data.isPublished).toBe(false);
    expect(data.approvalStatus).toBe('PENDING');
    expect(data).not.toHaveProperty('lat');
    expect(data).not.toHaveProperty('lng');
  });

  it('silently drops a submission that filled the honeypot', async () => {
    const res = await request(app).post(URL).send({ ...validBody, company: 'Spam Ltd' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.institution.create).not.toHaveBeenCalled();
  });

  it('rejects a missing name or address', async () => {
    const res = await request(app).post(URL).send({ ...validBody, name: '', address: undefined });

    expect(res.status).toBe(400);
    expect(mocks.prisma.institution.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid website or email', async () => {
    const bad = await request(app)
      .post(URL)
      .send({ ...validBody, website: 'not a url', submitterEmail: 'nope' });

    expect(bad.status).toBe(400);
    expect(mocks.prisma.institution.create).not.toHaveBeenCalled();
  });

  it('leaves the other submission routes behind auth', async () => {
    const res = await request(app).post('/api/v1/submissions').send(validBody);
    expect(res.status).toBe(401);
  });
});
