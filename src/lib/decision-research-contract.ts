import { z } from "zod";
import {
  decisionCategories,
  type DecisionReaction,
  type DecisionImage,
} from "./portfolio-decision-contract.ts";

const reference = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/);
export const socialStatuses = [
  "promising",
  "revise",
  "reference",
  "unreviewed",
] as const;
export type SocialStatus = (typeof socialStatuses)[number];
export const socialLabels: Record<SocialStatus, string> = {
  promising: "Promising",
  revise: "Needs an edit",
  reference: "Library reference",
  unreviewed: "Needs a fresh review",
};
export const socialPlacements = {
  feed: "Feed image",
  link: "Link card",
  sequence: "Carousel, story or cover",
  library: "Library reference",
};
export const socialFixes = {
  ready: "Check the source, destination and final crop",
  crop: "Make a dedicated crop or export",
  legibility: "Improve contrast, hierarchy or small text",
  purpose: "Give it a clearer audience and job",
  retain: "Keep it as a reference",
};
export type SocialReview = {
  status: Exclude<SocialStatus, "unreviewed">;
  placement: string;
  fix: string;
  score: number;
};

export const researchInput = z
  .object({
    view: z.enum(["intel", "projects", "share", "feedback"]),
    kind: z
      .enum(["all", "artwork", "film", "experience", "example"])
      .optional(),
    query: z.string().trim().max(100).optional(),
    project: reference.optional(),
    social: z.enum(socialStatuses).optional(),
    feedbackProject: z.string().trim().max(80).optional(),
    category: z.enum(decisionCategories).optional(),
    page: z.number().int().min(1).max(1000).optional(),
  })
  .strict();
export const feedbackInput = researchInput.pick({
  query: true,
  page: true,
  feedbackProject: true,
  category: true,
});

export const artworkBriefInput = z
  .object({ assetId: reference, revision: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

export const editorialRoles: Record<string, string> = {
  artwork: "Artwork or visual story",
  product: "Product or workflow",
  resource: "Usable resource",
  announcement: "Announcement or editorial",
  uncertain: "Unclear from metadata",
};
export const followupRoles: Record<string, string> = {
  task: "Check which real job matters",
  friction: "Ask where the journey breaks down",
  proof: "Ask what would count as proof",
  preserve: "Ask what should be preserved",
  unknown: "Get a clearer project brief",
};
export type ResearchProject = {
  id: string;
  name: string;
  url: string;
  job: string;
  lifecycle: string;
  proof: string;
  questions: number;
  answered: number;
  start?: string;
  assessment?: {
    followup: string;
    confidence: number;
    proofScore: number;
    ownerExample: number;
  };
};
export type ResearchShareItem = {
  id: string;
  kind: "artwork" | "film" | "experience" | "example";
  project: string;
  title: string;
  description: string;
  href: string;
  feedbackHref?: string;
  revision?: string;
  assessment?: { label: string; confidence: number };
  social?: SocialReview;
  filmOpening?: string;
};
export type ResearchFeedback = {
  source: "decision" | "share";
  id: string;
  title: string;
  href: string;
  choices: string[];
  project?: string;
  category?: (typeof decisionCategories)[number];
  tags?: string[];
  media?: string[];
  image?: DecisionImage;
  reaction?: DecisionReaction | null;
  note: string;
  updatedAt: string;
};
export type ResearchReply =
  | {
      view: "intel";
      snapshot: {
        evaluatedAt: string;
        artwork: number;
        films: number;
        filmReviewed: number;
        filmUnique: number;
        counts: Record<SocialStatus, number>;
      };
      evidence: string;
      findings: readonly {
        level: "good" | "fix" | "moonshot";
        title: string;
        text: string;
        label: string;
        href: string;
      }[];
      pins: {
        id: string;
        title: string;
        text: string;
        source: string;
        answered: boolean;
      }[];
    }
  | {
      view: "projects";
      projects: ResearchProject[];
      evaluated: string;
      scoredArtwork: number;
    }
  | {
      view: "share";
      items: ResearchShareItem[];
      projects: string[];
      total: number;
      page: number;
      hasMore: boolean;
    }
  | {
      view: "feedback";
      items: ResearchFeedback[];
      projects: string[];
      total: number;
      page: number;
      hasMore: boolean;
    };
