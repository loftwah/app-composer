import type { EnquiryRow, EventRow, NoticeRow, VolunteerRoleRow } from './env.ts';
import { dayMonth, eventDateLabel, eventDateShort, timestampLabel } from './time.ts';
import { enquiryTypes, shortReference, type Errors, type Values } from './validate.ts';

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] as string));
}

function trim(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;
}

const riverScene = `<svg class="river-scene" viewBox="0 0 220 180" role="img" aria-label="An original drawing of an oar resting across three lines of river water.">
  <path class="river-line thin" d="M18 46c28-10 58 10 92 0s64-10 92 0"/>
  <path class="river-line thin" d="M18 74c28-10 58 10 92 0s64-10 92 0"/>
  <path class="river-line" d="M18 112c28-10 58 10 92 0s64-10 92 0"/>
  <path class="river-line" d="M18 144c28-10 58 10 92 0s64-10 92 0"/>
  <g transform="rotate(-20 110 90)">
    <rect class="oar" x="104" y="14" width="11" height="126" rx="5.5"/>
    <ellipse class="oar-blade" cx="109.5" cy="148" rx="17" ry="26"/>
  </g>
</svg>`;

export function layout(options: {
  title: string;
  description: string;
  body: string;
  active?: string;
  origin?: string;
  includeVolunteer?: boolean;
}): string {
  const nav = [
    ['/events', 'Events', 'events'],
    ['/notices', 'Notices', 'notices'],
    ['/join', 'Join us', 'join'],
    ['/volunteer', 'Volunteer', 'volunteer'],
  ] as const;
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(options.title)} · Riverton Rowing Club</title>
<meta name="description" content="${esc(options.description)}">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="shell">
    <a class="wordmark" href="/" aria-label="Riverton Rowing Club home">
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 22c4-3 7 3 11 0s7 3 11 0M8 27c4-3 7 3 11 0s7 3 11 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M13 21 25 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="26" cy="9" rx="3" ry="4.5" transform="rotate(38 26 9)" fill="currentColor"/>
      </svg>
      <span><strong>Riverton Rowing Club</strong><small>On the river since 1974</small></span>
    </a>
    <nav class="site-nav" aria-label="Club">
      ${nav.map(([href, label, key]) => `<a href="${href}"${options.active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
  </div>
</header>
<main id="main">
${options.body}
</main>
<footer class="site-footer">
  <div class="shell">
    <p>Riverton Rowing Club is a fictional club in a fictional town. This local demonstration was built from an App Composer exported specification; no real club, person, payment or email is involved.</p>
    <p><a href="https://github.com/loftwah/app-composer">Built with App Composer</a> · Local demonstration only · Australia/Melbourne</p>
  </div>
</footer>
</body>
</html>`;
}

function eventMeta(event: EventRow): string {
  return `<p class="meta"><span>${esc(event.start_note)}</span><span>${esc(event.location)}</span></p>`;
}

function eventCard(event: EventRow): string {
  const date = dayMonth(event.event_date);
  return `<article class="event-card">
    <div class="date-tile" aria-hidden="true"><b>${esc(date.day)}</b><span>${esc(date.month)}</span></div>
    <div>
      <h3><a href="/events/${encodeURIComponent(event.slug)}">${esc(event.title)}</a></h3>
      <p>${esc(event.summary)}</p>
      ${eventMeta(event)}
      <p class="meta top"><span>${esc(eventDateLabel(event.event_date))} · ${esc(date.short)}</span></p>
    </div>
  </article>`;
}

function noticesList(notices: NoticeRow[], full = false): string {
  return `<ul class="notice-list">${notices.map((notice) => `<li>
    <h3>${esc(notice.title)}</h3>
    <p>${esc(full ? notice.body : trim(notice.body, 220))}</p>
    <time datetime="${esc(notice.notice_date)}">${esc(eventDateShort(notice.notice_date))} · Australia/Melbourne</time>
  </li>`).join('')}</ul>`;
}

export function publicHome(options: {
  events: EventRow[];
  notices: NoticeRow[];
  today: string;
  origin: string;
  includeVolunteer?: boolean;
  volunteerRoles?: VolunteerRoleRow[];
}): string {
  const next = options.events[0];
  const rest = options.events.slice(1, 4);
  const latest = options.notices[0];
  const body = `
<div class="shell">
  <section class="hero" aria-labelledby="hero-title">
    <div>
      <p class="eyebrow">Riverton · Saturday mornings on the water</p>
      <h1 id="hero-title">Come down to the river.</h1>
      <p class="lede">We row, coach and eat breakfast together. Beginners are welcome, and you do not need your own boat, gear or experience to start.</p>
      <div class="actions">
        <a class="button" href="/join">Join the club</a>
        <a class="button secondary" href="/events">See what’s on</a>
      </div>
    </div>
    <figure class="hero-art">
      ${riverScene}
      <figcaption>Original river mark for a fictional club.</figcaption>
    </figure>
  </section>
</div>
${latest ? `<div class="notice-strip"><div class="shell"><strong>Latest notice</strong><p><a href="/notices">${esc(latest.title)}</a> — ${esc(trim(latest.body, 180))}</p></div></div>` : ''}
<section class="section" aria-labelledby="next-heading">
  <div class="shell">
    <div class="section-head"><div><h2 id="next-heading">The next thing</h2><p>Come along to watch, help or have a go. Times are club time, Australia/Melbourne.</p></div></div>
    ${next ? `<article class="next-event">
      <div class="next-event-head">
        <div class="date-tile" aria-hidden="true"><b>${esc(dayMonth(next.event_date).day)}</b><span>${esc(dayMonth(next.event_date).month)}</span></div>
        <div><p class="label tight">Next on the river</p><h2>${esc(next.title)}</h2></div>
      </div>
      <p>${esc(next.summary)}</p>
      <div class="meta"><span><strong>${esc(eventDateLabel(next.event_date))}</strong> · ${esc(eventDateShort(next.event_date))}</span><span>${esc(next.start_note)}</span><span>${esc(next.location)}</span></div>
      <a class="button small" href="/events/${encodeURIComponent(next.slug)}">Event details</a>
    </article>` : `<div class="empty"><strong>No public events yet.</strong> The committee is planning the next gathering. <a href="/join">Send a joining enquiry</a> and we will tell you when dates are confirmed.</div>`}
  </div>
</section>
<section class="section" aria-labelledby="coming-heading">
  <div class="shell">
    <div class="section-head"><div><h2 id="coming-heading">Also coming up</h2><p>Small gatherings, working bees and open days.</p></div><a href="/events">All events</a></div>
    ${rest.length ? `<div class="event-grid">${rest.map(eventCard).join('')}</div>` : `<div class="empty"><strong>The calendar is quiet.</strong> More dates will be posted here once the committee confirms them.</div>`}
  </div>
</section>
<section class="section" aria-labelledby="notices-heading">
  <div class="shell split">
    <div>
      <div class="section-head"><div><h2 id="notices-heading">Club notices</h2><p>Short updates from the shed.</p></div><a href="/notices">All notices</a></div>
      ${options.notices.length ? noticesList(options.notices.slice(0, 2)) : `<div class="empty"><strong>No notices right now.</strong> New updates appear here when the owner publishes them.</div>`}
    </div>
    <aside class="join-panel" aria-labelledby="join-panel-heading">
      <h2 id="join-panel-heading">Thinking about joining?</h2>
      <p>Tell us a little about yourself and what you would like to try. A volunteer reads every enquiry. Nothing is shared publicly.</p>
      <a class="button" href="/join">Send an enquiry</a>
      <p class="form-note">No payment is taken here. The first two rows are free.</p>
    </aside>
  </div>
</section>
${volunteerSection(options.volunteerRoles ?? [])}
`;
  return layout({
    title: 'Community rowing on the Riverton River',
    description: 'A fictional community rowing club: upcoming events, notices and a joining enquiry form.',
    body,
    active: 'home',
    origin: options.origin,
    includeVolunteer: options.includeVolunteer,
  });
}


export function volunteerCard(role: VolunteerRoleRow): string {
  const remaining = role.remaining ?? role.capacity;
  const places = remaining > 0
    ? `${remaining} of ${role.capacity} ${role.capacity === 1 ? 'place' : 'places'} left`
    : 'Crew full';
  return `<article class="volunteer-card">
    <div>
      <h3><a href="/volunteer/${encodeURIComponent(role.id)}">${esc(role.title)}</a></h3>
      <p>${esc(eventDateLabel(role.event_date))} · ${esc(eventDateShort(role.event_date))} · ${esc(role.start_note)} · ${esc(role.location)}</p>
      <p class="role-summary">${esc(role.description.split('\n')[0])}</p>
    </div>
    <p class="places${remaining > 0 ? '' : ' full'}">${esc(places)}</p>
  </article>`;
}

export function volunteerSection(roles: VolunteerRoleRow[]): string {
  return `<section class="section" aria-labelledby="volunteer-heading">
    <div class="shell">
      <div class="section-head"><div><h2 id="volunteer-heading">Lend a hand</h2><p>Small jobs that keep the club on the water. Numbers are limited so nobody stands around wondering what to do.</p></div><a href="/volunteer">All volunteer roles</a></div>
      ${roles.length ? `<div class="volunteer-list">${roles.slice(0, 3).map(volunteerCard).join('')}</div>` : `<div class="empty"><strong>No volunteer roles are open.</strong> The owner publishes roles here when a working bee or event needs help.</div>`}
    </div>
  </section>`;
}

export function volunteerPage(roles: VolunteerRoleRow[], origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">Volunteer</p><h1>Help at the shed.</h1><p class="lede">Every role has a real capacity. The number of places left is calculated from confirmed sign-ups, not a static label.</p></header>
    <section class="section" aria-label="Open volunteer roles">
      ${roles.length ? `<div class="volunteer-list">${roles.map(volunteerCard).join('')}</div>` : `<div class="empty"><strong>No volunteer roles are open.</strong> The owner publishes roles here when help is needed.</div>`}
    </section>
  </div>`;
  return layout({ title: 'Volunteer', description: 'Volunteer roles and remaining places at the fictional Riverton Rowing Club.', body, active: 'volunteer', origin, includeVolunteer });
}

export function volunteerRolePage(options: {
  role: VolunteerRoleRow;
  values?: Values;
  errors?: Errors;
  full?: boolean;
  origin: string;
  includeVolunteer?: boolean;
}): string {
  const role = options.role;
  const values = options.values ?? {};
  const errors = options.errors ?? {};
  const remaining = role.remaining ?? role.capacity;
  const full = options.full || remaining <= 0;
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">Volunteer · ${esc(eventDateShort(role.event_date))}</p><h1>${esc(role.title)}</h1><p class="lede">${esc(role.description.split('\n')[0])}</p></header>
    <div class="detail-grid">
      <section class="form-card" aria-labelledby="signup-heading">
        <h2 id="signup-heading">${full ? 'This crew is full' : 'Put your name down'}</h2>
        ${full ? `<p>All ${esc(role.capacity)} places are filled. Nothing was submitted. Please choose another role or send a joining enquiry.</p><div class="actions"><a class="button secondary" href="/volunteer">Other roles</a><a class="button secondary" href="/join">Join the club</a></div>` : `<p>${esc(String(remaining))} of ${esc(String(role.capacity))} ${role.capacity === 1 ? 'place is' : 'places are'} still open. The limit is checked again on the server when you submit.</p>
          ${Object.keys(errors).length ? `<div class="form-errors" role="alert"><h2>Please check these details</h2><ul>${Object.entries(errors).map(([key, message]) => `<li><a href="#${esc(key)}">${esc(message)}</a></li>`).join('')}</ul></div>` : ''}
          <form method="post" action="/volunteer/${encodeURIComponent(role.id)}/signup">
            <div class="field"><label for="name">Your name *</label><input id="name" name="name" autocomplete="name" maxlength="80" required value="${esc(values.name ?? '')}"${invalid(errors, 'name')}>${fieldError(errors, 'name')}</div>
            <div class="field-row">
              <div class="field"><label for="email">Email *</label><input id="email" name="email" type="email" autocomplete="email" maxlength="120" required value="${esc(values.email ?? '')}"${invalid(errors, 'email')}>${fieldError(errors, 'email')}</div>
              <div class="field"><label for="phone">Phone <span class="hint">Optional</span></label><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(values.phone ?? '')}"${invalid(errors, 'phone')}>${fieldError(errors, 'phone')}</div>
            </div>
            <div class="field"><label for="notes">Anything useful? <span class="hint">Optional</span></label><textarea id="notes" name="notes" maxlength="500">${esc(values.notes ?? '')}</textarea></div>
            <button class="button" type="submit">Sign up for this role</button>
            <p class="form-note">This local demonstration stores the sign-up in the club database and sends no email. The owner sees it in the volunteer list.</p>
          </form>`}
      </section>
      <aside class="detail-facts" aria-label="Role details">
        <dl>
          <div><dt>Date</dt><dd>${esc(eventDateLabel(role.event_date))}<br>${esc(eventDateShort(role.event_date))}</dd></div>
          <div><dt>Start</dt><dd>${esc(role.start_note)}</dd></div>
          <div><dt>Meeting place</dt><dd>${esc(role.location)}</dd></div>
          <div><dt>Places</dt><dd>${esc(String(remaining))} left of ${esc(String(role.capacity))}</dd></div>
          <div><dt>Time zone</dt><dd>Australia/Melbourne calendar date</dd></div>
        </dl>
      </aside>
    </div>
  </div>`;
  return layout({ title: role.title, description: role.description, body, active: 'volunteer', origin: options.origin, includeVolunteer: options.includeVolunteer });
}

