import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createD1 } from './support/sqlite-d1.mjs';
import worker from '../src/worker.ts';

const origin = 'http://localhost:8787';
const migration = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const volunteers = readFileSync(new URL('../migrations/0002_volunteers.sql', import.meta.url), 'utf8');

function database() {
  const d1 = createD1();
  d1.exec(migration);
  d1.exec(volunteers);
  return d1;
}

function env(d1) {
  return { DB: d1, ADMIN_TOKEN: 'test-owner-token', PUBLIC_ORIGIN: origin };
}

function form(fields) {
  return { 'Content-Type': 'application/x-www-form-urlencoded' };
}

function body(fields) {
  return new URLSearchParams(fields).toString();
}

async function call(d1, path, init = {}) {
  return worker.fetch(new Request(origin + path, init), env(d1));
}

async function signIn(d1) {
  const response = await call(d1, '/admin/login', {
    method: 'POST',
    headers: form(),
    body: body({ token: 'test-owner-token', next: '/admin' }),
  });
  assert.equal(response.status, 303);
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.match(cookie, /^rrc_admin=[0-9a-f]{64}$/);
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/);
  assert.match(response.headers.get('set-cookie') ?? '', /SameSite=Strict/);
  return cookie;
}

function addPublishedEvent(d1, values = {}) {
  d1.raw.prepare(`INSERT INTO events (id, slug, title, summary, description, event_date, start_note, location, cost, publication, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', ?, ?, ?)`).run(
    values.id ?? 'event-test-1',
    values.slug ?? 'test-row',
    values.title ?? 'Fictional test row',
    values.summary ?? 'A row for the test fixture.',
    values.description ?? 'A fictional event used by the automated test suite.',
    values.event_date ?? '2099-02-14',
    values.start_note ?? '7:00 am for a 7:30 am start',
    values.location ?? 'Riverton Boathouse',
    '',
    '2026-10-25T00:00:00.000Z',
    '2026-10-25T00:00:00.000Z',
    '2026-10-25T00:00:00.000Z',
  );
}

test('empty public pages explain the state instead of pretending content exists', async () => {
  const d1 = database();
  try {
    const home = await call(d1, '/');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /No public events yet/);
    assert.match(html, /No notices right now/);
    assert.match(html, /Calendar is quiet|calendar is quiet/);
    assert.equal((await call(d1, '/events')).status, 200);
    assert.match(await (await call(d1, '/events')).text(), /No published events yet/);
    assert.match(await (await call(d1, '/notices')).text(), /No notices right now/);
  } finally {
    d1.close();
  }
});

test('public pages show published content, escape it and set a no-script CSP', async () => {
  const d1 = database();
  try {
    addPublishedEvent(d1, { title: 'Fictional <script>alert(1)</script> row', summary: 'A summary with <b>markup</b>.', description: 'A description with & ampersands and "quotes".' });
    d1.raw.prepare("INSERT INTO notices (id, title, body, notice_date, publication, created_at, updated_at, published_at) VALUES ('n1', 'Test notice', 'A published fictional notice.', '2026-10-20', 'Published', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z')").run();
    const response = await call(d1, '/');
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Fictional &lt;script&gt;alert\(1\)&lt;\/script&gt; row/);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /A summary with &lt;b&gt;markup&lt;\/b&gt;/);
    assert.equal((await call(d1, '/events/test-row')).status, 200);
    assert.equal((await call(d1, '/events/not-a-real-slug')).status, 404);
    const csp = response.headers.get('content-security-policy') ?? '';
    assert.match(csp, /script-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    d1.close();
  }
});

