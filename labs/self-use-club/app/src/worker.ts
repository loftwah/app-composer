import { clearedCookie, constantTimeEqual, isAuthorised, sameOrigin, sessionCookie } from './auth.ts';
import {
  adminCounts, createEnquiry, createEvent, createNotice, createVolunteerRole, createVolunteerSignup, getNoticeById,
  getPublicVolunteerRole, getPublishedEvent, getVolunteerRoleById, listAllEvents, listAllNotices, listAllVolunteerRoles,
  listEnquiries, listPublicEvents, listPublicNotices, listPublicVolunteerRoles, listSignupsForRole, reviewEnquiry,
  setEventPublication, setNoticePublication, setVolunteerRolePublication, updateEvent, updateNotice, updateVolunteerRole,
} from './db.ts';
import { dashboardPage, eventFormPage, loginPage, noticeFormPage, volunteerFormPage } from './admin-view.ts';
import { eventDetailPage, eventsPage, joinPage, joinThanksPage, notFoundPage, noticesPage, publicHome, serverErrorPage, signInRequiredPage, volunteerPage, volunteerRolePage, volunteerThanksPage } from './render.ts';
import { styles } from './styles.ts';
import { todayInMelbourne } from './time.ts';
import { hasErrors, normaliseEnquiry, normaliseEvent, normaliseNotice, normaliseVolunteerRole, normaliseVolunteerSignup, validateEnquiry, validateEvent, validateNotice, validateVolunteerRole, validateVolunteerSignup } from './validate.ts';
import type { Env } from './env.ts';

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38"><rect width="38" height="38" rx="8" fill="#17463f"/><path d="M8 24c4-3 7 3 11 0s7 3 11 0M8 29c4-3 7 3 11 0s7 3 11 0" fill="none" stroke="#f6f2e8" stroke-width="2" stroke-linecap="round"/><path d="M13 22 25 11" stroke="#f6f2e8" stroke-width="2" stroke-linecap="round"/><ellipse cx="26" cy="10" rx="3" ry="4.5" transform="rotate(38 26 10)" fill="#ff9a62"/></svg>`;

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function html(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders, ...extra },
  });
}

function redirect(location: string, extra: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function readForm(request: Request): Promise<URLSearchParams | null> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.startsWith('application/x-www-form-urlencoded')) return null;
  const body = await request.text();
  if (body.length > 16_384) return null;
  return new URLSearchParams(body);
}

function valuesOf(form: URLSearchParams): Record<string, string> {
  return Object.fromEntries(form.entries());
}

function originOf(env: Env, url: URL): string {
  return env.PUBLIC_ORIGIN || url.origin;
}