export function volunteerThanksPage(role: VolunteerRoleRow, id: string, origin: string, includeVolunteer?: boolean): string {
  const remaining = role.remaining ?? role.capacity;
  const body = `<div class="shell"><section class="success-panel success-page" aria-labelledby="thanks-heading">
    <p class="eyebrow">Sign-up saved</p>
    <h1 id="thanks-heading">You are on the list for ${esc(role.title)}.</h1>
    <p>The place is now counted against the crew’s capacity: <strong>${esc(String(remaining))} of ${esc(String(role.capacity))}</strong> places remain. The owner sees your name in the private volunteer list.</p>
    <p>Your reference</p>
    <p class="reference">${esc(shortReference(id))}</p>
    <p class="form-note">No email was sent. This is a local demonstration; it takes no payment and makes no calendar invitation.</p>
    <div class="actions"><a class="button" href="/volunteer">Other roles</a><a class="button secondary" href="/">Back to the club</a></div>
  </section></div>`;
  return layout({ title: 'Volunteer sign-up saved', description: 'Your fictional volunteer sign-up was saved.', body, active: 'volunteer', origin, includeVolunteer });
}

export function eventsPage(events: EventRow[], origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">What’s on</p><h1>Dates for the diary.</h1><p class="lede">Every published event is listed here. Draft events stay private until the owner publishes them. Dates are club calendar days in Australia/Melbourne.</p></header>
    <section class="section" aria-label="Upcoming events">
      ${events.length ? `<div class="event-grid">${events.map(eventCard).join('')}</div>` : `<div class="empty"><strong>No published events yet.</strong> Join the club to hear when the next row is confirmed.</div>`}
    </section>
  </div>`;
  return layout({ title: 'Events', description: 'Upcoming Riverton Rowing Club events.', body, active: 'events', origin, includeVolunteer });
}

export function eventDetailPage(event: EventRow, origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">${esc(eventDateShort(event.event_date))} · ${esc(eventDateLabel(event.event_date))}</p><h1>${esc(event.title)}</h1><p class="lede">${esc(event.summary)}</p></header>
    <div class="detail-grid">
      <div class="prose"><p>${esc(event.description).replaceAll('\n', '<br>')}</p>
        <h2>Come along</h2>
        <p>You do not need to book for this one unless the event says otherwise. Bring a water bottle, a hat and shoes you can slip off. The shed has changing rooms.</p>
        <p><a class="button" href="/join?about=An%20event">Ask about this event</a></p>
      </div>
      <aside class="detail-facts" aria-label="Event details">
        <dl>
          <div><dt>Date</dt><dd>${esc(eventDateLabel(event.event_date))}<br>${esc(eventDateShort(event.event_date))}</dd></div>
          <div><dt>Start</dt><dd>${esc(event.start_note)}</dd></div>
          <div><dt>Meeting place</dt><dd>${esc(event.location)}</dd></div>
          <div><dt>Cost</dt><dd>${event.cost ? esc(event.cost) : 'No charge'}</dd></div>
          <div><dt>Time zone</dt><dd>Australia/Melbourne calendar date</dd></div>
        </dl>
      </aside>
    </div>
  </div>`;
  return layout({ title: event.title, description: event.summary, body, active: 'events', origin, includeVolunteer });
}

