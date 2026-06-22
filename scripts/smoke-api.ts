/**
 * End-to-end smoke test: drives every API endpoint over HTTP against the running
 * dev server, using the real auth flow. Bootstraps a throwaway SUPER_ADMIN via
 * Prisma, then cleans up all data it creates. Re-runnable.
 *
 *   npx ts-node scripts/smoke-api.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PORT ?? 4555}/api/v1`;
const ROOT = `http://localhost:${process.env.PORT ?? 4555}`;

const ADMIN_EMAIL = 'smoke-admin@test.dev';
const ADMIN_PW = 'password123';

type Result = { name: string; method: string; path: string; status: number; expected: number; ok: boolean };
const results: Result[] = [];

async function call(
  name: string,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; expected?: number } = {},
): Promise<any> {
  const expected = opts.expected ?? 200;
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let status = 0;
  let json: any = null;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch (e) {
    status = -1;
    json = { error: (e as Error).message };
  }
  const ok = status === expected;
  results.push({ name, method, path: path.replace(BASE, ''), status, expected, ok });
  return json;
}

async function main(): Promise<void> {
  // --- Bootstrap: clean prior smoke data, create a SUPER_ADMIN ---
  await cleanup();
  await prisma.user.create({
    data: {
      fullName: 'Smoke Admin',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PW, 10),
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  // ===================== Health =====================
  await call('Health', 'GET', `${ROOT}/health`, { expected: 200 });

  // ===================== Auth =====================
  const userEmail = `smoke-user-${Date.now()}@test.dev`;
  await call('Auth: signup (USER)', 'POST', '/auth/signup', {
    expected: 201,
    body: { fullName: 'Smoke User', email: userEmail, password: ADMIN_PW },
  });
  await call('Auth: signup duplicate → 409', 'POST', '/auth/signup', {
    expected: 409,
    body: { fullName: 'Smoke User', email: userEmail, password: ADMIN_PW },
  });
  await call('Auth: login bad creds → 401', 'POST', '/auth/login', {
    expected: 401,
    body: { email: userEmail, password: 'wrong-password' },
  });

  const adminLogin = await call('Auth: login (admin)', 'POST', '/auth/login', {
    expected: 200,
    body: { email: ADMIN_EMAIL, password: ADMIN_PW },
  });
  const adminToken = adminLogin?.data?.accessToken as string;

  const userLogin = await call('Auth: login (user)', 'POST', '/auth/login', {
    expected: 200,
    body: { email: userEmail, password: ADMIN_PW },
  });
  const userToken = userLogin?.data?.accessToken as string;
  const userRefresh = userLogin?.data?.refreshToken as string;

  await call('Auth: me', 'GET', '/auth/me', { token: userToken });
  await call('Auth: me without token → 401', 'GET', '/auth/me', { expected: 401 });
  const refreshed = await call('Auth: refresh', 'POST', '/auth/refresh', {
    body: { refreshToken: userRefresh },
  });
  await call('Auth: change-password', 'POST', '/auth/change-password', {
    token: userToken,
    body: { currentPassword: ADMIN_PW, newPassword: 'newpassword123' },
  });
  await call('Auth: logout', 'POST', '/auth/logout', {
    body: { refreshToken: refreshed?.data?.refreshToken ?? userRefresh },
  });

  // ===================== RBAC checks =====================
  await call('RBAC: user blocked from /admin/dashboard → 403', 'GET', '/admin/dashboard', {
    token: userToken,
    expected: 403,
  });
  await call('RBAC: admin blocked from /submissions → 403', 'POST', '/submissions', {
    token: adminToken,
    expected: 403,
    body: { name: 'x', type: 'ART_GALLERY', address: 'x', area: 'ISLAND', lat: 1, lng: 1 },
  });

  // ===================== Admin: Tags =====================
  await call('Admin tags: list', 'GET', '/admin/tags', { token: adminToken });
  const tag = await call('Admin tags: create', 'POST', '/admin/tags', {
    token: adminToken,
    expected: 201,
    body: { name: 'SMOKE_TAG', label: 'Smoke Tag', category: 'STYLE' },
  });
  const tagId = tag?.data?.id as string;
  await call('Admin tags: duplicate → 409', 'POST', '/admin/tags', {
    token: adminToken,
    expected: 409,
    body: { name: 'SMOKE_TAG', label: 'Smoke Tag', category: 'STYLE' },
  });
  await call('Admin tags: update', 'PUT', `/admin/tags/${tagId}`, {
    token: adminToken,
    body: { label: 'Smoke Tag Renamed' },
  });

  // ===================== Admin: SubCategories =====================
  await call('Admin subcats: list', 'GET', '/admin/subcategories', { token: adminToken });
  const subcat = await call('Admin subcats: create', 'POST', '/admin/subcategories', {
    token: adminToken,
    expected: 201,
    body: { name: 'SMOKE Subcat', type: 'ART_GALLERY' },
  });
  const subCategoryId = subcat?.data?.id as string;
  await call('Admin subcats: update', 'PUT', `/admin/subcategories/${subCategoryId}`, {
    token: adminToken,
    body: { description: 'updated' },
  });

  // ===================== Admin: Institutions =====================
  await call('Admin dashboard', 'GET', '/admin/dashboard', { token: adminToken });
  const inst = await call('Admin inst: create', 'POST', '/admin/institutions', {
    token: adminToken,
    expected: 201,
    body: {
      name: 'SMOKE Gallery',
      type: 'ART_GALLERY',
      address: '1 Smoke St, Lagos',
      area: 'ISLAND',
      lat: 6.45,
      lng: 3.4,
      subCategoryId,
      tagIds: [tagId],
      isPublished: false,
    },
  });
  const instId = inst?.data?.id as string;
  await call('Admin inst: update', 'PUT', `/admin/institutions/${instId}`, {
    token: adminToken,
    body: { description: 'A smoke-test gallery' },
  });
  await call('Admin inst: publish', 'POST', `/admin/institutions/${instId}/publish`, {
    token: adminToken,
  });

  // ===================== Admin: Exhibitions =====================
  const exh = await call('Admin exh: create', 'POST', `/admin/institutions/${instId}/exhibitions`, {
    token: adminToken,
    expected: 201,
    body: {
      name: 'SMOKE Show',
      startDate: '2026-09-01',
      endDate: '2026-10-01',
      startTime: '10:00',
      endTime: '18:00',
    },
  });
  const exhId = exh?.data?.id as string;
  await call('Admin exh: update', 'PUT', `/admin/institutions/${instId}/exhibitions/${exhId}`, {
    token: adminToken,
    body: { name: 'SMOKE Show (updated)' },
  });

  // ===================== Public reads =====================
  await call('Public: institutions list', 'GET', '/institutions');
  await call('Public: institutions map', 'GET', '/institutions/map');
  await call('Public: institution detail', 'GET', `/institutions/${instId}`);
  await call('Public: institution exhibitions', 'GET', `/institutions/${instId}/exhibitions`);
  await call('Public: subcategories', 'GET', '/subcategories');
  await call('Public: tags', 'GET', '/tags');

  // ===================== Submissions (user) + review (admin) =====================
  // Re-login the user (password changed earlier).
  const u2 = await call('Auth: re-login user', 'POST', '/auth/login', {
    body: { email: userEmail, password: 'newpassword123' },
  });
  const userToken2 = u2?.data?.accessToken as string;

  const sub1 = await call('Submissions: submit #1', 'POST', '/submissions', {
    token: userToken2,
    expected: 201,
    body: { name: 'SMOKE Submitted A', type: 'STUDIO', address: '2 Sub St', area: 'MAINLAND', lat: 6.5, lng: 3.3 },
  });
  const sub2 = await call('Submissions: submit #2', 'POST', '/submissions', {
    token: userToken2,
    expected: 201,
    body: { name: 'SMOKE Submitted B', type: 'STUDIO', address: '3 Sub St', area: 'MAINLAND', lat: 6.5, lng: 3.3 },
  });
  await call('Submissions: mine', 'GET', '/submissions/mine', { token: userToken2 });

  await call('Admin: list submissions (PENDING)', 'GET', '/admin/submissions?status=PENDING', {
    token: adminToken,
  });
  await call('Admin: approve submission', 'POST', `/admin/institutions/${sub1?.data?.id}/approve`, {
    token: adminToken,
  });
  await call('Admin: reject w/o note → 400', 'POST', `/admin/institutions/${sub2?.data?.id}/reject`, {
    token: adminToken,
    expected: 400,
    body: {},
  });
  await call('Admin: reject submission', 'POST', `/admin/institutions/${sub2?.data?.id}/reject`, {
    token: adminToken,
    body: { reviewNote: 'Needs more detail' },
  });

  // ===================== Admin: Users =====================
  await call('Admin users: list', 'GET', '/admin/users', { token: adminToken });
  const newAdmin = await call('Admin users: create', 'POST', '/admin/users', {
    token: adminToken,
    expected: 201,
    body: { fullName: 'SMOKE Admin2', email: 'smoke-admin2@test.dev', password: ADMIN_PW, role: 'ADMIN' },
  });
  await call('Admin users: deactivate', 'PATCH', `/admin/users/${newAdmin?.data?.id}/deactivate`, {
    token: adminToken,
  });

  // ===================== Admin: Audit logs =====================
  await call('Admin: audit-logs', 'GET', '/admin/audit-logs', { token: adminToken });

  // ===================== Teardown of mutable resources via API =====================
  await call('Admin inst: delete (soft)', 'DELETE', `/admin/institutions/${instId}`, {
    token: adminToken,
  });
  await call('Admin exh: delete', 'DELETE', `/admin/institutions/${instId}/exhibitions/${exhId}`, {
    token: adminToken,
    expected: 404, // parent soft-deleted above → exhibition lookup 404 (expected)
  });
  await call('Admin subcats: delete', 'DELETE', `/admin/subcategories/${subCategoryId}`, {
    token: adminToken,
  });
  await call('Admin tags: delete', 'DELETE', `/admin/tags/${tagId}`, { token: adminToken });

  printReport();
  await cleanup();
}

async function cleanup(): Promise<void> {
  // Remove anything the smoke test created (idempotent).
  await prisma.exhibition.deleteMany({ where: { institution: { name: { startsWith: 'SMOKE' } } } });
  await prisma.institution.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });
  await prisma.tag.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });
  await prisma.subCategory.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });

  // Audit logs FK-reference the actor, so clear them before deleting the users.
  const smokeUsers = await prisma.user.findMany({
    where: { email: { contains: 'smoke-' } },
    select: { id: true },
  });
  const ids = smokeUsers.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { contains: 'smoke-' } } });
}

function printReport(): void {
  const pass = results.filter((r) => r.ok).length;
  console.log('\n================ API SMOKE TEST ================');
  for (const r of results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    const got = r.status === r.expected ? `${r.status}` : `${r.status} (expected ${r.expected})`;
    console.log(`[${tag}] ${r.method.padEnd(6)} ${got.padEnd(22)} ${r.name}`);
  }
  console.log('-----------------------------------------------');
  console.log(`${pass}/${results.length} passed`);
  console.log('===============================================\n');
  if (pass !== results.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Smoke runner crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
