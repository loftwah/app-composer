import type { EnquiryRow, EventRow, NoticeRow, VolunteerRoleRow, VolunteerSignupRow } from './env.ts';
import { eventDateShort, timestampLabel } from './time.ts';
import type { Errors, Values } from './validate.ts';
import { esc, layout } from './render.ts';

function adminShell(options: { title: string; body: string; origin: string; includeVolunteer?: boolean; active?: string }): string {
  return layout({ ...options, description: 'Private owner area for the fictional Riverton Rowing Club.' });
}

function adminHeader(options: { origin: string; includeVolunteer?: boolean; active?: string }): string {
  const links = [
    ['/admin', 'Overview', 'overview'],
    ['/admin#enquiries', 'Enquiries', 'enquiries'],
    ['/admin#events', 'Events', 'events'],
    ['/admin#notices', 'Notices', 'notices'],
    ['/admin#volunteers', 'Volunteers', 'volunteers'],
  ] as const;
  return `<header class="admin-header"><div class="shell">
    <strong>Riverton Rowing Club · owner area</strong>
    <nav class="admin-nav" aria-label="Owner">
      ${links.map(([href, label, key]) => `<a href="${href}"${options.active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      <a href="/">View public site</a>
      <form method="post" action="/admin/logout"><button type="submit">Sign out</button></form>
    </nav>
  </div></header>`;
}

export function loginPage(options: { origin: string; next?: string; error?: string; configured?: boolean }): string {
  const next = options.next && options.next.startsWith('/admin') ? options.next : '/admin';
  const body = `<header class="admin-header"><div class="shell"><strong>Riverton Rowing Club · owner area</strong><nav class="admin-nav" aria-label="Owner"><a href="/">View public site</a></nav></div></header><div class="shell admin-main">
    <div class="login-card">
      <div class="form-card">
        <p class="eyebrow">Owner area</p>
        <h1 class="login-title">Sign in to the club.</h1>
        <p>This local demonstration uses one owner secret. It is checked on the server for every private page and action.</p>
        ${options.error ? `<div class="form-errors" role="alert"><h2>${esc(options.error)}</h2><p>Check the local <code>ADMIN_TOKEN</code> and try again. Nothing was changed.</p></div>` : ''}
        ${options.configured === false ? `<div class="form-errors" role="alert"><h2>Owner sign-in is not configured.</h2><p>Start the app with an <code>ADMIN_TOKEN</code> value. See the app README.</p></div>` : ''}
        <form method="post" action="/admin/login">
          <input type="hidden" name="next" value="${esc(next)}">
          <div class="field">
            <label for="token">Owner secret</label>
            <input id="token" name="token" type="password" autocomplete="current-password" required>
            <span class="hint">Pasted from the local run command. Never enter a real provider credential here.</span>
          </div>
          <button class="button" type="submit"${options.configured === false ? ' disabled' : ''}>Sign in</button>
        </form>
        <p class="login-note">The session is an HttpOnly, SameSite=Strict cookie for this local origin. Marking an enquiry reviewed or publishing an event writes to the app-owned D1 database; it sends no email and charges no one.</p>
      </div>
    </div>
  </div>`;
  return adminShell({ title: 'Owner sign-in', body, origin: options.origin });
}

const flashMessages: Record<string, string> = {
  created: 'Saved as a draft. Publish it when the details are ready.',
  published: 'Published. The public page now shows this record.',
  unpublished: 'Returned to draft. It is no longer on the public site.',
  updated: 'Changes saved. The public page reflects them immediately when published.',
  reviewed: 'Enquiry marked reviewed. That records an owner decision; it does not send a reply.',
  notice_created: 'Notice saved as a draft.',
  notice_updated: 'Notice changes saved.',
};

export function dashboardPage(options: {
  counts: { pending: number; draftEvents: number; publishedEvents: number };
  enquiries: EnquiryRow[];
  events: EventRow[];
  notices: NoticeRow[];
  flash?: string;
  origin: string;
  includeVolunteer?: boolean;
  volunteerRoles?: VolunteerRoleRow[];
}): string {
  const pending = options.enquiries.filter((enquiry) => enquiry.review_state === 'Pending');
  const reviewed = options.enquiries.filter((enquiry) => enquiry.review_state === 'Reviewed');
  const body = `${adminHeader({ origin: options.origin, includeVolunteer: options.includeVolunteer })}
  <div class="shell admin-main">
    <div class="admin-title">
      <div><p class="eyebrow">Private</p><h1>Owner overview.</h1><p>Only signed-in owner requests can read this page. Enquiries and drafts never appear publicly.</p></div>
      <div class="actions"><a class="button small" href="/admin/events/new">New event</a><a class="button small secondary" href="/admin/notices/new">New notice</a></div>
    </div>
    ${options.flash && flashMessages[options.flash] ? `<p class="flash" role="status">${esc(flashMessages[options.flash])}</p>` : ''}
    <div class="stat-row">
      <div class="stat"><b>${options.counts.pending}</b><span>Enquiries awaiting review</span></div>
      <div class="stat"><b>${options.counts.publishedEvents}</b><span>Published events</span></div>
      <div class="stat"><b>${options.counts.draftEvents}</b><span>Event drafts</span></div>
    </div>

    <section class="admin-section" id="enquiries" aria-labelledby="enquiries-heading">
      <h2 id="enquiries-heading">Enquiries <span class="status pending">${pending.length} pending</span></h2>
      ${pending.length ? pending.map(enquiryRecord).join('') : `<p class="admin-empty">No enquiries are waiting. A submitted joining enquiry appears here with a Pending state.</p>`}
      ${reviewed.length ? `<details${options.flash === 'reviewed' ? ' open' : ''}><summary>${reviewed.length} reviewed ${reviewed.length === 1 ? 'enquiry' : 'enquiries'}</summary>${reviewed.map(enquiryRecord).join('')}</details>` : ''}
    </section>

    <section class="admin-section" id="events" aria-labelledby="events-heading">
      <h2 id="events-heading">Events</h2>
      <p><a class="button small secondary" href="/admin/events/new">Create an event</a></p>
      ${options.events.length ? `<table class="admin-table"><thead><tr><th>Event</th><th>Date</th><th>State</th><th>Actions</th></tr></thead><tbody>${options.events.map(eventRow).join('')}</tbody></table>` : `<p class="admin-empty">No events yet. Create a draft, then publish it when the details are ready.</p>`}
    </section>

    <section class="admin-section" id="notices" aria-labelledby="notices-heading">
      <h2 id="notices-heading">Notices</h2>
      <p><a class="button small secondary" href="/admin/notices/new">Create a notice</a></p>
      ${options.notices.length ? `<table class="admin-table"><thead><tr><th>Notice</th><th>Date</th><th>State</th><th>Actions</th></tr></thead><tbody>${options.notices.map(noticeRow).join('')}</tbody></table>` : `<p class="admin-empty">No notices yet. Published notices appear on the public home and notices pages.</p>`}
    </section>
    ${volunteerAdminSection(options.volunteerRoles ?? [])}
  </div>`;
  return adminShell({ title: 'Owner overview', body, origin: options.origin, includeVolunteer: options.includeVolunteer });
}


function volunteerAdminSection(roles: VolunteerRoleRow[]): string {
  return `<section class="admin-section" id="volunteers" aria-labelledby="volunteers-heading">
    <h2 id="volunteers-heading">Volunteers</h2>
    <p><a class="button small secondary" href="/admin/volunteers/new">Create a volunteer role</a></p>
    ${roles.length ? `<table class="admin-table"><thead><tr><th>Role</th><th>Date</th><th>Places</th><th>State</th><th>Actions</th></tr></thead><tbody>${roles.map(volunteerRow).join('')}</tbody></table>` : `<p class="admin-empty">No volunteer roles yet. Create a role with a capacity, then publish it so visitors can sign up.</p>`}
  </section>`;
}

function volunteerRow(role: VolunteerRoleRow): string {
  const action = role.publication === 'Published' ? 'unpublish' : 'publish';
  const label = role.publication === 'Published' ? 'Return to draft' : 'Publish';
  return `<tr>
    <td><a href="/admin/volunteers/${esc(role.id)}/edit">${esc(role.title)}</a></td>
    <td>${esc(eventDateShort(role.event_date))}</td>
    <td>${esc(String(role.taken ?? 0))} of ${esc(String(role.capacity))}</td>
    <td>${statusPill(role.publication)}</td>
    <td><div class="actions"><a class="button small secondary" href="/admin/volunteers/${esc(role.id)}/edit">Edit</a><form method="post" action="/admin/volunteers/${esc(role.id)}/${action}"><button class="button small secondary" type="submit">${label}</button></form></div></td>
  </tr>`;
}

function statusPill(value: string): string {
  const kind = value === 'Published' ? 'published' : value === 'Reviewed' ? 'reviewed' : value === 'Pending' ? 'pending' : 'draft';
  return `<span class="status ${kind}">${esc(value)}</span>`;
}

function enquiryRecord(enquiry: EnquiryRow): string {
  return `<article class="admin-record">
    <header><h3>${esc(enquiry.name)} · ${esc(enquiry.enquiry_type)}</h3>${statusPill(enquiry.review_state)}</header>
    <p class="contact">${esc(enquiry.email)}${enquiry.phone ? ` · ${esc(enquiry.phone)}` : ''}</p>
    <p class="when">Received ${esc(timestampLabel(enquiry.created_at))} · ${esc(enquiry.id)}</p>
    <p class="body">${esc(enquiry.message)}</p>
    ${enquiry.review_state === 'Pending' ? `<form class="inline" method="post" action="/admin/enquiries/${esc(enquiry.id)}/review">
      <div class="field"><label for="note-${esc(enquiry.id)}">Owner note <span class="hint">Private, optional</span></label><input id="note-${esc(enquiry.id)}" name="note" maxlength="500" placeholder="For example: replied by email, needs a buddy for Saturday"></div>
      <button class="button small" type="submit">Mark reviewed</button>
    </form><p class="when">Marking reviewed records a decision in this database. It does not reply, notify or charge anyone.</p>` : `<p class="when">Reviewed ${enquiry.reviewed_at ? esc(timestampLabel(enquiry.reviewed_at)) : ''}${enquiry.review_note ? ` · Note: ${esc(enquiry.review_note)}` : ''}</p>`}
  </article>`;
}

function eventRow(event: EventRow): string {
  const action = event.publication === 'Published' ? 'unpublish' : 'publish';
  const label = event.publication === 'Published' ? 'Return to draft' : 'Publish';
  return `<tr>
    <td><a href="/admin/events/${esc(event.id)}/edit">${esc(event.title)}</a><br><small>${esc(event.slug)}</small></td>
    <td>${esc(eventDateShort(event.event_date))}</td>
    <td>${statusPill(event.publication)}</td>
    <td><div class="actions"><a class="button small secondary" href="/admin/events/${esc(event.id)}/edit">Edit</a><form method="post" action="/admin/events/${esc(event.id)}/${action}"><button class="button small secondary" type="submit">${label}</button></form></div></td>
  </tr>`;
}

function noticeRow(notice: NoticeRow): string {
  const action = notice.publication === 'Published' ? 'unpublish' : 'publish';
  const label = notice.publication === 'Published' ? 'Return to draft' : 'Publish';
  return `<tr>
    <td><a href="/admin/notices/${esc(notice.id)}/edit">${esc(notice.title)}</a></td>
    <td>${esc(eventDateShort(notice.notice_date))}</td>
    <td>${statusPill(notice.publication)}</td>
    <td><div class="actions"><a class="button small secondary" href="/admin/notices/${esc(notice.id)}/edit">Edit</a><form method="post" action="/admin/notices/${esc(notice.id)}/${action}"><button class="button small secondary" type="submit">${label}</button></form></div></td>
  </tr>`;
}

function errorSummary(errors: Errors): string {
  if (!Object.keys(errors).length) return '';
  return `<div class="form-errors" role="alert"><h2>Please check these details</h2><ul>${Object.entries(errors).map(([key, message]) => `<li><a href="#${esc(key)}">${esc(message)}</a></li>`).join('')}</ul></div>`;
}

function fieldError(errors: Errors, key: string): string {
  return errors[key] ? `<p class="error-text" id="${key}-error">${esc(errors[key])}</p>` : '';
}

function invalid(errors: Errors, key: string): string {
  return errors[key] ? ' aria-invalid="true" aria-describedby="' + key + '-error"' : '';
}

export function eventFormPage(options: {
  event?: EventRow;
  values?: Values;
  errors?: Errors;
  today: string;
  origin: string;
  includeVolunteer?: boolean;
}): string {
  const event = options.event;
  const values: Values = options.values ?? (event ? {
    title: event.title, summary: event.summary, description: event.description, event_date: event.event_date,
    start_note: event.start_note, location: event.location, cost: event.cost, publication: event.publication,
  } : { event_date: options.today, start_note: '7:00 am for a 7:30 am start', location: 'Riverton Boathouse, 4 River Parade', publication: 'Draft' });
  const errors = options.errors ?? {};
  const editing = Boolean(event);
  const body = `${adminHeader({ origin: options.origin, includeVolunteer: options.includeVolunteer, active: 'events' })}
  <div class="shell admin-main">
    <p><a href="/admin#events">← Back to owner overview</a></p>
    <section class="admin-form" aria-labelledby="event-form-heading">
      <h2 id="event-form-heading">${editing ? 'Edit event' : 'Create an event'}</h2>
      <p class="field-label admin-lede">Saving a draft keeps it off the public site. Publishing makes the event appear at <code>/events</code> immediately. The public address stays stable when the title changes.</p>
      ${errorSummary(errors)}
      <form method="post" action="${editing ? `/admin/events/${esc(event!.id)}` : '/admin/events'}">
        <div class="field"><label for="title">Event name *</label><input id="title" name="title" maxlength="90" required value="${esc(values.title ?? '')}"${invalid(errors, 'title')}>${fieldError(errors, 'title')}</div>
        <div class="field"><label for="summary">One-line summary *</label><input id="summary" name="summary" maxlength="200" required value="${esc(values.summary ?? '')}"${invalid(errors, 'summary')}><span class="hint">Shown on cards and in search descriptions.</span>${fieldError(errors, 'summary')}</div>
        <div class="field"><label for="description">What happens *</label><textarea id="description" name="description" maxlength="2000" required${invalid(errors, 'description')}>${esc(values.description ?? '')}</textarea>${fieldError(errors, 'description')}</div>
        <div class="field-row">
          <div class="field"><label for="event_date">Event day *</label><input id="event_date" name="event_date" type="date" required min="0001-01-01" max="9999-12-31" value="${esc(values.event_date ?? '')}"${invalid(errors, 'event_date')}><span class="hint">Stored as YYYY-MM-DD, a calendar day in Australia/Melbourne, not an instant. The browser may display its own short date format in the picker.</span>${fieldError(errors, 'event_date')}</div>
          <div class="field"><label for="start_note">Start time *</label><input id="start_note" name="start_note" maxlength="60" required value="${esc(values.start_note ?? '')}"${invalid(errors, 'start_note')}><span class="hint">Free text, for example “7:00 am for a 7:30 am start”.</span>${fieldError(errors, 'start_note')}</div>
        </div>
        <div class="field-row">
          <div class="field"><label for="location">Meeting place *</label><input id="location" name="location" maxlength="120" required value="${esc(values.location ?? '')}"${invalid(errors, 'location')}>${fieldError(errors, 'location')}</div>
          <div class="field"><label for="cost">Cost or what to bring</label><input id="cost" name="cost" maxlength="120" value="${esc(values.cost ?? '')}"></div>
        </div>
        <div class="field"><label for="publication">Publication</label><select id="publication" name="publication"><option value="Draft"${values.publication === 'Draft' ? ' selected' : ''}>Draft — private</option><option value="Published"${values.publication === 'Published' ? ' selected' : ''}>Published — visible to everyone</option></select></div>
        <div class="actions"><button class="button" type="submit">${editing ? 'Save event' : 'Create event'}</button><a class="button secondary" href="/admin#events">Cancel</a></div>
      </form>
    </section>
  </div>`;
  return adminShell({ title: editing ? 'Edit event' : 'Create an event', body, origin: options.origin, includeVolunteer: options.includeVolunteer, active: 'events' });
}

export function noticeFormPage(options: {
  notice?: NoticeRow;
  values?: Values;
  errors?: Errors;
  today: string;
  origin: string;
  includeVolunteer?: boolean;
}): string {
  const notice = options.notice;
  const values: Values = options.values ?? (notice ? {
    title: notice.title, body: notice.body, notice_date: notice.notice_date, publication: notice.publication,
  } : { notice_date: options.today, publication: 'Draft' });
  const errors = options.errors ?? {};
  const editing = Boolean(notice);
  const body = `${adminHeader({ origin: options.origin, includeVolunteer: options.includeVolunteer, active: 'notices' })}
  <div class="shell admin-main">
    <p><a href="/admin#notices">← Back to owner overview</a></p>
    <section class="admin-form" aria-labelledby="notice-form-heading">
      <h2 id="notice-form-heading">${editing ? 'Edit notice' : 'Create a notice'}</h2>
      ${errorSummary(errors)}
      <form method="post" action="${editing ? `/admin/notices/${esc(notice!.id)}` : '/admin/notices'}">
        <div class="field"><label for="title">Notice heading *</label><input id="title" name="title" maxlength="90" required value="${esc(values.title ?? '')}"${invalid(errors, 'title')}>${fieldError(errors, 'title')}</div>
        <div class="field"><label for="body">Notice text *</label><textarea id="body" name="body" maxlength="900" required${invalid(errors, 'body')}>${esc(values.body ?? '')}</textarea>${fieldError(errors, 'body')}</div>
        <div class="field"><label for="notice_date">Notice date *</label><input id="notice_date" name="notice_date" type="date" required value="${esc(values.notice_date ?? '')}"${invalid(errors, 'notice_date')}>${fieldError(errors, 'notice_date')}</div>
        <div class="field"><label for="publication">Publication</label><select id="publication" name="publication"><option value="Draft"${values.publication === 'Draft' ? ' selected' : ''}>Draft — private</option><option value="Published"${values.publication === 'Published' ? ' selected' : ''}>Published — visible to everyone</option></select></div>
        <div class="actions"><button class="button" type="submit">${editing ? 'Save notice' : 'Create notice'}</button><a class="button secondary" href="/admin#notices">Cancel</a></div>
      </form>
    </section>
  </div>`;
  return adminShell({ title: editing ? 'Edit notice' : 'Create a notice', body, origin: options.origin, includeVolunteer: options.includeVolunteer, active: 'notices' });
}

export function volunteerFormPage(options: {
  role?: VolunteerRoleRow;
  values?: Values;
  errors?: Errors;
  signups?: VolunteerSignupRow[];
  today: string;
  origin: string;
}): string {
  const role = options.role;
  const values: Values = options.values ?? (role ? {
    title: role.title, description: role.description, event_date: role.event_date, start_note: role.start_note,
    location: role.location, capacity: String(role.capacity), publication: role.publication,
  } : { event_date: options.today, start_note: '9:00 am for a 9:30 am start', location: 'Riverton Boathouse, 4 River Parade', capacity: '6', publication: 'Draft' });
  const errors = options.errors ?? {};
  const editing = Boolean(role);
  const body = `${adminHeader({ origin: options.origin, active: 'volunteers' })}
  <div class="shell admin-main">
    <p><a href="/admin#volunteers">← Back to owner overview</a></p>
    <section class="admin-form" aria-labelledby="volunteer-form-heading">
      <h2 id="volunteer-form-heading">${editing ? 'Edit volunteer role' : 'Create a volunteer role'}</h2>
      <p class="field-label admin-lede">The capacity is the hard limit. Confirmed sign-ups reduce the public places left; the server checks it again on every sign-up.</p>
      ${errorSummary(errors)}
      <form method="post" action="${editing ? `/admin/volunteers/${esc(role!.id)}` : '/admin/volunteers'}">
        <div class="field"><label for="title">Role name *</label><input id="title" name="title" maxlength="90" required value="${esc(values.title ?? '')}"${invalid(errors, 'title')}>${fieldError(errors, 'title')}</div>
        <div class="field"><label for="description">What the job involves *</label><textarea id="description" name="description" maxlength="1000" required${invalid(errors, 'description')}>${esc(values.description ?? '')}</textarea>${fieldError(errors, 'description')}</div>
        <div class="field-row">
          <div class="field"><label for="event_date">Date *</label><input id="event_date" name="event_date" type="date" required value="${esc(values.event_date ?? '')}"${invalid(errors, 'event_date')}><span class="hint">Stored as YYYY-MM-DD. The browser may display its own short date format in the picker.</span>${fieldError(errors, 'event_date')}</div>
          <div class="field"><label for="start_note">Start time *</label><input id="start_note" name="start_note" maxlength="60" required value="${esc(values.start_note ?? '')}"${invalid(errors, 'start_note')}>${fieldError(errors, 'start_note')}</div>
        </div>
        <div class="field-row">
          <div class="field"><label for="location">Meeting place *</label><input id="location" name="location" maxlength="120" required value="${esc(values.location ?? '')}"${invalid(errors, 'location')}>${fieldError(errors, 'location')}</div>
          <div class="field"><label for="capacity">Places *</label><input id="capacity" name="capacity" type="number" min="1" max="100" step="1" required value="${esc(values.capacity ?? '')}"${invalid(errors, 'capacity')}><span class="hint">A whole number from 1 to 100.</span>${fieldError(errors, 'capacity')}</div>
        </div>
        <div class="field"><label for="publication">Publication</label><select id="publication" name="publication"><option value="Draft"${values.publication === 'Draft' ? ' selected' : ''}>Draft — private</option><option value="Published"${values.publication === 'Published' ? ' selected' : ''}>Published — visitors can sign up</option></select></div>
        <div class="actions"><button class="button" type="submit">${editing ? 'Save volunteer role' : 'Create volunteer role'}</button><a class="button secondary" href="/admin#volunteers">Cancel</a></div>
      </form>
    </section>
    ${editing ? `<section class="admin-section admin-followup" aria-labelledby="signups-heading">
      <h2 id="signups-heading">Confirmed sign-ups</h2>
      <p>${esc(String(role!.taken ?? 0))} of ${esc(String(role!.capacity))} places are taken. These records are private.</p>
      ${options.signups?.length ? `<table class="admin-table"><thead><tr><th>Name</th><th>Contact</th><th>Notes</th><th>Signed up</th></tr></thead><tbody>${options.signups.map((signup) => `<tr><td>${esc(signup.name)}</td><td>${esc(signup.email)}${signup.phone ? `<br>${esc(signup.phone)}` : ''}</td><td>${signup.notes ? esc(signup.notes) : '—'}</td><td>${esc(timestampLabel(signup.created_at))}</td></tr>`).join('')}</tbody></table>` : `<p class="admin-empty">No confirmed sign-ups yet. A public sign-up appears here with the place already counted.</p>`}
    </section>` : ''}
  </div>`;
  return adminShell({ title: editing ? 'Edit volunteer role' : 'Create a volunteer role', body, origin: options.origin, active: 'volunteers' });
}