function fieldError(errors: Errors, key: string): string {
  return errors[key] ? `<p class="error-text" id="${key}-error">${esc(errors[key])}</p>` : '';
}

function invalid(errors: Errors, key: string): string {
  return errors[key] ? ' aria-invalid="true" aria-describedby="' + key + '-error"' : '';
}

export function joinPage(options: {
  values?: Values;
  errors?: Errors;
  about?: string;
  origin: string;
  includeVolunteer?: boolean;
}): string {
  const values = options.values ?? { enquiry_type: options.about && enquiryTypes.includes(options.about as typeof enquiryTypes[number]) ? options.about : 'Joining the club' };
  const errors = options.errors ?? {};
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">Joining enquiries</p><h1>Start with a hello.</h1><p class="lede">Tell us what you would like to try. A club volunteer reads each enquiry and replies by email. Your details are never shown on this site.</p></header>
    <div class="detail-grid">
      <section class="form-card" aria-labelledby="join-form-heading">
        <h2 id="join-form-heading">Send a joining enquiry</h2>
        <p>Fields marked with an asterisk are required. This local demonstration does not send email; the enquiry is saved in the club’s own database for the owner to review.</p>
        ${Object.keys(errors).length ? `<div class="form-errors" role="alert"><h2>Please check these details</h2><ul>${Object.entries(errors).map(([key, message]) => `<li><a href="#${esc(key)}">${esc(message)}</a></li>`).join('')}</ul></div>` : ''}
        <form method="post" action="/join">
          <div class="field">
            <label for="name">Your name *</label>
            <input id="name" name="name" autocomplete="name" maxlength="80" required value="${esc(values.name ?? '')}"${invalid(errors, 'name')}>
            ${fieldError(errors, 'name')}
          </div>
          <div class="field-row">
            <div class="field">
              <label for="email">Email *</label>
              <input id="email" name="email" type="email" autocomplete="email" maxlength="120" required value="${esc(values.email ?? '')}"${invalid(errors, 'email')}>
              ${fieldError(errors, 'email')}
            </div>
            <div class="field">
              <label for="phone">Phone <span class="hint">Optional</span></label>
              <input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(values.phone ?? '')}"${invalid(errors, 'phone')}>
              ${fieldError(errors, 'phone')}
            </div>
          </div>
          <div class="field">
            <label for="enquiry_type">What is this about? *</label>
            <select id="enquiry_type" name="enquiry_type" required${invalid(errors, 'enquiry_type')}>
              ${enquiryTypes.map((type) => `<option value="${esc(type)}"${values.enquiry_type === type ? ' selected' : ''}>${esc(type)}</option>`).join('')}
            </select>
            ${fieldError(errors, 'enquiry_type')}
          </div>
          <div class="field">
            <label for="message">Your message *</label>
            <textarea id="message" name="message" maxlength="1000" required placeholder="What would you like to try? Any questions about times, costs or access?"${invalid(errors, 'message')}>${esc(values.message ?? '')}</textarea>
            ${fieldError(errors, 'message')}
          </div>
          <button class="button" type="submit">Send enquiry</button>
          <p class="form-note">We keep your name, contact details and message in the club’s private inbox. There is no public profile and no mailing list sign-up on this form.</p>
        </form>
      </section>
      <aside class="detail-facts" aria-label="What happens next">
        <dl>
          <div><dt>1. Send</dt><dd>Your enquiry goes into the club’s private queue with a pending state.</dd></div>
          <div><dt>2. Review</dt><dd>A volunteer reads it and marks it reviewed. That is an owner decision, not an automated reply.</dd></div>
          <div><dt>3. Reply</dt><dd>Outside this demonstration, the club replies using the contact details you provide.</dd></div>
          <div><dt>Privacy</dt><dd>Enquiries are not published, exported to a third party or shown to other visitors.</dd></div>
        </dl>
      </aside>
    </div>
  </div>`;
  return layout({ title: 'Join the club', description: 'Send a joining enquiry to the fictional Riverton Rowing Club.', body, active: 'join', origin: options.origin, includeVolunteer: options.includeVolunteer });
}

export function joinThanksPage(id: string, origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell"><section class="success-panel" aria-labelledby="thanks-heading">
    <p class="eyebrow">Enquiry saved</p>
    <h1 id="thanks-heading">Thanks — your enquiry is with the club.</h1>
    <p>It is waiting in the owner’s private queue with a <strong>Pending</strong> state. The owner can review it but cannot reply from this local demonstration.</p>
    <p>Your reference</p>
    <p class="reference">${esc(shortReference(id))}</p>
    <p class="form-note">No email was sent. This local fixture stores the enquiry in its own D1 database. Keep the reference if you want the owner to find it.</p>
    <div class="actions"><a class="button" href="/">Back to the club</a><a class="button secondary" href="/events">See events</a></div>
  </section></div>`;
  return layout({ title: 'Enquiry received', description: 'Your fictional club enquiry was saved for owner review.', body, active: 'join', origin, includeVolunteer });
}

