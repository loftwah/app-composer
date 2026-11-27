import entries from '../editorial/opportunities/opportunities.json' with { type: 'json' };

export const regions = {
  'north-west': 'Sunbury and Melbourne north-west',
  melbourne: 'Greater Melbourne',
  victoria: 'Victoria',
  australia: 'Australia and remote',
  watch: 'International watch',
};
export const categories = {
  adoption: 'Small business and adoption', consulting: 'Consulting and procurement',
  funding: 'Funding and startup support', meetup: 'Meetups and events',
};
export const statuses = {
  open: 'Open', ongoing: 'Ongoing', upcoming: 'Upcoming', watch: 'Watch',
  paused: 'Paused', past: 'Past event',
};
export type Opportunity = (typeof entries)[number];
const day = 86_400_000;
const freshnessDays = 30;
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' });

export function opportunityStatus(record: Opportunity, now: number): keyof typeof statuses {
  if (record.endsAt && Date.parse(record.endsAt) <= now) return 'past';
  return record.status as keyof typeof statuses;
}

export function staleOpportunity(record: Opportunity, now: number) {
  const reviewBy = new Date(Date.parse(record.verifiedOn) + freshnessDays * day).toISOString().slice(0, 10);
  return today.format(now) > reviewBy;
}

export function opportunityDate(date: string) {
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date));
}

export function opportunities() {
  return entries;
}

export function opportunityPath(id: string) {
  return '/opportunities/' + id;
}

const actionable = new Set(['open', 'ongoing', 'upcoming']);
export function filterOpportunities(params: URLSearchParams, now: number) {
  const q = (params.get('q') ?? '').trim().slice(0, 120);
  const region = params.get('region') ?? '';
  const category = params.get('category') ?? '';
  const show = params.get('show') === 'all' ? 'all' : 'current';
  const sortParam = params.get('sort');
  const sort = sortParam === 'date' || sortParam === 'verified' ? sortParam : 'local';
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rank = Object.keys(regions);
  const matches = entries.filter(record => {
    if (show === 'current' && region !== 'watch' && !actionable.has(opportunityStatus(record, now))) return false;
    if ((region && record.region !== region) || (category && record.category !== category)) return false;
    const search = [record.title, record.organiser, record.location, record.summary, record.eligibility].join(' ').toLowerCase();
    return words.every(word => search.includes(word));
  }).sort((a, b) => {
    const eventOrder = (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999');
    const verifiedOrder = b.verifiedOn.localeCompare(a.verifiedOn);
    return (sort === 'date' ? eventOrder : sort === 'verified' ? verifiedOrder : 0) ||
      rank.indexOf(a.region) - rank.indexOf(b.region) || verifiedOrder || a.title.localeCompare(b.title);
  });
  return { matches, q, region, category, sort, show };
}