test('owner pages and actions refuse unauthenticated requests before any write', async () => {
  const d1 = database();
  try {
    const page = await call(d1, '/admin');
    assert.equal(page.status, 303);
    assert.equal(page.headers.get('location'), '/admin/login?next=%2Fadmin');

    const action = await call(d1, '/admin/events', {
      method: 'POST',
      headers: form(),
      body: body({ title: 'Unauthorised event', summary: 'Should never be written.', description: 'This request has no owner session at all.', event_date: '2099-03-01', start_note: '7:00 am', location: 'Shed', publication: 'Published' }),
    });
    assert.equal(action.status, 401);
    assert.match(await action.text(), /Sign in first/);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);

    const wrong = await call(d1, '/admin/login', {
      method: 'POST', headers: form(), body: body({ token: 'not-the-token', next: '/admin' }),
    });
    assert.equal(wrong.status, 401);
    assert.match(await wrong.text(), /not accepted/);
  } finally {
    d1.close();
  }
});

test('an owner creates, edits and publishes an event while its public address stays stable', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const created = await call(d1, '/admin/events', {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Autumn time trial', summary: 'A timed row over the club course.', description: 'A fictional timed row with a coach and a safety boat on the water.', event_date: '2099-04-11', start_note: '6:30 am for 7:00 am', location: 'Riverton Boathouse', cost: 'Free', publication: 'Draft' }),
    });
    assert.equal(created.status, 303);
    assert.match(created.headers.get('location') ?? '', /saved=created/);
    const row = d1.raw.prepare("SELECT * FROM events WHERE title = 'Autumn time trial'").get();
    assert.equal(row.publication, 'Draft');
    assert.equal(row.slug, 'autumn-time-trial');
    assert.equal((await call(d1, '/events/autumn-time-trial')).status, 404);

    const owner = await (await call(d1, '/admin', { headers: { Cookie: cookie } })).text();
    assert.match(owner, /Autumn time trial/);
    assert.match(owner, /Draft/);

    const published = await call(d1, `/admin/events/${row.id}/publish`, { method: 'POST', headers: { ...form(), Cookie: cookie }, body: '' });
    assert.equal(published.status, 303);
    assert.equal((await call(d1, '/events/autumn-time-trial')).status, 200);

    const edited = await call(d1, `/admin/events/${row.id}`, {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Autumn time trial, revised', summary: 'A timed row over the club course.', description: 'The published description changed after a committee decision.', event_date: '2099-04-12', start_note: '6:30 am for 7:00 am', location: 'Riverton Boathouse', cost: 'Free', publication: 'Published' }),
    });
    assert.equal(edited.status, 303);
    const detail = await (await call(d1, '/events/autumn-time-trial')).text();
    assert.match(detail, /Autumn time trial, revised/);
    assert.match(detail, /2099\/04\/12/);
    assert.match(detail, /published description changed/);
    const after = d1.raw.prepare('SELECT slug, published_at FROM events WHERE id = ?').get(row.id);
    assert.equal(after.slug, 'autumn-time-trial');
    assert.ok(after.published_at);
  } finally {
    d1.close();
  }
});

