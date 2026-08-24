/**
 * Post-deploy smoke check for the admin panel.
 *
 * Logs in with a real account, loads the dashboard, and fails the CD run if
 * either the page throws a JS error or the KPI cards render blank — the two
 * symptoms of a backend/frontend shape mismatch that typecheck/lint/unit
 * tests can't catch, because none of them load the real deployed site in a
 * browser.
 *
 * Usage: node scripts/smoke-admin.mjs
 * Env:   SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, ADMIN_URL (optional)
 */
import { chromium } from 'playwright';

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.artexplore.africa';
const EMAIL = process.env.SMOKE_TEST_EMAIL;
const PASSWORD = process.env.SMOKE_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('❌ SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD are not set.');
  process.exit(1);
}

const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(err.message));

try {
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle' });

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/admin', { timeout: 15000 });
  await page.waitForSelector('.admin-kpi-value', { timeout: 15000 });

  const kpiValues = await page.$$eval('.admin-kpi-value', (els) =>
    els.map((e) => e.textContent?.trim() ?? ''),
  );

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('❌ Console errors detected on admin dashboard:');
    consoleErrors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }

  const blankKpis = kpiValues.filter((v) => v === '');
  if (kpiValues.length === 0 || blankKpis.length > 0) {
    console.error('❌ Dashboard KPI cards did not render values:', kpiValues);
    process.exit(1);
  }

  console.log('✅ Admin dashboard smoke test passed. KPI values:', kpiValues);
} catch (err) {
  await browser.close();
  console.error('❌ Smoke test failed:', err.message);
  if (consoleErrors.length > 0) {
    console.error('Console errors captured before failure:');
    consoleErrors.forEach((e) => console.error('  -', e));
  }
  process.exit(1);
}
