// The public Share wall presents current publications only. The page reads
// those rows through publicStacks() and passes them here, so this module decides
// what a visitor sees without touching the database: which filters are valid,
// which cards match and what an empty result honestly says.
import { STACK_APPS, THEMES } from "./stacks.mjs";
import type { PublicStack } from "./stacks.mjs";
import { publicStackDescription } from "./stack-sharing.ts";

// Long enough for a sentence, short enough to keep one card readable and the
// address linkable. The same limit applies when reading and when building a URL.
export const SHARE_WALL_QUERY_LIMIT = 80;

const themeNames: Record<string, string> = {
  daylight: "Daylight",
  midnight: "Midnight",
};

export interface ShareWallCard {
  slug: string;
  name: string;
  description: string;
  theme: string;
  themeLabel: string;
  revision: number;
  /** Publication date as a display label, or "" when the row had no usable date. */
  published: string;
  appIds: string[];
  appLabels: string[];
  appsLabel: string;
  imagePath: string;
}

export interface ShareWallQuery {
  /** Free text, already trimmed and bounded. */
  query: string;
  /** A known app id, or "" for any app. */
  app: string;
  /** A known theme, or "" for any theme. */
  theme: string;
}

export interface ShareWallOption {
  value: string;
  label: string;
}

export function themeName(theme: string): string {
  return themeNames[theme] ?? theme;
}

function appName(id: string): string {
  return STACK_APPS[id]?.name ?? id;
}

// The publication timestamp is stored as UTC "YYYY-MM-DD HH:MM:SS". Format the
// date in UTC so a reader in another timezone never sees the previous day.
export function publishedLabel(value: string): string {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// One published stack, one card. Only visible instances name apps, matching the
// public stack page and its share image. The description reuses the stack
// share sentence so the wall, the card and the stack page cannot drift.
export function shareWallCard(
  stack: PublicStack,
  imagePath: string,
): ShareWallCard {
  const appIds = [
    ...new Set(
      stack.document.instances
        .filter((instance) => instance.visible !== false)
        .map((instance) => instance.app),
    ),
  ];
  const appLabels = appIds.map(appName);
  return {
    slug: stack.slug,
    name: stack.name,
    description: publicStackDescription(stack),
    theme: stack.theme,
    themeLabel: themeName(stack.theme),
    revision: stack.revision,
    published: publishedLabel(stack.publishedAt),
    appIds,
    appLabels,
    appsLabel: appLabels.join(" · "),
    imagePath,
  };
}

// A filtered view is a plain GET address, so reading it back must produce the
// same view. Unknown app or theme values are dropped rather than echoed.
export function shareWallQuery(params: URLSearchParams): ShareWallQuery {
  const query = (params.get("q") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SHARE_WALL_QUERY_LIMIT);
  const app = params.get("app") ?? "";
  const theme = params.get("theme") ?? "";
  return {
    query,
    app: Object.hasOwn(STACK_APPS, app) ? app : "",
    theme: THEMES.includes(theme) ? theme : "",
  };
}

export function shareWallParams(query: ShareWallQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.app) params.set("app", query.app);
  if (query.theme) params.set("theme", query.theme);
  return params;
}

export function shareWallHref(query: ShareWallQuery): string {
  const search = shareWallParams(query).toString();
  return search ? `/share?${search}` : "/share";
}

export function hasShareWallFilters(query: ShareWallQuery): boolean {
  return Boolean(query.query || query.app || query.theme);
}

// Offer only filters that can match at least one published card, plus the
// active filter itself so a filtered address never renders as "All apps".
export function shareWallOptions(
  cards: readonly ShareWallCard[],
  query: ShareWallQuery,
): { apps: ShareWallOption[]; themes: ShareWallOption[] } {
  const apps = Object.entries(STACK_APPS)
    .filter(([id]) => cards.some((card) => card.appIds.includes(id)))
    .map(([value, app]) => ({ value, label: app.name }));
  if (query.app && !apps.some((option) => option.value === query.app))
    apps.push({ value: query.app, label: appName(query.app) });
  apps.sort((a, b) => a.label.localeCompare(b.label, "en"));
  const themes = THEMES.filter((theme) =>
    cards.some((card) => card.theme === theme),
  ).map((value) => ({ value, label: themeName(value) }));
  if (query.theme && !themes.some((option) => option.value === query.theme))
    themes.push({ value: query.theme, label: themeName(query.theme) });
  return { apps, themes };
}

// Search reads the name and description a visitor can see on the card. Every
// word must appear, so extra words narrow the result instead of widening it.
export function filterShareWall(
  cards: readonly ShareWallCard[],
  query: ShareWallQuery,
): ShareWallCard[] {
  const words = query.query.toLowerCase().split(" ").filter(Boolean);
  return cards.filter((card) => {
    if (query.app && !card.appIds.includes(query.app)) return false;
    if (query.theme && card.theme !== query.theme) return false;
    if (!words.length) return true;
    const text = `${card.name} ${card.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function shareWallFilterLabel(query: ShareWallQuery): string {
  const parts: string[] = [];
  if (query.query) parts.push(`“${query.query}”`);
  if (query.app) parts.push(appName(query.app));
  if (query.theme) parts.push(themeName(query.theme));
  if (parts.length < 2) return parts[0] ?? "those filters";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function shareWallSummary(
  total: number,
  matched: number,
  query: ShareWallQuery,
): string {
  const noun = total === 1 ? "stack" : "stacks";
  if (!hasShareWallFilters(query)) return `${total} published ${noun}`;
  return `Showing ${matched} of ${total} published ${noun} for ${shareWallFilterLabel(query)}`;
}

// Two empty states, kept apart. No publication at all is a different fact from
// a filter that matched nothing, and neither invents an example card.
export function shareWallEmptyCopy(
  total: number,
  query: ShareWallQuery,
): { heading: string; body: string } {
  if (total === 0)
    return {
      heading: "Nothing has been published yet.",
      body: "Published creator stacks appear here with the share image their creator chose. This page stays empty until one is published.",
    };
  const noun = total === 1 ? "stack" : "stacks";
  return {
    heading: "No published stack matches those filters.",
    body: `Nothing on the wall matches ${shareWallFilterLabel(query)}. Clear the filters to see all ${total} published ${noun}.`,
  };
}
