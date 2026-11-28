import type { D1Database } from "@cloudflare/workers-types";
import { PluginRouteError } from "emdash";
import type { z } from "zod";
import clef from "../data/decision-research-clef.json";
import { indexedProjects, preferencesId } from "./decision-interviews.ts";
import {
  listDecisions,
  storeDecisionBrief,
  getBrief,
} from "./portfolio-decisions.ts";
import {
  adminDecisions,
  decisionChoiceTitle,
  decisionReactionLabels,
  type DecisionReaction,
  type DecisionImage,
} from "./portfolio-decision-contract.ts";
import type { Decision } from "./portfolio-decision-contract.ts";
import {
  artworkRevision,
  listShareArtwork,
  publicShareArtwork,
} from "./share-catalogue-asset.ts";
import {
  experiencePath,
  experiences,
  type ExperienceId,
} from "./share-experiences.ts";
import { shareFilms, loadStudioShowcase } from "./share-films.ts";
import { shareExamples } from "./share-examples.ts";
import {
  editorialRoles,
  followupRoles,
  type researchInput,
  type ResearchReply,
  type ResearchShareItem,
  type ResearchFeedback,
} from "./decision-research-contract.ts";

const origin = "https://composer.loftwah.com";
const pageSize = 24;
type Assessment = {
  nextQuestion: { choice: string; confidence: number };
  evidence: { score: number };
  ownerExample: { noul: number };
};
const projectScores: Record<string, Assessment> = clef.projects;
const artworkScores: Record<string, readonly (string | number)[]> =
  clef.artwork;
const words = (value?: string) =>
  (value ?? "").toLowerCase().split(/\s+/).filter(Boolean);

function pageOf<T>(rows: T[], page: number) {
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    hasMore: rows.length > page * pageSize,
  };
}

async function projects(db: D1Database, owner: string): Promise<ResearchReply> {
  const questions = await listDecisions(db, owner);
  const subjects = [
    {
      id: preferencesId,
      name: "Your preferences",
      job: "What you like, what you want to learn and how you want agents to work.",
      url: origin,
      proof: "Examples and preferences you choose to record.",
      lifecycle: "personal",
    },
    ...indexedProjects,
  ];
  return {
    view: "projects",
    evaluated: clef.evaluated,
    scoredArtwork: Object.keys(artworkScores).length,
    projects: subjects.map((subject) => {
      const entries = questions.filter(
        (question) => question.interview === subject.id,
      );
      const assessment = projectScores[subject.id];
      return {
        ...subject,
        questions: entries.length,
        answered: entries.filter((entry) => entry.status !== "open").length,
        start: (entries.find((entry) => entry.status === "open") ?? entries[0])
          ?.id,
        assessment: assessment
          ? {
              followup: followupRoles[assessment.nextQuestion.choice],
              confidence: assessment.nextQuestion.confidence,
              proofScore: assessment.evidence.score,
              ownerExample: assessment.ownerExample.noul,
            }
          : undefined,
      };
    }),
  };
}

