import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    enquiry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));
const userToken = bearer(signAccess(Role.USER, 'user_1'));

const validBody = {
  intent: 'REACH_OUT',
  name: 'Ada',
  email: 'ada@example.com',
  organisation: 'Lagoon Side Gallery',
  message: 'We would like to partner on a gallery walk.',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.enquiry.create.mockResolvedValue({ id: 'enq_1', ...validBody, status: 'NEW' });
});

describe('POST /api/v1/enquiries', () => {
  it('stores a message without a token, as NEW, and does not echo it back', async () => {
    const res = await request(app).post('/api/v1/enquiries').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeNull();
    const { data } = mocks.prisma.enquiry.create.mock.calls[0][0];
    expect(data).toMatchObject({ ...validBody, status: 'NEW' });
    expect(data).not.toHaveProperty('company');
  });

  it('ignores a status the caller tries to set', async () => {
    await request(app).post('/api/v1/enquiries').send({ ...validBody, status: 'HANDLED' });
    expect(mocks.prisma.enquiry.create.mock.calls[0][0].data.status).toBe('NEW');
  });

  it('silently drops a message that filled the honeypot', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .send({ ...validBody, company: 'Spam Ltd' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.enquiry.create).not.toHaveBeenCalled();
  });

  it('requires a valid intent, email and a message', async () => {
    const res = await request(app)
      .post('/api/v1/enquiries')
      .send({ ...validBody, intent: 'SPAM', email: 'nope', message: '' });

    expect(res.status).toBe(400);
    expect(mocks.prisma.enquiry.create).not.toHaveBeenCalled();
  });
});

describe('/api/v1/admin/enquiries', () => {
  it('lists NEW enquiries by default for an admin', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.enquiry.findMany.mockResolvedValue([{ id: 'enq_1', ...validBody }]);
    mocks.prisma.enquiry.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/admin/enquiries').set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mocks.prisma.enquiry.findMany.mock.calls[0][0].where).toEqual({ status: 'NEW' });
  });

  it('is closed to non-admins', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    const res = await request(app).get('/api/v1/admin/enquiries').set(userToken);
    expect(res.status).toBe(403);
  });

  it('marks an enquiry handled with who and when, and audits it', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.enquiry.findUnique.mockResolvedValue({ id: 'enq_1' });
    mocks.prisma.enquiry.update.mockResolvedValue({ id: 'enq_1', status: 'HANDLED' });

    const res = await request(app)
      .patch('/api/v1/admin/enquiries/enq_1')
      .set(adminToken)
      .send({ status: 'HANDLED' });

    expect(res.status).toBe(200);
    const { data } = mocks.prisma.enquiry.update.mock.calls[0][0];
    expect(data.status).toBe('HANDLED');
    expect(data.handledById).toBe('admin_1');
    expect(data.handledAt).toBeInstanceOf(Date);
    expect(mocks.prisma.auditLog.create).toHaveBeenCalled();
  });

  it('clears the handler when an enquiry is reopened', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.enquiry.findUnique.mockResolvedValue({ id: 'enq_1' });
    mocks.prisma.enquiry.update.mockResolvedValue({ id: 'enq_1', status: 'NEW' });

    await request(app)
      .patch('/api/v1/admin/enquiries/enq_1')
      .set(adminToken)
      .send({ status: 'NEW' });

    const { data } = mocks.prisma.enquiry.update.mock.calls[0][0];
    expect(data).toMatchObject({ status: 'NEW', handledById: null, handledAt: null });
  });

  it('404s an unknown enquiry', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.enquiry.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/admin/enquiries/missing')
      .set(adminToken)
      .send({ status: 'HANDLED' });

    expect(res.status).toBe(404);
    expect(mocks.prisma.enquiry.update).not.toHaveBeenCalled();
  });
});