export function noticesPage(notices: NoticeRow[], origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell">
    <header class="page-head"><p class="eyebrow">From the shed</p><h1>Club notices.</h1><p class="lede">Published updates from the committee. Draft notices are only visible to the owner.</p></header>
    <section class="section">${notices.length ? noticesList(notices, true) : `<div class="empty"><strong>No notices right now.</strong> Published notices appear here; drafts stay in the owner area.</div>`}</section>
  </div>`;
  return layout({ title: 'Notices', description: 'Published notices from the fictional Riverton Rowing Club.', body, active: 'notices', origin, includeVolunteer });
}

export function notFoundPage(origin: string, includeVolunteer?: boolean): string {
  const body = `<div class="shell"><section class="success-panel success-page"><p class="eyebrow">404</p><h1>That page is not on the river.</h1><p>The address may be old, unpublished or typed slightly differently. Draft and missing pages look the same from outside.</p><div class="actions"><a class="button" href="/">Back to the club</a><a class="button secondary" href="/events">See events</a></div></section></div>`;
  return layout({ title: 'Page not found', description: 'This page does not exist.', body, origin, includeVolunteer });
}

export function serverErrorPage(origin: string): string {
  const body = `<div class="shell"><section class="success-panel success-page"><p class="eyebrow">Something went wrong</p><h1>The club could not load that.</h1><p>The request failed before it changed any data. Try again, or return to the club home page.</p><div class="actions"><a class="button" href="/">Back to the club</a></div></section></div>`;
  return layout({ title: 'Something went wrong', description: 'The request failed.', body, origin });
}

export function signInRequiredPage(origin: string): string {
  const body = `<div class="shell"><section class="success-panel success-page"><p class="eyebrow">Owner area</p><h1>Sign in first.</h1><p>That action needs the club owner’s local secret. Nothing was changed.</p><div class="actions"><a class="button" href="/admin/login">Owner sign-in</a><a class="button secondary" href="/">Back to the club</a></div></section></div>`;
  return layout({ title: 'Sign in required', description: 'Owner sign-in is required.', body, origin });
}

export function enquiryReceivedSummary(): string {
  return 'Pending owner review';
}

export type { EnquiryRow };
