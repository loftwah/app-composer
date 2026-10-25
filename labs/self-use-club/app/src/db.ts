import type { EnquiryRow, EventRow, NoticeRow, VolunteerRoleRow, VolunteerSignupRow } from './env.ts';
import { slugify, type Values } from './validate.ts';

export async function listPublicEvents(db: D1Database, today: string, limit = 24): Promise<EventRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM events WHERE publication = 'Published' AND event_date >= ? ORDER BY event_date ASC LIMIT ?")
    .bind(today, limit)
    .all<EventRow>();
  return results;
}

export async function getPublishedEvent(db: D1Database, slug: string): Promise<EventRow | null> {
  return db.prepare("SELECT * FROM events WHERE slug = ? AND publication = 'Published'").bind(slug).first<EventRow>();
}

export async function listPublicNotices(db: D1Database, limit = 4): Promise<NoticeRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM notices WHERE publication = 'Published' ORDER BY notice_date DESC LIMIT ?")
    .bind(limit)
    .all<NoticeRow>();
  return results;
}

export async function listAllEvents(db: D1Database): Promise<EventRow[]> {
  const { results } = await db.prepare('SELECT * FROM events ORDER BY event_date DESC').all<EventRow>();
  return results;
}

export async function listAllNotices(db: D1Database): Promise<NoticeRow[]> {
  const { results } = await db.prepare('SELECT * FROM notices ORDER BY notice_date DESC').all<NoticeRow>();
  return results;
}

export async function listEnquiries(db: D1Database): Promise<EnquiryRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM enquiries ORDER BY CASE review_state WHEN 'Pending' THEN 0 ELSE 1 END, created_at DESC")
    .all<EnquiryRow>();
  return results;
}

export async function adminCounts(db: D1Database): Promise<{ pending: number; draftEvents: number; publishedEvents: number }> {
  const row = await db
    .prepare(`SELECT
      (SELECT COUNT(*) FROM enquiries WHERE review_state = 'Pending') AS pending,
      (SELECT COUNT(*) FROM events WHERE publication = 'Draft') AS draftEvents,
      (SELECT COUNT(*) FROM events WHERE publication = 'Published') AS publishedEvents`)
    .first<{ pending: number; draftEvents: number; publishedEvents: number }>();
  return row ?? { pending: 0, draftEvents: 0, publishedEvents: 0 };
}

