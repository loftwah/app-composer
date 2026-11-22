const requiredTags = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
const optionalTags = ['utm_content', 'utm_term', 'utm_id'] as const;
const campaignMedia = ['social', 'email', 'cpc', 'referral', 'qr'] as const;

type CampaignTags = Record<Exclude<(typeof requiredTags)[number], 'utm_medium'>, string> & {
  utm_medium: (typeof campaignMedia)[number];
} & Partial<Record<(typeof optionalTags)[number], string>>;

interface PublicLanding {
  url: string;
  queryKeys?: readonly string[];
}

/** Build a new link for a landing page and query fields approved by its owner. */
export function campaignLink(landing: PublicLanding, tags: CampaignTags, destination = landing.url): string {
  const approved = new URL(landing.url);
  const url = new URL(destination);
  if (
    url.protocol !== 'https:' ||
    url.origin !== approved.origin ||
    url.pathname !== approved.pathname ||
    url.username ||
    url.password
  ) {
    throw new Error('Campaign links require an approved public HTTPS landing page.');
  }

  const managedTags: readonly string[] = [...requiredTags, ...optionalTags];
  for (const name of url.searchParams.keys()) {
    if (!managedTags.includes(name) && !landing.queryKeys?.includes(name)) {
      throw new Error('Campaign link contains an unapproved query parameter.');
    }
  }
  for (const name of managedTags) url.searchParams.delete(name);

  for (const name of [...requiredTags, ...optionalTags]) {
    const raw = tags[name];
    if (raw === undefined && !requiredTags.some((required) => required === name)) continue;
    const value = raw?.trim().toLowerCase();
    if (!value || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value)) {
      throw new Error(`${name} requires a lowercase slug of up to 128 characters.`);
    }
    if (name === 'utm_medium' && !campaignMedia.some((medium) => medium === value)) {
      throw new Error('utm_medium must be a supported campaign medium.');
    }
    url.searchParams.set(name, value);
  }
  if (url.href.length > 2048) throw new Error('Campaign link exceeds 2048 characters.');
  return url.href;
}