test('a visitor enquiry is validated, stored pending, reviewed by the owner and never published', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const invalid = await call(d1, '/join', {
      method: 'POST', headers: form(),
      body: body({ name: 'A', email: 'not-an-email', phone: '', enquiry_type: 'Joining the club', message: 'short' }),
    });
    assert.equal(invalid.status, 422);
    const invalidHtml = await invalid.text();
    assert.match(invalidHtml, /Please check these details/);
    assert.match(invalidHtml, /Enter your name/);
    assert.match(invalidHtml, /Enter an email address/);
    assert.match(invalidHtml, /Tell us a little more/);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM enquiries').get().n, 0);

    const submitted = await call(d1, '/join', {
      method: 'POST', headers: form(),
      body: body({ name: 'Fictional Ada', email: 'ada@example.test', phone: '0400 000 000', enquiry_type: 'Joining the club', message: 'I would like to try a Saturday morning row, please.' }),
    });
    assert.equal(submitted.status, 303);
    assert.match(submitted.headers.get('location') ?? '', /^\/join\/thanks\?ref=/);
    const row = d1.raw.prepare("SELECT * FROM enquiries WHERE email = 'ada@example.test'").get();
    assert.equal(row.review_state, 'Pending');

    const queue = await (await call(d1, '/admin', { headers: { Cookie: cookie } })).text();
    assert.match(queue, /Fictional Ada/);
    assert.match(queue, /I would like to try a Saturday morning row/);
    assert.match(queue, /Pending/);

    const reviewed = await call(d1, `/admin/enquiries/${row.id}/review`, {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ note: 'Replied by email and invited to Saturday.' }),
    });
    assert.equal(reviewed.status, 303);
    const after = d1.raw.prepare('SELECT review_state, review_note, reviewed_at FROM enquiries WHERE id = ?').get(row.id);
    assert.equal(after.review_state, 'Reviewed');
    assert.equal(after.review_note, 'Replied by email and invited to Saturday.');
    assert.ok(after.reviewed_at);
    const owner = await (await call(d1, '/admin', { headers: { Cookie: cookie } })).text();
    assert.match(owner, /Reviewed/);
    assert.match(owner, /Replied by email and invited to Saturday/);

    const publicPages = (await (await call(d1, '/')).text()) + (await (await call(d1, '/join')).text());
    assert.ok(!publicPages.includes('ada@example.test'));
    assert.ok(!publicPages.includes('I would like to try a Saturday morning row'));
  } finally {
    d1.close();
  }
});

test('notices can be created, edited, published and withdrawn by the owner', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const created = await call(d1, '/admin/notices', {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Pontoon closed', body: 'The pontoon is closed for fictional repairs this weekend.', notice_date: '2026-10-24', publication: 'Published' }),
    });
    assert.equal(created.status, 303);
    const row = d1.raw.prepare("SELECT * FROM notices WHERE title = 'Pontoon closed'").get();
    assert.match(await (await call(d1, '/notices')).text(), /pontoon is closed for fictional repairs/);

    const edited = await call(d1, `/admin/notices/${row.id}`, {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Pontoon reopened', body: 'The fictional repairs are finished and the pontoon is open.', notice_date: '2026-10-24', publication: 'Published' }),
    });
    assert.equal(edited.status, 303);
    assert.match(await (await call(d1, '/notices')).text(), /Pontoon reopened/);

    const withdrawn = await call(d1, `/admin/notices/${row.id}/unpublish`, { method: 'POST', headers: { ...form(), Cookie: cookie }, body: '' });
    assert.equal(withdrawn.status, 303);
    const html = await (await call(d1, '/notices')).text();
    assert.ok(!html.includes('Pontoon reopened'));
    assert.match(html, /No notices right now/);
  } finally {
    d1.close();
  }
});

test('invalid owner input keeps the form, reports the field and writes nothing', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const response = await call(d1, '/admin/events', {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'A', summary: 'too short', description: 'also short', event_date: '2099-02-30', start_note: '', location: '', cost: '', publication: 'Published' }),
    });
    assert.equal(response.status, 422);
    const html = await response.text();
    assert.match(html, /Please check these details/);
    assert.match(html, /Give the event a name/);
    assert.match(html, /Choose a real calendar date/);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
  } finally {
    d1.close();
  }
});

test('a cross-origin owner write is refused even with a valid session', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const response = await call(d1, '/admin/events', {
      method: 'POST',
      headers: { ...form(), Cookie: cookie, Origin: 'https://attacker.example' },
      body: body({ title: 'Cross origin', summary: 'Should not be written.', description: 'A cross-origin form submission attempted this write.', event_date: '2099-05-01', start_note: '7:00 am', location: 'Shed', publication: 'Draft' }),
    });
    assert.equal(response.status, 403);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
  } finally {
    d1.close();
  }
});


