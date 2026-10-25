// Second acceptance run, after scripts/acceptance.mjs and with both migrations applied.
//   PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node labs/self-use-club/scripts/acceptance-volunteers.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { chromium } = playwright;
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const evidence = join(repo, 'docs/evidence/selfuse-club-20261025');
for (const dir of ['public', 'admin']) mkdirSync(join(evidence, dir), { recursive: true });
const base = process.env.BASE_URL ?? 'http://localhost:8787';
const token = process.env.RIVERTON_ADMIN_TOKEN ?? 'riverton-local-admin-2026';
const stamp = () => {
  const parts = (zone) => {
    const p = new Intl.DateTimeFormat('en-AU', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const read = (type) => p.find((part) => part.type === type)?.value ?? '';
    return `${read('year')}/${read('month')}/${read('day')} ${read('hour')}:${read('minute')}`;
  };
  return { melbourne: parts('Australia/Melbourne'), utc: parts('UTC') };
};
const result = { startedAt: stamp(), request: 'labs/self-use-club/spec/requests/volunteers.md', steps: [], consoleErrors: [], expectedRefusalResponses: [] };
const watch = (page) => page.on('console', (message) => {
  if (message.type() !== 'error') return;
  if (/status of (401|409|422)/.test(message.text())) result.expectedRefusalResponses.push(message.text());
  else result.consoleErrors.push(message.text());
});
const browser = await chromium.launch({ headless: true });
try {
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const admin = await owner.newPage();
  watch(admin);
  await admin.goto(base + '/admin/login', { waitUntil: 'networkidle' });
  await admin.fill('#token', token);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.waitForURL('**/admin');

  await admin.goto(base + '/admin/volunteers/new', { waitUntil: 'networkidle' });
  await admin.fill('#title', 'Working bee — pontoon handrail');
  await admin.fill('#description', 'Help replace the pontoon handrail before the summer season. Tools, paint and morning tea are supplied. No building experience needed; there is a job for every pair of hands.');
  await admin.fill('#event_date', '2026-11-07');
  await admin.fill('#start_note', '9:00 am for a 9:30 am start');
  await admin.fill('#location', 'Riverton Boathouse, 4 River Parade');
  await admin.fill('#capacity', '2');
  await admin.selectOption('#publication', 'Published');
  await admin.getByRole('button', { name: 'Create volunteer role' }).click();
  await admin.waitForLoadState('networkidle');
  const roleHref = await admin.locator('a[href*="/admin/volunteers/"][href$="/edit"]').first().getAttribute('href');
  const roleId = roleHref?.split('/')[3] ?? '';
  result.steps.push({ step: 'owner creates and publishes role', roleId, flash: await admin.locator('.flash').textContent(), rowText: await admin.locator('#volunteers').innerText() });
  await admin.screenshot({ path: join(evidence, 'admin/volunteers-created-1440-light.png'), fullPage: true });

  const visitor = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const publicPage = await visitor.newPage();
  watch(publicPage);
  await publicPage.goto(base + '/volunteer', { waitUntil: 'networkidle' });
  const initial = await publicPage.locator('main').innerText();
  result.steps.push({ step: 'visitor sees role and places', hasRole: initial.includes('Working bee — pontoon handrail'), places: initial.includes('2 of 2 places left') });
  await publicPage.screenshot({ path: join(evidence, 'public/volunteer-list-1440-light.png'), fullPage: true });

  await publicPage.goto(base + `/volunteer/${roleId}`, { waitUntil: 'networkidle' });
  const initialDetail = await publicPage.locator('main').innerText();
  result.steps.push({ step: 'visitor opens sign-up', available: initialDetail.includes('2 of 2 places are still open'), form: await publicPage.locator('form').count() });
  await publicPage.fill('#name', 'Fictional Noor Haddad');
  await publicPage.fill('#email', 'noor.haddad@example.test');
  await publicPage.fill('#phone', '0400 555 111');
  await publicPage.fill('#notes', 'I can bring a cordless drill and a ladder.');
  await publicPage.getByRole('button', { name: 'Sign up for this role' }).click();
  await publicPage.waitForLoadState('networkidle');
  result.steps.push({ step: 'first volunteer signs up', heading: await publicPage.locator('h1').textContent(), remainingLine: (await publicPage.locator('main').innerText()).match(/\d+ of \d+ places remain/)?.[0] ?? null });
  await publicPage.screenshot({ path: join(evidence, 'public/volunteer-thanks-1440-light.png'), fullPage: true });

  await publicPage.goto(base + '/volunteer', { waitUntil: 'networkidle' });
  result.steps.push({ step: 'list shows reduced capacity', places: (await publicPage.locator('main').innerText()).includes('1 of 2 places left') });

  await publicPage.goto(base + `/volunteer/${roleId}`, { waitUntil: 'networkidle' });
  await publicPage.fill('#name', 'Fictional Ben Okafor');
  await publicPage.fill('#email', 'ben.okafor@example.test');
  await publicPage.fill('#notes', 'Happy to make the morning tea.');
  await publicPage.getByRole('button', { name: 'Sign up for this role' }).click();
  await publicPage.waitForLoadState('networkidle');

  await publicPage.goto(base + `/volunteer/${roleId}`, { waitUntil: 'networkidle' });
  const fullText = await publicPage.locator('main').innerText();
  result.steps.push({ step: 'role is full', full: fullText.includes('This crew is full'), formPresent: await publicPage.locator('form').count() });
  await publicPage.screenshot({ path: join(evidence, 'public/volunteer-full-1440-light.png'), fullPage: true });

  const third = await publicPage.evaluate(async (path) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'Fictional Late', email: 'late@example.test', phone: '', notes: '' }),
    });
    return { status: response.status, text: (await response.text()).slice(0, 200) };
  }, `/volunteer/${roleId}/signup`);
  result.steps.push({ step: 'third sign-up refused at capacity', status: third.status });

  await admin.goto(base + `/admin/volunteers/${roleId}/edit`, { waitUntil: 'networkidle' });
  const signupText = await admin.locator('main').innerText();
  result.steps.push({ step: 'owner sees confirmed sign-ups', noor: signupText.includes('Fictional Noor Haddad'), ben: signupText.includes('Fictional Ben Okafor'), taken: signupText.includes('2 of 2 places are taken') });
  await admin.screenshot({ path: join(evidence, 'admin/volunteers-signups-1440-light.png'), fullPage: true });

  await admin.fill('#title', 'Working bee — pontoon handrail and lunch');
  await admin.fill('#capacity', '4');
  await admin.getByRole('button', { name: 'Save volunteer role' }).click();
  await admin.waitForLoadState('networkidle');
  const saveFlash = await admin.locator('.flash').textContent();
  await admin.goto(base + `/admin/volunteers/${roleId}/edit`, { waitUntil: 'networkidle' });
  const afterSave = await admin.locator('main').innerText();
  result.steps.push({ step: 'owner raises capacity without losing sign-ups', flash: saveFlash, signupsStillListed: afterSave.includes('Fictional Noor Haddad') && afterSave.includes('Fictional Ben Okafor'), takenAfter: afterSave.includes('2 of 4 places are taken') });

  await publicPage.goto(base + `/volunteer/${roleId}`, { waitUntil: 'networkidle' });
  const reopened = await publicPage.locator('main').innerText();
  result.steps.push({ step: 'public reflects the owner change', title: await publicPage.locator('h1').textContent(), places: reopened.includes('2 of 4 places are still open') });
  await publicPage.screenshot({ path: join(evidence, 'public/volunteer-reopened-1440-light.png'), fullPage: true });

  await visitor.close();
  await owner.close();

  const shots = [
    { path: '/', file: 'public/home' },
    { path: '/volunteer', file: 'public/volunteer-list' },
    { path: `/volunteer/${roleId}`, file: 'public/volunteer-role' },
    { path: '/admin', file: 'admin/dashboard', admin: true },
    { path: `/admin/volunteers/${roleId}/edit`, file: 'admin/volunteers-signups', admin: true },
  ];
  for (const [width, scheme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme });
    const page = await context.newPage();
    watch(page);
    if (shots.some((shot) => shot.admin)) {
      await page.goto(base + '/admin/login', { waitUntil: 'networkidle' });
      await page.fill('#token', token);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('**/admin');
    }
    for (const shot of shots) {
      await page.goto(base + shot.path, { waitUntil: 'networkidle' });
      const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      if (metrics.scrollWidth !== metrics.clientWidth) result.consoleErrors.push(`overflow at ${width}/${scheme} ${shot.path}: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
      await page.screenshot({ path: join(evidence, `${shot.file}-${width}-${scheme}.png`), fullPage: true });
    }
    await context.close();
  }
} finally {
  result.completedAt = stamp();
  writeFileSync(join(evidence, 'second-feature.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
