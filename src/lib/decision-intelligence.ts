import social from "../data/share-social-intelligence.json";
import { sha256Bytes } from "./share-catalogue-asset.ts";
import type { Decision } from "./portfolio-decision-contract.ts";
import {
  socialFixes,
  socialPlacements,
  type SocialReview,
  type SocialStatus,
} from "./decision-research-contract.ts";

const repo = "https://github.com/loftwah/app-composer";
export const intelligenceNotes = `${repo}/blob/main/docs/share-intelligence.md`;

type SocialRow = [
  string,
  Exclude<SocialStatus, "unreviewed">,
  keyof typeof socialPlacements,
  keyof typeof socialFixes,
  number,
  string,
  string,
];
const assetReviews = social.assets as unknown as Record<string, SocialRow>;

export async function socialReview(
  id: string,
  revision: string,
  thumbnailUrl: string,
): Promise<SocialReview | undefined> {
  const row = assetReviews[id];
  if (!row || row[0] !== revision) return undefined;
  const thumbKey = await sha256Bytes(new TextEncoder().encode(thumbnailUrl));
  if (thumbKey !== row[6]) return undefined;
  return {
    status: row[1],
    placement: socialPlacements[row[2]],
    fix: socialFixes[row[3]],
    score: row[4],
  };
}

const filmHooks = {
  use: "Promising opener. Review the full cut and destination.",
  faster: "Show the subject or payoff sooner.",
  context: "Add a quick reason to keep watching.",
  captions: "Improve on-screen text or captions.",
  reference: "Use this as a chapter or reference.",
} as const;

export function filmOpeningReview(id: string, href: string) {
  const item = social.films.find(
    (film) =>
      film.id === id &&
      film.href === new URL(href, "https://composer.loftwah.com").href,
  );
  const key =
    item && "opening" in item
      ? (item.opening?.[0] as keyof typeof filmHooks)
      : undefined;
  return key ? filmHooks[key] : undefined;
}

export const intelligenceFindings = [
  {
    level: "good",
    title: "Start with the strongest existing work",
    text: "Pick a promising asset, open its source and make one post for a real job. A verified task or usable file gives someone a reason to act.",
    label: "Browse promising artwork",
    href: "?view=share&social=promising",
  },
  {
    level: "fix",
    title: "Make placement-specific exports",
    text: "Cropping was the most common edit request. Check one link card, one portrait feed image and one story frame at phone size before calling a campaign ready.",
    label: "Browse artwork that needs an edit",
    href: "?view=share&social=revise",
  },
  {
    level: "fix",
    title: "Review real variants before shipping",
    text: "Start with the live journey, the accepted artwork and the relevant design skill. Compare genuinely different rendered treatments. Keep the rejected baseline and the reason.",
    label: "Open the Stitch and Clef comparison",
    href: intelligenceNotes,
  },
  {
    level: "fix",
    title: "Measure where delivery actually stalls",
    text: "An earlier release spent 270 seconds uploading the Worker. Measure from first edit to live and fix the measured bottleneck before adding another check.",
    label: "Inspect the delivery evidence",
    href: `${repo}/issues/1335`,
  },
  {
    level: "moonshot",
    title: "Oyster originals into a repeatable creative review",
    text: "Try one scoped original through Prints, a genuinely different Stitch concept, and an exact-revision Clef comparison. Keep the original with the project and carry the accepted result into Share.",
    label: "Inspect the existing Fungi watch",
    href: `${repo}/issues/1386`,
  },
] as const;

export const intelligencePins = [
  {
    id: "policy-reference-first",
    title: "Use the right skill at the start",
    text: "Choose the relevant design or operating skill before drafting. Open a current example and a rejected baseline with its reason. Check the actual changed journey.",
    source: `${repo}/blob/main/PRODUCT.md#reference-led-creation-and-operation`,
  },
  {
    id: "policy-proof-before-claim",
    title: "Keep delivery proof and creative approval distinct",
    text: "Record the actual release, the affected interaction, the original asset and the owner reaction. A completed deploy and an accepted design are different records.",
    source: `${repo}/blob/main/AGENTS.md`,
  },
  {
    id: "policy-reuse-existing-tools",
    title: "Use the existing place and remove overlapping work",
    text: "Consult the linked project and the previous decision before creating a new issue, store, scheduled watch or test programme. Keep small checks tied to the real risk.",
    source: `${repo}/issues/1443`,
  },
  {
    id: "policy-keep-original-project-context",
    title: "Keep media with its rights and source",
    text: "A public preview and a promising visual classification still need explicit reuse eligibility, an original, a project destination and a placement check.",
    source: `${repo}/issues/477`,
  },
] as const;

export const policyQuestions: Decision[] = intelligencePins.map(
  ({ id, title, text, source }) => ({
    id,
    project: "App Composer",
    interview: "policy",
    category: "Working preferences",
    tags: ["policy"],
    question: `What should change in this rule? ${title}`,
    context: text,
    maxSelections: 1,
    sources: [{ label: "Read the original rule or discussion", url: source }],
    options: [
      { id: "keep", title: "Keep this rule as written" },
      { id: "revise", title: "Revise or clarify this rule" },
      { id: "scope", title: "Keep it for a narrower project or situation" },
    ].map((option) => ({
      ...option,
      pitch: "",
      outcome: "",
      pro: "",
      con: "",
    })),
  }),
);

export const socialSnapshot = {
  evaluatedAt: social.evaluatedAt,
  artwork: social.artwork,
  films: social.films.length,
  filmReviewed: social.films.filter((film) => "opening" in film).length,
  filmUnique: social.filmUnique,
  counts: social.counts,
};
