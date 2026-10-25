// First acceptance run. Start the local app on a fresh seeded database:
//   pnpm --dir labs/self-use-club/app dev
//   PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node labs/self-use-club/scripts/acceptance.mjs
// The run writes docs/evidence/selfuse-club-20261025/acceptance.json and screenshots.
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
const result = { startedAt: stamp(), base, composerSource: '86514680720702ce30157671652981e388b77f65', steps: [], consoleErrors: [], expectedRefusalResponses: [] };
const browser = await chromium.launch({ headless: true });

function watch(page) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (/status of (401|409|422)/.test(message.text())) result.expectedRefusalResponses.push(message.text());
    else result.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => result.consoleErrors.push(String(error)));
}

try {
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const page = await visitor.newPage();
  watch(page);
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  result.steps.push({ step: 'visitor home', title: await page.title(), nextEvent: await page.locator('.next-event h2').textContent(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth) });

  await page.getByRole('link', { name: 'Event details' }).click();
  await page.waitForLoadState('networkidle');
  result.steps.push({ step: 'visitor event detail', url: page.url(), heading: await page.locator('h1').textContent(), dateShown: await page.locator('.detail-facts').innerText() });

  await page.goto(base + '/join', { waitUntil: 'networkidle' });
  await page.fill('#name', 'A');
  await page.fill('#email', 'visitor@example.test');
  await page.fill('#message', 'short');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  const validation = await page.locator('.form-errors').innerText();
  await page.screenshot({ path: join(evidence, 'public/join-error-1440-light.png'), fullPage: true });
  result.steps.push({ step: 'visitor validation refusal', status: 422, errors: validation.split('\n'), emailPreserved: await page.inputValue('#email'), messagePreserved: await page.inputValue('#message') });

  await page.fill('#name', 'Fictional Priya Raman');
  await page.fill('#email', 'priya.raman@example.test');
  await page.fill('#phone', '0400 123 456');
  await page.selectOption('#enquiry_type', 'Joining the club');
  await page.fill('#message', 'I have never rowed before and would like to try the Saturday beginners session. Is there parking near the shed?');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  const reference = await page.locator('.reference').textContent();
  await page.screenshot({ path: join(evidence, 'public/join-thanks-1440-light.png'), fullPage: true });
  result.steps.push({ step: 'visitor enquiry submitted', url: page.url(), reference, heading: await page.locator('h1').textContent() });

  await page.goto(base + '/admin', { waitUntil: 'networkidle' });
  result.steps.push({ step: 'anonymous admin page refused', url: page.url(), signInHeading: await page.locator('h1').textContent() });
  await page.screenshot({ path: join(evidence, 'admin/denied-1440-light.png'), fullPage: true });
  const anonymousWrite = await page.evaluate(async () => {
    const response = await fetch('/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: 'Anonymous write', summary: 'This must never be saved.', description: 'A fabricated event sent without an owner session.', event_date: '2099-01-01', start_note: '7:00 am', location: 'Shed', publication: 'Published' }),
    });
    return { status: response.status, text: (await response.text()).slice(0, 120) };
  });
  result.steps.push({ step: 'anonymous owner write refused', ...anonymousWrite });

  await page.fill('#token', token);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin');
  await page.waitForLoadState('networkidle');
  const pendingText = await page.locator('#enquiries').innerText();
  result.steps.push({ step: 'owner sees pending enquiry', url: page.url(), hasName: pendingText.includes('Fictional Priya Raman'), hasMessage: pendingText.includes('never rowed before'), hasPending: pendingText.includes('PENDING') });
  await page.screenshot({ path: join(evidence, 'admin/dashboard-before-1440-light.png'), fullPage: true });

  await page.getByRole('link', { name: 'Twilight paddle and supper', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.fill('#title', 'Twilight paddle and supper — date confirmed');
  await page.fill('#summary', 'An evening paddle for confident beginners, now confirmed for January.');
  await page.fill('#description', 'A shorter social paddle as the light goes. This one suits people who have completed one learn-to-row session. The committee confirmed the date after the summer program was set. Supper is vegetarian by default; tell us about other needs when you join.');
  await page.fill('#event_date', '2027-01-23');
  await page.selectOption('#publication', 'Published');
  await page.getByRole('button', { name: 'Save event' }).click();
  await page.waitForLoadState('networkidle');
  const flash = await page.locator('.flash').textContent();
  await page.screenshot({ path: join(evidence, 'admin/event-saved-1440-light.png'), fullPage: true });
  result.steps.push({ step: 'owner edits and publishes event', flash, title: await page.title() });

  const visitorView = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const publicPage = await visitorView.newPage();
  watch(publicPage);
  const detailResponse = await publicPage.goto(base + '/events/twilight-paddle-and-supper', { waitUntil: 'networkidle' });
  const detailText = await publicPage.locator('main').innerText();
  const body = await publicPage.locator('body').innerText();
  result.steps.push({ step: 'visitor sees published change', status: detailResponse.status(), title: await publicPage.locator('h1').textContent(), hasNewTitle: detailText.includes('date confirmed'), hasNewDate: detailText.includes('2027/01/23'), hasNewDescription: detailText.includes('committee confirmed the date'), enquiryPrivate: !body.includes('priya.raman@example.test') });
  await publicPage.screenshot({ path: join(evidence, 'public/event-detail-1440-light.png'), fullPage: true });

  await page.goto(base + '/admin#enquiries', { waitUntil: 'networkidle' });
  const record = page.locator('article.admin-record', { hasText: 'Fictional Priya Raman' }).first();
  await record.locator('input[name="note"]').fill('Invited Priya to the 14 November beginners row. Replied by email.');
  await record.getByRole('button', { name: 'Mark reviewed' }).click();
  await page.waitForLoadState('networkidle');
  const reviewed = await page.locator('#enquiries').innerText();
  const pendingStat = await page.locator('.stat b').first().textContent();
  result.steps.push({ step: 'owner reviews enquiry', flash: await page.locator('.flash').textContent(), reviewed: reviewed.includes('Reviewed'), note: reviewed.includes('Invited Priya'), pendingStat, reviewedDisclosureOpen: await page.locator('#enquiries details').first().evaluate((element) => element.open) });
  await page.screenshot({ path: join(evidence, 'admin/dashboard-after-1440-light.png'), fullPage: true });

  await visitor.close();
  await visitorView.close();

  const shots = [
    { path: '/', file: 'public/home' },
    { path: '/events', file: 'public/events' },
    { path: '/events/twilight-paddle-and-supper', file: 'public/event-twilight' },
    { path: '/notices', file: 'public/notices' },
    { path: '/join', file: 'public/join' },
    { path: '/admin', file: 'admin/dashboard', admin: true },
    { path: '/admin/events/new', file: 'admin/event-form', admin: true },
  ];
  for (const [width, scheme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme });
    const capture = await context.newPage();
    watch(capture);
    if (shots.some((shot) => shot.admin)) {
      await capture.goto(base + '/admin/login', { waitUntil: 'networkidle' });
      await capture.fill('#token', token);
      await capture.getByRole('button', { name: 'Sign in' }).click();
      await capture.waitForURL('**/admin');
    }
    for (const shot of shots) {
      await capture.goto(base + shot.path, { waitUntil: 'networkidle' });
      const metrics = await capture.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      if (metrics.scrollWidth !== metrics.clientWidth) result.consoleErrors.push(`overflow at ${width}/${scheme} ${shot.path}: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
      await capture.screenshot({ path: join(evidence, `${shot.file}-${width}-${scheme}.png`), fullPage: true });
    }
    await context.close();
  }
} finally {
  result.completedAt = stamp();
  writeFileSync(join(evidence, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