async function uniqueSlug(db: D1Database, title: string): Promise<string> {
  const base = slugify(title);
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const found = await db.prepare('SELECT id FROM events WHERE slug = ?').bind(candidate).first<{ id: string }>();
    if (!found) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createEvent(db: D1Database, values: Values): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(db, values.title);
  await db
    .prepare(`INSERT INTO events
      (id, slug, title, summary, description, event_date, start_note, location, cost, publication, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, slug, values.title, values.summary, values.description, values.event_date, values.start_note, values.location, values.cost, values.publication, now, now, values.publication === 'Published' ? now : null)
    .run();
  return id;
}

export async function updateEvent(db: D1Database, id: string, values: Values): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE events SET title = ?, summary = ?, description = ?, event_date = ?, start_note = ?, location = ?, cost = ?,
      publication = ?, updated_at = ?, published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END
      WHERE id = ?`)
    .bind(values.title, values.summary, values.description, values.event_date, values.start_note, values.location, values.cost, values.publication, now, values.publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function setEventPublication(db: D1Database, id: string, publication: 'Draft' | 'Published'): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE events SET publication = ?, updated_at = ?, published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END WHERE id = ?`)
    .bind(publication, now, publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function createNotice(db: D1Database, values: Values): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO notices (id, title, body, notice_date, publication, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, values.title, values.body, values.notice_date, values.publication, now, now, values.publication === 'Published' ? now : null)
    .run();
  return id;
}

export async function getNoticeById(db: D1Database, id: string): Promise<NoticeRow | null> {
  return db.prepare('SELECT * FROM notices WHERE id = ?').bind(id).first<NoticeRow>();
}

export async function updateNotice(db: D1Database, id: string, values: Values): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE notices SET title = ?, body = ?, notice_date = ?, publication = ?, updated_at = ?,
      published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END WHERE id = ?`)
    .bind(values.title, values.body, values.notice_date, values.publication, now, values.publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function setNoticePublication(db: D1Database, id: string, publication: 'Draft' | 'Published'): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE notices SET publication = ?, updated_at = ?, published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END WHERE id = ?`)
    .bind(publication, now, publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

const roleSelect = `SELECT r.*,
  (SELECT COUNT(*) FROM volunteer_signups s WHERE s.role_id = r.id AND s.state = 'Confirmed') AS taken,
  r.capacity - (SELECT COUNT(*) FROM volunteer_signups s WHERE s.role_id = r.id AND s.state = 'Confirmed') AS remaining
  FROM volunteer_roles r`;

export async function listPublicVolunteerRoles(db: D1Database, today: string): Promise<VolunteerRoleRow[]> {
  const { results } = await db
    .prepare(`${roleSelect} WHERE r.publication = 'Published' AND r.event_date >= ? ORDER BY r.event_date ASC, r.title ASC`)
    .bind(today)
    .all<VolunteerRoleRow>();
  return results;
}

export async function getPublicVolunteerRole(db: D1Database, id: string): Promise<VolunteerRoleRow | null> {
  return db.prepare(`${roleSelect} WHERE r.id = ? AND r.publication = 'Published'`).bind(id).first<VolunteerRoleRow>();
}

export async function listAllVolunteerRoles(db: D1Database): Promise<VolunteerRoleRow[]> {
  const { results } = await db.prepare(`${roleSelect} ORDER BY r.event_date DESC, r.title ASC`).all<VolunteerRoleRow>();
  return results;
}

export async function getVolunteerRoleById(db: D1Database, id: string): Promise<VolunteerRoleRow | null> {
  return db.prepare(`${roleSelect} WHERE r.id = ?`).bind(id).first<VolunteerRoleRow>();
}

export async function listSignupsForRole(db: D1Database, roleId: string): Promise<VolunteerSignupRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM volunteer_signups WHERE role_id = ? AND state = 'Confirmed' ORDER BY created_at ASC")
    .bind(roleId)
    .all<VolunteerSignupRow>();
  return results;
}

export async function createVolunteerRole(db: D1Database, values: Values): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO volunteer_roles (id, title, description, event_date, start_note, location, capacity, publication, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, values.title, values.description, values.event_date, values.start_note, values.location, Number(values.capacity), values.publication, now, now, values.publication === 'Published' ? now : null)
    .run();
  return id;
}

export async function updateVolunteerRole(db: D1Database, id: string, values: Values): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE volunteer_roles SET title = ?, description = ?, event_date = ?, start_note = ?, location = ?, capacity = ?,
      publication = ?, updated_at = ?, published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END
      WHERE id = ?`)
    .bind(values.title, values.description, values.event_date, values.start_note, values.location, Number(values.capacity), values.publication, now, values.publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function setVolunteerRolePublication(db: D1Database, id: string, publication: 'Draft' | 'Published'): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE volunteer_roles SET publication = ?, updated_at = ?, published_at = CASE WHEN ? = 'Published' AND published_at IS NULL THEN ? ELSE published_at END WHERE id = ?`)
    .bind(publication, now, publication, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function createVolunteerSignup(db: D1Database, roleId: string, values: Values): Promise<boolean> {
  const result = await db
    .prepare(`INSERT INTO volunteer_signups (id, role_id, name, email, phone, notes, state, created_at)
      SELECT ?, r.id, ?, ?, ?, ?, 'Confirmed', ?
      FROM volunteer_roles r
      WHERE r.id = ? AND r.publication = 'Published'
        AND (SELECT COUNT(*) FROM volunteer_signups s WHERE s.role_id = r.id AND s.state = 'Confirmed') < r.capacity`)
    .bind(crypto.randomUUID(), values.name, values.email, values.phone, values.notes, new Date().toISOString(), roleId)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

export async function createEnquiry(db: D1Database, values: Values): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO enquiries (id, name, email, phone, enquiry_type, message, review_state, review_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', '', ?)`)
    .bind(id, values.name, values.email, values.phone, values.enquiry_type, values.message, new Date().toISOString())
    .run();
  return id;
}

export async function reviewEnquiry(db: D1Database, id: string, note: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE enquiries SET review_state = 'Reviewed', review_note = ?, reviewed_at = ? WHERE id = ?")
    .bind(note.slice(0, 500), new Date().toISOString(), id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
