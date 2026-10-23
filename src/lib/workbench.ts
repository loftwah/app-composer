import {
  approvedPhoto,
  publicPhotoView,
} from "../vendor/workbench/guestbook-photo-view.ts";
import { linkedCardContent } from "../vendor/workbench/showcase-card-view.ts";
import type { ResourceItem } from "./resource-client";
import {
  collectionSource,
  collectionItemsReply,
} from "./miniapp-collection-contract.ts";
import { appConfiguration, selectedSources } from "./app-settings.mjs";
import { validateSpec } from "./spec.mjs";

export const DEMO_KEY = "composer:workbench:v1";
export const HANDOFF_KEY = "composer:workbench-handoff:v1";
export const images = [
  {
    src: "/brand/demo/ringmarket-v5.webp",
    alt: "Fictional market strung between asteroids above a ringed planet",
  },
  {
    src: "/brand/demo/lighthouse-v5.webp",
    alt: "Fictional lighthouse on a slow moon at night",
  },
];
export type DemoItem = ResourceItem & { image: number };
export interface Presentation {
  title: string;
  layout: "grid" | "editorial";
  connected: boolean;
  slots: (string | null)[];
}
export interface Revision {
  id: number;
  label: string;
  presentation: Presentation;
}
export interface BenchState {
  version: 1;
  items: DemoItem[];
  draft: Presentation;
  revisions: Revision[];
  selected: string;
  milestones: string[];
}
export type Action =
  | { type: "select"; id: string }
  | { type: "caption"; value: string }
  | { type: "image"; value: number }
  | { type: "visibility" }
  | { type: "connect"; slot: number; id?: string }
  | { type: "disconnect" }
  | { type: "title"; value: string }
  | { type: "layout"; value: "grid" | "editorial" }
  | { type: "publish"; label?: string }
  | { type: "restore"; revision: number }
  | { type: "later" }
  | { type: "inspect" };
const copy = <T>(value: T): T => structuredClone(value);
export function initialBench(): BenchState {
  return {
    version: 1,
    items: [
      {
        id: "demo-ringmarket",
        caption: "Signal check at the ring market",
        author: "Fictional traveller Ada",
        status: "approved",
        revision: 1,
        synthetic: 1,
        created_at: "2026-10-23",
        image: 0,
      },
      {
        id: "demo-lighthouse",
        caption: "The tide lighthouse, slow moon",
        author: "Fictional keeper Sol",
        status: "approved",
        revision: 1,
        synthetic: 1,
        created_at: "2026-10-23",
        image: 1,
      },
    ],
    draft: {
      title: "Our small universe",
      layout: "grid",
      connected: true,
      slots: [null, null],
    },
    revisions: [],
    selected: "demo-ringmarket",
    milestones: [],
  };
}
export function eligible(item: DemoItem | undefined): item is DemoItem {
  return approvedPhoto(item);
}
export function sourcePhoto(item: DemoItem) {
  return publicPhotoView(item, {
    url: `https://workbench.invalid/item/${item.id}`,
    image: images[item.image].src,
  });
}
export function featured(state: BenchState, presentation = state.draft) {
  return presentation.slots.map((id) => {
    if (!presentation.connected) return null;
    const item = state.items.find((item) => item.id === id);
    if (!eligible(item)) return null;
    const card = linkedCardContent({ id: `featured-${id}` }, sourcePhoto(item));
    return card
      ? { ...item, caption: card.title, author: card.description }
      : null;
  });
}