async function share(
  input: z.infer<typeof researchInput>,
  page: number,
): Promise<ResearchReply> {
  const wantsArt =
    !input.kind || input.kind === "all" || input.kind === "artwork";
  const wantsFilm =
    !input.kind || input.kind === "all" || input.kind === "film";
  const [artwork, studio] = await Promise.all([
    wantsArt ? listShareArtwork() : Promise.resolve([]),
    wantsFilm ? loadStudioShowcase() : Promise.resolve([]),
  ]);
  if (!artwork)
    throw new PluginRouteError(
      "CATALOGUE_UNAVAILABLE",
      "Share artwork is temporarily unavailable. Try again.",
      503,
    );

  const records = new Map(artwork.map((item) => [item.assetId, item]));
  const artworkItems: ResearchShareItem[] = artwork.map((item) => ({
    id: item.assetId,
    kind: "artwork",
    project: item.project,
    title: item.title,
    description: item.description,
    href: `/share/artwork/${item.assetId}`,
    feedbackHref: `/share/artwork/${item.assetId}#artwork-feedback`,
  }));
  const films: ResearchShareItem[] = [
    ...shareFilms.map((item): ResearchShareItem => ({
      id: item.id,
      title: item.title,
      kind: "film",
      project: "media-studio",
      href: item.href,
      description: "detail" in item ? item.detail : "",
      feedbackHref: `/media-studio/films#${item.id}`,
    })),
    ...(studio ?? []).map((item): ResearchShareItem => ({
      id: item.slug,
      title: item.title,
      kind: "film",
      project: "media-studio",
      href: `https://media.loftwah.com/p/${item.slug}`,
      description: "Public Media Studio film",
    })),
  ];
  const tools: ResearchShareItem[] = Object.entries(experiences).map(
    ([id, item]) => ({
      id,
      title: item.title,
      description: item.description,
      kind: "experience",
      project: "app-composer",
      href: experiencePath(id as ExperienceId),
    }),
  );
  const examples: ResearchShareItem[] = shareExamples.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    href: item.href,
    kind: "example",
    project: "app-composer",
  }));
  const collection = [...artworkItems, ...films, ...tools, ...examples].filter(
    (item) => !input.kind || input.kind === "all" || item.kind === input.kind,
  );
  const queries = words(input.query);
  const rows = collection.filter((item) => {
    if (input.project && input.project !== item.project) return false;
    const record = records.get(item.id);
    const text = [
      item.title,
      item.id,
      item.kind,
      item.project,
      item.description,
      ...(record?.tags ?? []),
      record?.alt,
    ]
      .join(" ")
      .toLowerCase();
    return queries.every((query) => text.includes(query));
  });
  const window = pageOf(rows, page);
  const items = await Promise.all(
    window.items.map(async (item) => {
      const record = item.kind === "artwork" ? records.get(item.id) : undefined;
      if (!record) return item;
      const revision = await artworkRevision(record);
      const assessment = artworkScores[item.id];
      const withRevision = { ...item, revision };
      if (!assessment || assessment[0] !== revision) return withRevision;
      const [, label, confidence] = assessment;
      return {
        ...withRevision,
        assessment: {
          label: editorialRoles[String(label)],
          confidence: Number(confidence),
        },
      };
    }),
  );
  return {
    view: "share",
    ...window,
    items,
    projects: [...new Set(collection.map((item) => item.project))].sort(),
  };
}

async function feedback(
  db: D1Database,
  owner: string,
  input: z.infer<typeof researchInput>,
  page: number,
): Promise<ResearchReply> {
  const [decisions, shareNotes, saved] = await Promise.all([
    listDecisions(db, owner),
    db
      .prepare(
        `SELECT asset_id AS id, asset_revision AS revision, asset_title AS title, asset_url AS href,
      vote, reasons, note, updated_at AS updatedAt FROM composer_share_feedback
      WHERE actor_id=? ORDER BY updated_at DESC, asset_id, asset_revision`,
      )
      .bind(owner)
      .all<{
        id: string;
        revision: string;
        title: string;
        href: string;
        vote: "up" | "down";
        reasons: string;
        note: string;
        updatedAt: string;
      }>(),
    db
      .prepare(
        `
      SELECT decision_id AS id, note, saved_at AS updatedAt, selected, media, image_revision, image_name, reaction
      FROM composer_decision_responses AS response
      WHERE owner_id=? AND revision=(SELECT MAX(revision) FROM composer_decision_responses
      WHERE owner_id=response.owner_id AND decision_id=response.decision_id)
    `,
      )
      .bind(owner)
      .all<{
        id: string;
        note: string;
        updatedAt: string;
        selected: string;
        media: string;
        image_revision: number | null;
        image_name: string | null;
        reaction: DecisionReaction | null;
      }>(),
  ]);
  const known = new Map(decisions.map((item) => [item.id, item]));
  const projects = new Set<string>();
  const terms = words(input.query);
  const matches = (haystack: string) =>
    terms.every((term) => haystack.toLowerCase().includes(term));
  const decisionItems = saved.results.flatMap((item) => {
    const row = known.get(item.id);
    if (!row) return [];
    projects.add(row.project);
    if (
      (input.feedbackProject && row.project !== input.feedbackProject) ||
      (input.category && row.category !== input.category) ||
      !matches(
        `${row.project} ${row.question} ${row.category ?? ""} ${row.tags?.join(" ") ?? ""} ${item.note} ${item.reaction ? decisionReactionLabels[item.reaction] : ""}`,
      )
    )
      return [];
    return [
      { source: "decision" as const, item, row, updatedAt: item.updatedAt },
    ];
  });
  const shareItems = shareNotes.results
    .filter(
      (item) =>
        (!input.feedbackProject || input.feedbackProject === "Share") &&
        (!input.category || input.category === "Creative review") &&
        matches(
          `Share Creative review ${item.title} ${item.note} ${item.reasons}`,
        ),
    )
    .map((item) => ({ source: "share" as const, ...item }));
  if (shareNotes.results.length) projects.add("Share");
  const window = pageOf(
    [...decisionItems, ...shareItems].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    ),
    page,
  );
  const items = await Promise.all(
    window.items.map(async (item): Promise<ResearchFeedback> => {
      if (item.source === "share")
        return {
          ...item,
          id: `${item.id}-${item.revision}`,
          project: "Share",
          category: "Creative review",
          choices: [
            item.vote === "up" ? "Liked" : "Disliked",
            ...(JSON.parse(item.reasons) as string[]),
          ],
        };
      const { item: saved, row } = item;
      const decision = await getBrief(db, owner, saved.id);
      const image: DecisionImage | undefined =
        saved.image_revision && saved.image_name
          ? { revision: saved.image_revision, name: saved.image_name }
          : undefined;
      return {
        source: item.source,
        id: saved.id,
        title: row.question,
        href: `${adminDecisions}?id=${saved.id}`,
        project: row.project,
        category: row.category,
        tags: row.tags,
        choices: (JSON.parse(saved.selected) as string[]).map((id) =>
          decisionChoiceTitle(decision, id),
        ),
        note: saved.note,
        updatedAt: saved.updatedAt,
        media: JSON.parse(saved.media) as string[],
        image,
        reaction: saved.reaction,
      };
    }),
  );
  return { view: "feedback", ...window, items, projects: [...projects].sort() };
}

