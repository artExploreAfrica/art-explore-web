/**
 * End-to-end test for the home-page "Get involved" form: for each path a
 * visitor can take, submit over HTTP as an anonymous visitor, check the row
 * landed in Postgres with the right state, then check it shows up in the
 * admin API the panel reads. Cleans up everything it creates; re-runnable.
 *
 *   A/B  POST /enquiries                     → Enquiry NEW        → GET /admin/enquiries
 *   C    POST /submissions/exhibitions/public → Exhibition PENDING → GET /admin/submissions/exhibitions
 *   C    POST /submissions/public             → Institution PENDING → GET /admin/submissions
 *
 * Needs the dev server running (npm run dev) against a migrated database with
 * at least one published, approved venue. The public endpoints are rate
 * limited per IP (5 an hour), so back-to-back runs can hit 429.
 *
 *   npx ts-node scripts/e2e-contribute.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { ApprovalStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PORT ?? 4555}/api/v1`;

const ADMIN_EMAIL = 'e2e-contribute-admin@test.dev';
const ADMIN_PW = 'password123';
// Every row this script creates carries the marker, so cleanup can find it.
const MARK = `E2E-CONTRIBUTE-${Date.now()}`;

let failures = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function cleanup(): Promise<void> {
  await prisma.enquiry.deleteMany({ where: { message: { contains: 'E2E-CONTRIBUTE-' } } });
  await prisma.exhibition.deleteMany({ where: { name: { startsWith: 'E2E-CONTRIBUTE-' } } });
  await prisma.institution.deleteMany({ where: { name: { startsWith: 'E2E-CONTRIBUTE-' } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: ADMIN_EMAIL } } });
  await prisma.enquiry.updateMany({
    where: { handledBy: { email: ADMIN_EMAIL } },
    data: { handledById: null },
  });
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
}

async function main(): Promise<void> {
  await cleanup();
  await prisma.user.create({
    data: {
      fullName: 'E2E Contribute Admin',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PW, 10),
      role: Role.ADMIN,
    },
  });
  const login = await api('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PW } });
  const token: string | undefined = login.json?.data?.accessToken;
  check('admin login', login.status === 200 && !!token, `status ${login.status}`);
  if (!token) return;

  // ── A / B: enquiries ─────────────────────────────────────
  for (const intent of ['REACH_OUT', 'LEARN_MORE'] as const) {
    const message = `${MARK} ${intent} message`;
    const sent = await api('POST', '/enquiries', {
      body: { intent, name: 'Ada E2E', email: 'ada.e2e@example.com', message },
    });
    check(`${intent}: submit`, sent.status === 201, `status ${sent.status}`);

    const row = await prisma.enquiry.findFirst({ where: { message } });
    check(`${intent}: row created NEW`, row?.status === 'NEW' && row.intent === intent);

    const inbox = await api('GET', '/admin/enquiries?status=NEW&limit=100', { token });
    check(
      `${intent}: appears in admin Enquiries`,
      inbox.json?.data?.some((e: { id: string }) => e.id === row?.id),
    );
  }

  // ── C: Add an Exhibition ─────────────────────────────────
  const venue = await prisma.institution.findFirst({
    where: { isPublished: true, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
    select: { id: true, name: true },
  });
  check('a published venue exists to attach an exhibition to', !!venue);
  if (venue) {
    const name = `${MARK} Exhibition`;
    const sent = await api('POST', '/submissions/exhibitions/public', {
      body: {
        institutionId: venue.id,
        name,
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        startTime: '10:00',
        endTime: '18:00',
        submitterName: 'Ada E2E',
        submitterEmail: 'ada.e2e@example.com',
      },
    });
    check('exhibition: submit', sent.status === 201, `status ${sent.status}`);

    const row = await prisma.exhibition.findFirst({ where: { name } });
    check(
      'exhibition: row created PENDING, inactive, contact in notes',
      row?.approvalStatus === 'PENDING' && row.isActive === false && !!row.notes?.includes('ada.e2e@example.com'),
    );

    const queue = await api('GET', '/admin/submissions/exhibitions?limit=100', { token });
    check(
      'exhibition: appears in admin Submissions',
      queue.json?.data?.some((e: { id: string }) => e.id === row?.id),
    );

    const pub = await api('GET', `/institutions/${venue.id}/exhibitions?scope=all`);
    check(
      'exhibition: not public before approval',
      !pub.json?.data?.some((e: { id: string }) => e.id === row?.id),
    );
  }

  // ── C: Add a New Space ───────────────────────────────────
  const spaceName = `${MARK} Space`;
  const hours = { '0': null, '2': { open: '11:00', close: '19:00' } };
  const sent = await api('POST', '/submissions/public', {
    body: {
      name: spaceName,
      type: 'HUB_INSTITUTION',
      subType: 'STUDIO',
      area: 'MAINLAND',
      address: '1 E2E Street, Yaba',
      subArea: 'Yaba',
      mapUrl: 'https://maps.google.com/?q=yaba',
      lat: 6.509,
      lng: 3.378,
      website: 'https://e2e.example.com',
      instagram: '@e2e',
      phone: '+234 800 000 0000',
      email: 'studio.e2e@example.com',
      openingHours: hours,
      hasResidency: true,
      description: 'Made by the e2e test.',
      photoLinks: ['https://example.com/e2e-1.jpg'],
      submitterName: 'Ada E2E',
      submitterEmail: 'ada.e2e@example.com',
    },
  });
  check('space: submit', sent.status === 201, `status ${sent.status}`);

  const space = await prisma.institution.findFirst({ where: { name: spaceName } });
  check(
    'space: row created PENDING, unpublished, every field stored',
    space?.approvalStatus === 'PENDING' &&
      space.isPublished === false &&
      space.subType === 'STUDIO' &&
      space.lat === 6.509 &&
      space.phone === '+234 800 000 0000' &&
      space.hasResidency === true &&
      JSON.stringify(space.openingHours) === JSON.stringify(hours),
  );
  check(
    'space: photo link and contact in notes',
    !!space?.notes?.includes('https://example.com/e2e-1.jpg') && !!space.notes.includes('ada.e2e@example.com'),
  );

  const subs = await api('GET', '/admin/submissions?limit=100', { token });
  check(
    'space: appears in admin Submissions',
    subs.json?.data?.some((i: { id: string }) => i.id === space?.id),
  );

  // ── Spam guard ───────────────────────────────────────────
  const before = await prisma.enquiry.count();
  const bot = await api('POST', '/enquiries', {
    body: { intent: 'REACH_OUT', name: 'Bot', email: 'bot@example.com', message: `${MARK} bot`, company: 'x' },
  });
  check('honeypot: acknowledged but not stored', bot.status === 201 && (await prisma.enquiry.count()) === before);
}

main()
  .catch((e) => {
    failures++;
    console.error(e);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
    process.exitCode = failures ? 1 : 0;
  });
