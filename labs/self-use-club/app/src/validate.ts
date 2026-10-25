export type Values = Record<string, string>;
export type Errors = Record<string, string>;

export const enquiryTypes = ['Joining the club', 'An event', 'Volunteering', 'Something else'] as const;
export const publications = ['Draft', 'Published'] as const;

function text(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)
    : '';
}

export function normaliseEnquiry(input: Record<string, unknown>): Values {
  return {
    name: text(input.name, 80),
    email: text(input.email, 120).toLowerCase(),
    phone: text(input.phone, 40),
    enquiry_type: text(input.enquiry_type, 40),
    message: text(input.message, 1000),
  };
}

export function validateEnquiry(values: Values): Errors {
  const errors: Errors = {};
  if (values.name.length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.email = 'Enter an email address we can reply to.';
  if (values.phone.length > 40) errors.phone = 'Keep the phone number under 40 characters.';
  if (!enquiryTypes.includes(values.enquiry_type as (typeof enquiryTypes)[number])) errors.enquiry_type = 'Choose what your enquiry is about.';
  if (values.message.length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  return errors;
}

export function normaliseEvent(input: Record<string, unknown>): Values {
  const publication = text(input.publication, 20);
  return {
    title: text(input.title, 90),
    summary: text(input.summary, 200),
    description: text(input.description, 2000),
    event_date: text(input.event_date, 10),
    start_note: text(input.start_note, 60),
    location: text(input.location, 120),
    cost: text(input.cost, 120),
    publication: publications.includes(publication as (typeof publications)[number]) ? publication : 'Draft',
  };
}

export function validateEvent(values: Values): Errors {
  const errors: Errors = {};
  if (values.title.length < 3) errors.title = 'Give the event a name (at least 3 characters).';
  if (values.summary.length < 10) errors.summary = 'Write a one-line summary (at least 10 characters).';
  if (values.description.length < 20) errors.description = 'Describe what happens (at least 20 characters).';
  if (!isRealDate(values.event_date)) errors.event_date = 'Choose a real calendar date.';
  if (values.start_note.length < 2) errors.start_note = 'Say when people should arrive.';
  if (values.location.length < 2) errors.location = 'Say where people should meet.';
  return errors;
}

export function normaliseNotice(input: Record<string, unknown>): Values {
  const publication = text(input.publication, 20);
  return {
    title: text(input.title, 90),
    body: text(input.body, 900),
    notice_date: text(input.notice_date, 10),
    publication: publications.includes(publication as (typeof publications)[number]) ? publication : 'Draft',
  };
}

export function validateNotice(values: Values): Errors {
  const errors: Errors = {};
  if (values.title.length < 3) errors.title = 'Give the notice a heading (at least 3 characters).';
  if (values.body.length < 10) errors.body = 'Write the notice (at least 10 characters).';
  if (!isRealDate(values.notice_date)) errors.notice_date = 'Choose a real calendar date.';
  return errors;
}

export function normaliseVolunteerRole(input: Record<string, unknown>): Values {
  const publication = text(input.publication, 20);
  return {
    title: text(input.title, 90),
    description: text(input.description, 1000),
    event_date: text(input.event_date, 10),
    start_note: text(input.start_note, 60),
    location: text(input.location, 120),
    capacity: text(input.capacity, 3),
    publication: publications.includes(publication as (typeof publications)[number]) ? publication : 'Draft',
  };
}

export function validateVolunteerRole(values: Values): Errors {
  const errors: Errors = {};
  if (values.title.length < 3) errors.title = 'Give the role a name (at least 3 characters).';
  if (values.description.length < 20) errors.description = 'Describe the job (at least 20 characters).';
  if (!isRealDate(values.event_date)) errors.event_date = 'Choose a real calendar date.';
  if (values.start_note.length < 2) errors.start_note = 'Say when people should arrive.';
  if (values.location.length < 2) errors.location = 'Say where volunteers should meet.';
  const capacity = Number(values.capacity);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100) errors.capacity = 'Use a whole number of places between 1 and 100.';
  return errors;
}

export function normaliseVolunteerSignup(input: Record<string, unknown>): Values {
  return {
    name: text(input.name, 80),
    email: text(input.email, 120).toLowerCase(),
    phone: text(input.phone, 40),
    notes: text(input.notes, 500),
  };
}

export function validateVolunteerSignup(values: Values): Errors {
  const errors: Errors = {};
  if (values.name.length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.email = 'Enter an email address we can use to contact you.';
  if (values.phone.length > 40) errors.phone = 'Keep the phone number under 40 characters.';
  return errors;
}

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  const date = new Date(Date.UTC(2000, month - 1, day, 12));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event';
}

export function shortReference(id: string): string {
  return 'RRC-' + id.replaceAll('-', '').slice(0, 8).toUpperCase();
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0;
}