async function adminGate(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (await isAuthorised(request, env)) return null;
  if (request.method === 'GET') {
    const next = url.pathname + url.search;
    return redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }
  return html(signInRequiredPage(originOf(env, url)), 401);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const today = todayInMelbourne();
  const origin = originOf(env, url);

  if (path === '/styles.css' && request.method === 'GET') {
    return new Response(styles, { headers: { 'Content-Type': 'text/css;charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  }
  if (path === '/favicon.svg' && request.method === 'GET') {
    return new Response(favicon, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' } });
  }
  if (path === '/robots.txt' && request.method === 'GET') {
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  }
  if (path === '/healthz' && request.method === 'GET') {
    return Response.json({ ok: true, app: 'riverton-rowing-club' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'POST' && !sameOrigin(request)) return textResponse('Cross-origin form submission refused.', 403);

  if (request.method === 'GET' && path === '/') {
    const [events, notices, volunteerRoles] = await Promise.all([
      listPublicEvents(env.DB, today, 5), listPublicNotices(env.DB, 3), listPublicVolunteerRoles(env.DB, today),
    ]);
    return html(publicHome({ events, notices, volunteerRoles, today, origin }));
  }
  if (request.method === 'GET' && path === '/events') {
    return html(eventsPage(await listPublicEvents(env.DB, today), origin));
  }
  const eventDetail = path.match(/^\/events\/([^/]+)$/);
  if (request.method === 'GET' && eventDetail) {
    const event = await getPublishedEvent(env.DB, decodeURIComponent(eventDetail[1]));
    return event ? html(eventDetailPage(event, origin)) : html(notFoundPage(origin), 404);
  }
  if (request.method === 'GET' && path === '/notices') {
    return html(noticesPage(await listPublicNotices(env.DB, 50), origin));
  }
  if (request.method === 'GET' && path === '/join') {
    return html(joinPage({ origin, about: url.searchParams.get('about') ?? undefined }));
  }
  if (request.method === 'POST' && path === '/join') {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseEnquiry(valuesOf(form));
    const errors = validateEnquiry(values);
    if (hasErrors(errors)) return html(joinPage({ values, errors, origin }), 422);
    const id = await createEnquiry(env.DB, values);
    return redirect(`/join/thanks?ref=${encodeURIComponent(id)}`);
  }
  if (request.method === 'GET' && path === '/join/thanks') {
    const id = url.searchParams.get('ref') ?? '';
    return html(joinThanksPage(id || crypto.randomUUID(), origin));
  }

  if (request.method === 'GET' && path === '/volunteer') {
    return html(volunteerPage(await listPublicVolunteerRoles(env.DB, today), origin));
  }
  const volunteerThanks = path.match(/^\/volunteer\/([^/]+)\/thanks$/);
  if (request.method === 'GET' && volunteerThanks) {
    const role = await getVolunteerRoleById(env.DB, decodeURIComponent(volunteerThanks[1]));
    if (!role || role.publication !== 'Published') return html(notFoundPage(origin), 404);
    return html(volunteerThanksPage(role, url.searchParams.get('ref') ?? crypto.randomUUID(), origin));
  }
  const volunteerSignup = path.match(/^\/volunteer\/([^/]+)\/signup$/);
  if (request.method === 'POST' && volunteerSignup) {
    const role = await getPublicVolunteerRole(env.DB, decodeURIComponent(volunteerSignup[1]));
    if (!role) return html(notFoundPage(origin), 404);
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseVolunteerSignup(valuesOf(form));
    const errors = validateVolunteerSignup(values);
    if (hasErrors(errors)) {
      const current = await getPublicVolunteerRole(env.DB, role.id);
      if (!current) return html(notFoundPage(origin), 404);
      if ((current.remaining ?? 0) <= 0) return html(volunteerRolePage({ role: current, full: true, origin }), 409);
      return html(volunteerRolePage({ role: current, values, errors, origin }), 422);
    }
    const id = crypto.randomUUID();
    const created = await createVolunteerSignup(env.DB, role.id, values);
    if (!created) {
      const current = await getPublicVolunteerRole(env.DB, role.id);
      return html(volunteerRolePage({ role: current ?? role, full: true, origin }), 409);
    }
    return redirect(`/volunteer/${encodeURIComponent(role.id)}/thanks?ref=${encodeURIComponent(id)}`);
  }
  const volunteerRole = path.match(/^\/volunteer\/([^/]+)$/);
  if (request.method === 'GET' && volunteerRole) {
    const role = await getPublicVolunteerRole(env.DB, decodeURIComponent(volunteerRole[1]));
    if (!role) return html(notFoundPage(origin), 404);
    return html(volunteerRolePage({ role, origin }));
  }

  if (path === '/admin/login') {
    if (request.method === 'GET') {
      const next = url.searchParams.get('next') ?? '/admin';
      return html(loginPage({ origin, next, configured: Boolean(env.ADMIN_TOKEN) }));
    }
    if (request.method === 'POST') {
      if (!env.ADMIN_TOKEN) return html(loginPage({ origin, configured: false }), 503);
      const form = await readForm(request);
      if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
      const token = form.get('token') ?? '';
      const next = form.get('next') ?? '/admin';
      if (!(await constantTimeEqual(token, env.ADMIN_TOKEN))) {
        return html(loginPage({ origin, next, error: 'That owner secret was not accepted.', configured: true }), 401);
      }
      return redirect(next.startsWith('/admin') ? next : '/admin', { 'Set-Cookie': await sessionCookie(request, env) });
    }
  }
  if (path === '/admin/logout' && request.method === 'POST') {
    return redirect('/admin/login', { 'Set-Cookie': clearedCookie(request) });
  }

  if (path.startsWith('/admin')) {
    const denied = await adminGate(request, env, url);
    if (denied) return denied;
  }

  if (request.method === 'GET' && path === '/admin') {
    const [counts, enquiries, events, notices, volunteerRoles] = await Promise.all([
      adminCounts(env.DB), listEnquiries(env.DB), listAllEvents(env.DB), listAllNotices(env.DB), listAllVolunteerRoles(env.DB),
    ]);
    return html(dashboardPage({ counts, enquiries, events, notices, volunteerRoles, flash: url.searchParams.get('saved') ?? undefined, origin }));
  }
  if (request.method === 'GET' && path === '/admin/events/new') {
    return html(eventFormPage({ today, origin }));
  }
  if (request.method === 'POST' && path === '/admin/events') {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseEvent(valuesOf(form));
    const errors = validateEvent(values);
    if (hasErrors(errors)) return html(eventFormPage({ values, errors, today, origin }), 422);
    await createEvent(env.DB, values);
    return redirect(values.publication === 'Published' ? '/admin?saved=published#events' : '/admin?saved=created#events');
  }
  const eventEdit = path.match(/^\/admin\/events\/([^/]+)\/edit$/);
  if (request.method === 'GET' && eventEdit) {
    const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(decodeURIComponent(eventEdit[1])).first<import('./env.ts').EventRow>();
    if (!event) return html(notFoundPage(origin), 404);
    return html(eventFormPage({ event, today, origin }));
  }
  const eventUpdate = path.match(/^\/admin\/events\/([^/]+)$/);
  if (request.method === 'POST' && eventUpdate) {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseEvent(valuesOf(form));
    const errors = validateEvent(values);
    const id = decodeURIComponent(eventUpdate[1]);
    if (hasErrors(errors)) {
      const existing = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<import('./env.ts').EventRow>();
      if (!existing) return html(notFoundPage(origin), 404);
      return html(eventFormPage({ event: existing, values, errors, today, origin }), 422);
    }
    if (!(await updateEvent(env.DB, id, values))) return html(notFoundPage(origin), 404);
    return redirect('/admin?saved=updated#events');
  }
  const eventPublication = path.match(/^\/admin\/events\/([^/]+)\/(publish|unpublish)$/);
  if (request.method === 'POST' && eventPublication) {
    const publication = eventPublication[2] === 'publish' ? 'Published' : 'Draft';
    if (!(await setEventPublication(env.DB, decodeURIComponent(eventPublication[1]), publication))) return html(notFoundPage(origin), 404);
    return redirect(`/admin?saved=${publication === 'Published' ? 'published' : 'unpublished'}#events`);
  }

  if (request.method === 'GET' && path === '/admin/notices/new') {
    return html(noticeFormPage({ today, origin }));
  }
  if (request.method === 'POST' && path === '/admin/notices') {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseNotice(valuesOf(form));
    const errors = validateNotice(values);
    if (hasErrors(errors)) return html(noticeFormPage({ values, errors, today, origin }), 422);
    await createNotice(env.DB, values);
    return redirect(values.publication === 'Published' ? '/admin?saved=published#notices' : '/admin?saved=notice_created#notices');
  }
  const noticeEdit = path.match(/^\/admin\/notices\/([^/]+)\/edit$/);
  if (request.method === 'GET' && noticeEdit) {
    const notice = await getNoticeById(env.DB, decodeURIComponent(noticeEdit[1]));
    if (!notice) return html(notFoundPage(origin), 404);
    return html(noticeFormPage({ notice, today, origin }));
  }
  const noticeUpdate = path.match(/^\/admin\/notices\/([^/]+)$/);
  if (request.method === 'POST' && noticeUpdate) {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseNotice(valuesOf(form));
    const errors = validateNotice(values);
    const id = decodeURIComponent(noticeUpdate[1]);
    if (hasErrors(errors)) {
      const existing = await getNoticeById(env.DB, id);
      if (!existing) return html(notFoundPage(origin), 404);
      return html(noticeFormPage({ notice: existing, values, errors, today, origin }), 422);
    }
    if (!(await updateNotice(env.DB, id, values))) return html(notFoundPage(origin), 404);
    return redirect('/admin?saved=notice_updated#notices');
  }
  const noticePublication = path.match(/^\/admin\/notices\/([^/]+)\/(publish|unpublish)$/);
  if (request.method === 'POST' && noticePublication) {
    const publication = noticePublication[2] === 'publish' ? 'Published' : 'Draft';
    if (!(await setNoticePublication(env.DB, decodeURIComponent(noticePublication[1]), publication))) return html(notFoundPage(origin), 404);
    return redirect(`/admin?saved=${publication === 'Published' ? 'published' : 'unpublished'}#notices`);
  }

  if (request.method === 'GET' && path === '/admin/volunteers/new') {
    return html(volunteerFormPage({ today, origin }));
  }
  if (request.method === 'POST' && path === '/admin/volunteers') {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseVolunteerRole(valuesOf(form));
    const errors = validateVolunteerRole(values);
    if (hasErrors(errors)) return html(volunteerFormPage({ values, errors, today, origin }), 422);
    await createVolunteerRole(env.DB, values);
    return redirect(values.publication === 'Published' ? '/admin?saved=published#volunteers' : '/admin?saved=created#volunteers');
  }
  const volunteerEdit = path.match(/^\/admin\/volunteers\/([^/]+)\/edit$/);
  if (request.method === 'GET' && volunteerEdit) {
    const role = await getVolunteerRoleById(env.DB, decodeURIComponent(volunteerEdit[1]));
    if (!role) return html(notFoundPage(origin), 404);
    const signups = await listSignupsForRole(env.DB, role.id);
    return html(volunteerFormPage({ role, signups, today, origin }));
  }
  const volunteerUpdate = path.match(/^\/admin\/volunteers\/([^/]+)$/);
  if (request.method === 'POST' && volunteerUpdate) {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    const values = normaliseVolunteerRole(valuesOf(form));
    const errors = validateVolunteerRole(values);
    const id = decodeURIComponent(volunteerUpdate[1]);
    if (hasErrors(errors)) {
      const existing = await getVolunteerRoleById(env.DB, id);
      if (!existing) return html(notFoundPage(origin), 404);
      const signups = await listSignupsForRole(env.DB, id);
      return html(volunteerFormPage({ role: existing, values, errors, signups, today, origin }), 422);
    }
    if (!(await updateVolunteerRole(env.DB, id, values))) return html(notFoundPage(origin), 404);
    return redirect('/admin?saved=updated#volunteers');
  }
  const volunteerPublication = path.match(/^\/admin\/volunteers\/([^/]+)\/(publish|unpublish)$/);
  if (request.method === 'POST' && volunteerPublication) {
    const publication = volunteerPublication[2] === 'publish' ? 'Published' : 'Draft';
    if (!(await setVolunteerRolePublication(env.DB, decodeURIComponent(volunteerPublication[1]), publication))) return html(notFoundPage(origin), 404);
    return redirect(`/admin?saved=${publication === 'Published' ? 'published' : 'unpublished'}#volunteers`);
  }

  const review = path.match(/^\/admin\/enquiries\/([^/]+)\/review$/);
  if (request.method === 'POST' && review) {
    const form = await readForm(request);
    if (!form) return textResponse('Send this form as application/x-www-form-urlencoded.', 415);
    if (!(await reviewEnquiry(env.DB, decodeURIComponent(review[1]), form.get('note') ?? ''))) return html(notFoundPage(origin), 404);
    return redirect('/admin?saved=reviewed#enquiries');
  }

  return html(notFoundPage(origin), 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error('Riverton Rowing Club request failed', error instanceof Error ? error.message : String(error));
      return html(serverErrorPage(env.PUBLIC_ORIGIN || new URL(request.url).origin), 500);
    }
  },
} satisfies ExportedHandler<Env>;