export function transition(current: BenchState, action: Action): BenchState {
  const state = copy(current),
    item = state.items.find((item) => item.id === state.selected);
  const earned = (name: string) => {
    if (!state.milestones.includes(name)) state.milestones.push(name);
  };
  const publish = (label: string) => {
    state.revisions.push({
      id: (state.revisions.at(-1)?.id ?? 0) + 1,
      label,
      presentation: copy(state.draft),
    });
    state.revisions = state.revisions.slice(-24);
    earned("publish");
  };
  switch (action.type) {
    case "select":
      if (state.items.some((record) => record.id === action.id))
        state.selected = action.id;
      break;
    case "caption":
      if (item) {
        item.caption = action.value.slice(0, 160);
        item.revision++;
        earned("edit");
      }
      break;
    case "image":
      if (item && [0, 1].includes(action.value)) {
        item.image = action.value;
        item.revision++;
        earned("edit");
      }
      break;
    case "visibility":
      if (item && item.status !== "deleted") {
        item.status = item.status === "approved" ? "hidden" : "approved";
        item.revision++;
        if (item.status === "hidden") {
          state.draft.slots = state.draft.slots.map((id) =>
            id === item.id ? null : id,
          );
          earned("hide");
        } else earned("restore");
      }
      break;
    case "connect": {
      const linked = state.items.find(
        (record) => record.id === (action.id ?? state.selected),
      );
      if (eligible(linked) && [0, 1].includes(action.slot)) {
        state.draft.connected = true;
        state.draft.slots = state.draft.slots.map((id) =>
          id === linked.id ? null : id,
        );
        state.draft.slots[action.slot] = linked.id;
        earned("connect");
      }
      break;
    }
    case "inspect":
      earned("inspect");
      break;
    case "disconnect":
      state.draft.connected = false;
      earned("disconnect");
      break;
    case "title":
      state.draft.title = action.value.slice(0, 80);
      break;
    case "layout":
      state.draft.layout = action.value;
      break;
    case "publish":
      publish(action.label ?? "Published composition");
      break;
    case "restore": {
      const revision = state.revisions.find(
        (revision) => revision.id === action.revision,
      );
      if (revision) {
        state.draft = copy(revision.presentation);
        publish("Restored revision " + revision.id);
      }
      break;
    }
    case "later":
      if (!state.items.some((item) => item.id === "demo-later-record")) {
        state.items.push({
          id: "demo-later-record",
          caption: "A later arrival at the moon harbour",
          author: "Fictional visitor Ren",
          status: "approved",
          revision: 1,
          synthetic: 1,
          created_at: "2026-10-23",
          image: 1,
        });
        state.selected = "demo-later-record";
        earned("later");
      }
      break;
  }
  return state;
}
// Validate persisted demonstration records against the current collection contract.
// This transport is local; no resource, invitation, owner API or analytics is called.
export function readBench(raw: string | null): BenchState {
  if (!raw || raw.length > 65536) return initialBench();
  try {
    const state = JSON.parse(raw) as BenchState;
    if (
      state.version !== 1 ||
      !Array.isArray(state.items) ||
      state.items.length < 2 ||
      state.items.length > 3 ||
      new Set(state.items.map((item) => item.id)).size !== state.items.length ||
      !Array.isArray(state.revisions) ||
      state.revisions.length > 24 ||
      !Array.isArray(state.milestones) ||
      state.milestones.some(
        (value) =>
          ![
            "connect",
            "edit",
            "hide",
            "restore",
            "disconnect",
            "inspect",
            "publish",
            "later",
          ].includes(value),
      ) ||
      !state.items.some((item) => item.id === state.selected)
    )
      throw Error();
    const source = collectionSource.parse({
      kind: "guestbook.resource",
      version: 1,
      resource: "demo-guestbook",
      configuration: 1,
    });
    collectionItemsReply.parse({
      ok: true,
      selection: {
        workspace: "demo-workspace",
        stack: "demo-stack",
        instance: "demo-instance",
        expectedRevision: 1,
      },
      source,
      title: "Demo",
      visible: true,
      pending: false,
      items: state.items,
    });
    for (const item of state.items)
      if (
        !["demo-ringmarket", "demo-lighthouse", "demo-later-record"].includes(
          item.id,
        ) ||
        !["approved", "hidden", "deleted"].includes(item.status) ||
        ![0, 1].includes(item.image) ||
        !Number.isSafeInteger(item.revision) ||
        item.revision < 1 ||
        item.synthetic !== 1
      )
        throw Error();
    const valid = (p: Presentation) =>
      p &&
      typeof p.title === "string" &&
      p.title.length <= 80 &&
      ["grid", "editorial"].includes(p.layout) &&
      typeof p.connected === "boolean" &&
      Array.isArray(p.slots) &&
      p.slots.length === 2 &&
      p.slots.every(
        (id) => id === null || state.items.some((item) => item.id === id),
      );
    if (
      !valid(state.draft) ||
      state.revisions.some(
        (r, i) =>
          !Number.isSafeInteger(r.id) ||
          r.id < 1 ||
          (i > 0 && r.id <= state.revisions[i - 1].id) ||
          typeof r.label !== "string" ||
          r.label.length > 100 ||
          !valid(r.presentation),
      )
    )
      throw Error();
    return state;
  } catch {
    return initialBench();
  }
}
export function startingSpec(state: BenchState) {
  const base = validateSpec({
    version: 2,
    preset: "composition",
    sources: selectedSources(["guestbook", "showcase"]),
    appSettings: {},
    config: {
      title: state.draft.title.trim() || "Our small universe",
      intro: "A shared collection of moments worth keeping.",
      theme: "daylight",
      layout: state.draft.layout,
    },
    privacy: "review-first",
    deployment: { mode: "preview", hostname: "" },
    cards: [],
    decisions: { goal: "composition", privacy: "review-first" },
  });
  return validateSpec({
    ...base,
    appSettings: {
      guestbook: {
        ...appConfiguration(base, "guestbook"),
        title: "Here / there",
        intro: "Leave a moment from where you are.",
      },
      showcase: appConfiguration(base, "showcase"),
    },
  });
}
