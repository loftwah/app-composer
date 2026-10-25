import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createD1 } from './support/sqlite-d1.mjs';

const first = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const second = readFileSync(new URL('../migrations/0002_volunteers.sql', import.meta.url), 'utf8');

const read = (d1, table) => JSON.parse(JSON.stringify(d1.raw.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
const columns = (d1, table) => d1.raw.prepare(`PRAGMA table_info(${table})`).all().map((column) => [column.name, column.type, column.notnull]);

test('the volunteer migration only adds tables and leaves every existing row and column intact', () => {
  const d1 = createD1();
  try {
    d1.exec(first);
    d1.raw.prepare(`INSERT INTO events (id, slug, title, summary, description, event_date, start_note, location, cost, publication, created_at, updated_at, published_at)
      VALUES ('evt-old', 'old-row', 'Existing event', 'A fictional summary that must survive.', 'A fictional description that must survive the second request.', '2026-11-14', '7:00 am', 'Old shed', '', 'Published', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`).run();
    d1.raw.prepare("INSERT INTO notices (id, title, body, notice_date, publication, created_at, updated_at, published_at) VALUES ('note-old', 'Existing notice', 'A notice that must survive.', '2026-10-20', 'Published', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z')").run();
    d1.raw.prepare("INSERT INTO enquiries (id, name, email, phone, enquiry_type, message, review_state, review_note, created_at, reviewed_at) VALUES ('enq-old', 'Existing Person', 'old@example.test', '', 'Joining the club', 'An existing enquiry that must survive.', 'Reviewed', 'Existing owner note', '2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z')").run();

    const before = {
      events: read(d1, 'events'),
      notices: read(d1, 'notices'),
      enquiries: read(d1, 'enquiries'),
      eventColumns: columns(d1, 'events'),
      noticeColumns: columns(d1, 'notices'),
      enquiryColumns: columns(d1, 'enquiries'),
    };
    d1.exec(second);
    assert.deepEqual(read(d1, 'events'), before.events);
    assert.deepEqual(read(d1, 'notices'), before.notices);
    assert.deepEqual(read(d1, 'enquiries'), before.enquiries);
    assert.deepEqual(columns(d1, 'events'), before.eventColumns);
    assert.deepEqual(columns(d1, 'notices'), before.noticeColumns);
    assert.deepEqual(columns(d1, 'enquiries'), before.enquiryColumns);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM volunteer_roles').get().n, 0);
    assert.equal(d1.raw.prepare('SELECT COUNT(*) AS n FROM volunteer_signups').get().n, 0);
    assert.equal(before.events[0].title, 'Existing event');
    assert.equal(before.enquiries[0].review_note, 'Existing owner note');
  } finally {
    d1.close();
  }
});

test('the second migration is forward-only and never rewrites the first request tables', () => {
  const upper = second.toUpperCase();
  for (const forbidden of ['DROP ', 'ALTER ', 'DELETE ', 'UPDATE ', 'INSERT INTO EVENTS', 'INSERT INTO NOTICES', 'INSERT INTO ENQUIRIES']) {
    assert.ok(!upper.includes(forbidden), `second migration must not contain ${forbidden}`);
  }
  assert.match(second, /CREATE TABLE IF NOT EXISTS volunteer_roles/);
  assert.match(second, /CREATE TABLE IF NOT EXISTS volunteer_signups/);
  assert.match(second, /CHECK \(capacity BETWEEN 1 AND 100\)/);
  assert.match(second, /state IN \('Confirmed', 'Cancelled'\)/);
});
