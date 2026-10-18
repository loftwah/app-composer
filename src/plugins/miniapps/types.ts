import type { AchievementCollection } from "../../lib/miniapp-achievements.mjs";
import type { TagCollection } from "../../lib/miniapp-tag-fields.mjs";
export type AppID = "guestbook" | "showcase";
export type Item = {
  id: string;
  caption?: string;
  title?: string;
  description?: string;
  author?: string;
  status: string;
  provider?: string;
  item_id?: string;
  url?: string;
  revision?: number;
  pinned?: boolean;
  icon?: string;
  group?: string;
  sourceState?: "available" | "unavailable";
};
export type LinkValues = {
  title: string;
  description: string;
  url: string;
  status: string;
};
export type NewLink = Pick<LinkValues, "title" | "description" | "url">;
export type LinkDraft = { from: LinkValues; value: LinkValues };
export type StyleValues = { icon: string; pinned: boolean; group?: string };
export type StyleDraft = {
  from: StyleValues;
  value: StyleValues;
  title?: string;
};
export type Snapshot = {
  ok: boolean;
  app: AppID;
  message?: string;
  config: Record<string, string> & {
    title: string;
    intro: string;
    theme: string;
    layout: string;
  };
  items: Item[];
  achievementCollection?: AchievementCollection | null;
  achievementProblem?: string;
  tagCollection?: TagCollection | null;
  tagProblem?: string;
};
export type AppAction = (
  app: AppID,
  action: string,
  fields: Record<string, unknown>,
  success: string,
  failed?: (message: string, code?: string) => void,
) => Promise<boolean>;
