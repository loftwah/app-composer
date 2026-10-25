import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasErrors, isRealDate, normaliseEnquiry, normaliseEvent, slugify, shortReference, validateEnquiry, validateEvent,
} from '../src/validate.ts';
import { eventDateLabel, eventDateShort, isCalendarDate, isUpcoming, timestampLabel, todayInMelbourne } from '../src/time.ts';

test('calendar dates follow the real Gregorian calendar and never shift a day', () => {
  for (const value of ['0001-01-01', '2000-02-29', '2028-02-29', '2026-11-14', '9999-12-31']) {
    assert.equal(isCalendarDate(value), true, value);
    assert.equal(isRealDate(value), true, value);
  }
  for (const value of ['2026-02-29', '2026-00-01', '2026-13-01', '2026-04-31', '2026-2-09', '2026-11-14T00:00:00Z', ' 2026-11-14', '0000-01-01']) {
    assert.equal(isCalendarDate(value), false, value);
    assert.equal(isRealDate(value), false, value);
  }
  assert.equal(eventDateLabel('2026-11-14'), 'Saturday 14 November 2026');
  assert.equal(eventDateShort('2026-11-14'), '2026/11/14');
  assert.equal(eventDateLabel('broken'), 'Date to confirm');
});

test('stored instants are readable in both Australia/Melbourne and UTC', () => {
  const label = timestampLabel('2026-10-24T22:12:00.000Z');
  assert.equal(label, '2026/10/25 09:12 Australia/Melbourne · 2026/10/24 22:12 UTC');
  assert.equal(timestampLabel('not-a-date'), 'Unknown time Australia/Melbourne · Unknown time UTC');
});

test('upcoming comparison uses the Melbourne club day', () => {
  assert.equal(todayInMelbourne(new Date('2026-10-24T22:12:00.000Z')), '2026-10-25');
  assert.equal(isUpcoming('2026-10-25', '2026-10-25'), true);
  assert.equal(isUpcoming('2026-10-24', '2026-10-25'), false);
});

test('event validation keeps every exported model key and rejects impossible values', () => {
  const values = normaliseEvent({
    title: '  Spring row  ', summary: 'A gentle morning on the river.', description: 'Meet at the shed while the mist is still on the water.',
    event_date: '2026-11-14', start_note: '7:00 am for a 7:30 am start', location: 'Riverton Boathouse', cost: '', publication: 'Published',
  });
  assert.equal(values.title, 'Spring row');
  assert.equal(hasErrors(validateEvent(values)), false);
  assert.deepEqual(Object.keys(values), ['title', 'summary', 'description', 'event_date', 'start_note', 'location', 'cost', 'publication']);

  const bad = normaliseEvent({ title: 'A', summary: 'short', description: 'short', event_date: '2026-02-29', start_note: '', location: '', publication: 'Live' });
  const errors = validateEvent(bad);
  assert.equal(errors.title, 'Give the event a name (at least 3 characters).');
  assert.equal(errors.event_date, 'Choose a real calendar date.');
  assert.equal(bad.publication, 'Draft');
});

test('enquiry validation rejects a bad address, short message and unknown type', () => {
  const values = normaliseEnquiry({ name: 'Ada', email: 'ADA@EXAMPLE.TEST', phone: '', enquiry_type: 'Joining the club', message: 'I would like to try a row.' });
  assert.equal(values.email, 'ada@example.test');
  assert.equal(hasErrors(validateEnquiry(values)), false);

  const errors = validateEnquiry(normaliseEnquiry({ name: '', email: 'nope', phone: '', enquiry_type: 'Sales', message: 'short' }));
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'enquiry_type', 'message', 'name']);
});

test('slugs and public references are stable and harmless', () => {
  assert.equal(slugify('Spring row & breakfast'), 'spring-row-breakfast');
  assert.equal(slugify('  ---  '), 'event');
  assert.equal(shortReference('6f41c0d8-1234-4abc-9def-000000000000'), 'RRC-6F41C0D8');
});