export async function decisionResearch(
  db: D1Database,
  owner: string,
  input: z.infer<typeof researchInput>,
) {
  const page = input.page ?? 1;
  if (input.view === "projects") return projects(db, owner);
  if (input.view === "share") return share(input, page);
  return feedback(db, owner, input, page);
}

export async function askAboutArtwork(
  db: D1Database,
  owner: string,
  id: string,
  expected: string,
) {
  const result = await publicShareArtwork(id);
  if (result.status !== 200)
    throw new PluginRouteError(
      result.status === 404 ? "NOT_FOUND" : "CATALOGUE_UNAVAILABLE",
      "This artwork could not be opened from the live Share catalogue.",
      result.status === 404 ? 404 : 503,
    );
  const { artwork } = result;
  const revision = await artworkRevision(artwork);
  if (revision !== expected)
    throw new PluginRouteError(
      "ARTWORK_CHANGED",
      "This piece changed. Refresh the Share index before reviewing it.",
      409,
    );
  const brief: Decision = {
    id: `art-${revision.slice(0, 48)}`,
    interview: "artwork",
    category: "Creative review",
    tags: ["artwork"],
    project: "Share artwork",
    subject: { assetId: artwork.assetId, revision },
    question: `What should we do with “${artwork.title.slice(0, 137)}”?`,
    context:
      "Open the original piece before answering. Use the note to name a campaign or say what specifically works, fails or needs another attempt.",
    maxSelections: 1,
    sources: [
      {
        label: "Open the original artwork preview",
        url: artwork.previewUrl,
      },
      {
        label: "Open Share for current source and credits",
        url: `${origin}/share/artwork/${artwork.assetId}`,
      },
    ],
    options: [
      ["feature", "Consider it for a specific campaign"],
      ["keep", "Keep it findable as it is"],
      ["revise", "Revise it before featuring it"],
      ["reference", "Keep it as a reference only"],
      ["pass", "Show me less work like this"],
    ].map(([id, title]) => ({
      id,
      title,
      pitch: "",
      outcome: "",
      pro: "",
      con: "",
    })),
  };
  const saved = await storeDecisionBrief(db, owner, brief);
  return {
    ...saved,
    url: `${adminDecisions}?id=${brief.id}`,
    assetId: artwork.assetId,
    revision,
  };
}