test('volunteer roles enforce capacity, expose remaining places and keep admin control', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    const created = await call(d1, '/admin/volunteers', {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Pontoon working bee', description: 'Help replace the handrail and paint the pontoon edge.', event_date: '2099-06-12', start_note: '9:00 am for 9:30 am', location: 'Riverton Boathouse', capacity: '2', publication: 'Published' }),
    });
    assert.equal(created.status, 303);
    const role = d1.raw.prepare("SELECT * FROM volunteer_roles WHERE title = 'Pontoon working bee'").get();
    assert.equal(role.capacity, 2);

    const list = await (await call(d1, '/volunteer')).text();
    assert.match(list, /Pontoon working bee/);
    assert.match(list, /2 of 2 places left/);
    assert.match(list, /Help replace the handrail/);

    const first = await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(),
      body: body({ name: 'Fictional Sam', email: 'sam@example.test', phone: '', notes: 'Can bring a drill.' }),
    });
    assert.equal(first.status, 303);
    assert.match(first.headers.get('location') ?? '', new RegExp(`^/volunteer/${role.id}/thanks\\?ref=`));
    const detail = await (await call(d1, `/volunteer/${role.id}`)).text();
    assert.match(detail, /1 of 2 places are still open/);

    const second = await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(),
      body: body({ name: 'Fictional Jo', email: 'jo@example.test', phone: '', notes: '' }),
    });
    assert.equal(second.status, 303);
    const full = await (await call(d1, `/volunteer/${role.id}`)).text();
    assert.match(full, /This crew is full/);
    assert.match(full, /All 2 places are filled/);

    const third = await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(),
      body: body({ name: 'Fictional Late', email: 'late@example.test', phone: '', notes: '' }),
    });
    assert.equal(third.status, 409);
    assert.equal(d1.raw.prepare("SELECT COUNT(*) AS n FROM volunteer_signups WHERE state = 'Confirmed'").get().n, 2);

    const owner = await (await call(d1, `/admin/volunteers/${role.id}/edit`, { headers: { Cookie: cookie } })).text();
    assert.match(owner, /Fictional Sam/);
    assert.match(owner, /Fictional Jo/);
    assert.match(owner, /2 of 2 places are taken/);

    const edited = await call(d1, `/admin/volunteers/${role.id}`, {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Pontoon working bee and lunch', description: 'Help replace the handrail and paint the pontoon edge, then stay for lunch.', event_date: '2099-06-12', start_note: '9:00 am for 9:30 am', location: 'Riverton Boathouse', capacity: '4', publication: 'Published' }),
    });
    assert.equal(edited.status, 303);
    const reopened = await (await call(d1, `/volunteer/${role.id}`)).text();
    assert.match(reopened, /2 of 4 places are still open/);
    assert.match(reopened, /Pontoon working bee and lunch/);
  } finally {
    d1.close();
  }
});

test('volunteer sign-up validation is server-side and a full role cannot be joined by a malformed request', async () => {
  const d1 = database();
  try {
    const cookie = await signIn(d1);
    await call(d1, '/admin/volunteers', {
      method: 'POST', headers: { ...form(), Cookie: cookie },
      body: body({ title: 'Ferry driver', description: 'Drive the fictional club ferry on open day.', event_date: '2099-07-01', start_note: '8:00 am', location: 'Riverton jetty', capacity: '1', publication: 'Published' }),
    });
    const role = d1.raw.prepare("SELECT * FROM volunteer_roles WHERE title = 'Ferry driver'").get();
    const invalid = await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(),
      body: body({ name: 'A', email: 'bad', phone: '', notes: '' }),
    });
    assert.equal(invalid.status, 422);
    assert.match(await invalid.text(), /Enter your name/);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM volunteer_signups').get().n, 0);
    await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(), body: body({ name: 'Fictional First', email: 'first@example.test', phone: '', notes: '' }),
    });
    const full = await call(d1, `/volunteer/${role.id}/signup`, {
      method: 'POST', headers: form(), body: body({ name: 'Fictional Second', email: 'second@example.test', phone: '', notes: '' }),
    });
    assert.equal(full.status, 409);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM volunteer_signups').get().n, 1);
  } finally {
    d1.close();
  }
});
