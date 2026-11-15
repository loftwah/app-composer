import { appConfiguration, selectedSources } from "./app-settings.mjs";
import { validateSpec } from "./spec.mjs";

// The public /demo sandbox. Everything here stays in the visitor's browser:
// no resource API, guestbook database, owner session or deployment is touched.
export const LAUNCHPAD_KEY = "composer:launchpad:v1";
export const HANDOFF_KEY = "composer:workbench-handoff:v1";
export const SAVE_LIMIT = 12;

/**
 * @typedef {"daylight"|"midnight"} LaunchpadTheme
 * @typedef {"ember"|"sea"|"moss"|"clay"} LaunchpadAccent
 * @typedef {"grid"|"editorial"} LaunchpadLayout
 * @typedef {"pending"|"approved"|"hidden"} ContributionStatus
 * @typedef {{id:string,label:string,message:string,status:ContributionStatus}} Contribution
 * @typedef {{id:string,label:string,url:string}} LaunchLink
 * @typedef {{name:string,tagline:string,theme:LaunchpadTheme,accent:LaunchpadAccent,layout:LaunchpadLayout}} Project
 * @typedef {{profile:boolean,guestbook:boolean,gallery:boolean}} Blocks
 * @typedef {{id:number,label:string,project:Project,blocks:Blocks,links:LaunchLink[]}} Revision
 * @typedef {{version:1,project:Project,blocks:Blocks,links:LaunchLink[],contributions:Contribution[],revisions:Revision[]}} Launchpad
 * @typedef {{type:"name"|"tagline",value:string}
 *   |{type:"theme",value:LaunchpadTheme}
 *   |{type:"accent",value:LaunchpadAccent}
 *   |{type:"layout",value:LaunchpadLayout}
 *   |{type:"block",block:keyof Blocks,value:boolean}
 *   |{type:"link",id:string,label:string,url:string}
 *   |{type:"unlink",id:string}
 *   |{type:"review",id:string,value:"approved"|"hidden"}
 *   |{type:"save"}
 *   |{type:"restore",revision:number}} Action
 */

export const themes = /** @type {LaunchpadTheme[]} */ (["daylight", "midnight"]);
export const layouts = /** @type {LaunchpadLayout[]} */ (["grid", "editorial"]);
export const blockLabels = {
  profile: "Linkarooie profile",
  guestbook: "Here / there guestbook",
  gallery: "Media Studio gallery",
};
export const blockNotes = {
  profile: "A shareable page with your links and approved contributions.",
  guestbook: "Visitors leave a note; you approve before anything is public.",
  gallery:
    "Preview only: the current blueprint schema has no media-gallery field yet.",
};

// Two tones per identity. Light tones keep 4.5:1 ink contrast; dark tones keep
// the identity's own voice instead of reusing App Composer's brand orange.
export const palettes = {
  ember: {
    name: "Ember",
    daylight: {
      bg: "#fbf7f2",
      surface: "#ffffff",
      ink: "#1c1a17",
      muted: "#5e574e",
      border: "#ded5c8",
      accent: "#c2470a",
      onAccent: "#fffaf5",
    },
    midnight: {
      bg: "#191512",
      surface: "#241e19",
      ink: "#f7efe7",
      muted: "#bda997",
      border: "#453a31",
      accent: "#fc8a4d",
      onAccent: "#231409",
    },
  },
  sea: {
    name: "Sea",
    daylight: {
      bg: "#f4f9fb",
      surface: "#ffffff",
      ink: "#111d24",
      muted: "#4d606b",
      border: "#cadde5",
      accent: "#1c6274",
      onAccent: "#f6fcfd",
    },
    midnight: {
      bg: "#0d181d",
      surface: "#152730",
      ink: "#eaf5f9",
      muted: "#9db7c2",
      border: "#2c4551",
      accent: "#63cbe4",
      onAccent: "#08222a",
    },
  },
  moss: {
    name: "Moss",
    daylight: {
      bg: "#f6f9f3",
      surface: "#ffffff",
      ink: "#182015",
      muted: "#55614b",
      border: "#d6e2cc",
      accent: "#3f6b31",
      onAccent: "#f9fdf6",
    },
    midnight: {
      bg: "#131a12",
      surface: "#1d2a1b",
      ink: "#f0f7ec",
      muted: "#aabfa1",
      border: "#33472e",
      accent: "#a2da77",
      onAccent: "#152612",
    },
  },
  clay: {
    name: "Clay",
    daylight: {
      bg: "#fbf5f1",
      surface: "#ffffff",
      ink: "#221910",
      muted: "#665648",
      border: "#e5d3c4",
      accent: "#94451c",
      onAccent: "#fff8f3",
    },
    midnight: {
      bg: "#1b1512",
      surface: "#291f1a",
      ink: "#f9efe7",
      muted: "#c4a894",
      border: "#49382d",
      accent: "#eaa877",
      onAccent: "#2a1509",
    },
  },
};
/** @returns {Launchpad} */
export function initialLaunchpad() {
  return {
    version: 1,
    project: {
      name: "The wheel, in motion",
      tagline: "A small studio for animation, models and the odd moon.",
      theme: "midnight",
      accent: "ember",
      layout: "grid",
    },
    blocks: { profile: true, guestbook: true, gallery: false },
    links: [
      {
        id: "link-studio",
        label: "Latest film",
        url: "https://media.loftwah.com",
      },
      {
        id: "link-source",
        label: "Source",
        url: "https://github.com/loftwah/composer-media-studio",
      },
    ],
    contributions: [
      {
        id: "note-1",
        label: "Ada",
        message: "The paper-cut still is the best thing I've seen this week.",
        status: "approved",
      },
      {
        id: "note-2",
        label: "Sol",
        message: "Can I use the moon clip in a school workshop?",
        status: "pending",
      },
    ],
    revisions: [],
  };
}

/** @param {Launchpad} state */
export function publicContributions(state) {
  return state.contributions.filter((note) => note.status === "approved");
}

/** @param {Launchpad} state @returns {number} */
export function pendingCount(state) {
  return state.contributions.filter((note) => note.status === "pending").length;
}

/**
 * Copy only what a saved version restores. Moderation state is deliberately not
 * part of a version: restoring an appearance must never republish a hidden note.
 * @param {Launchpad} state
 */
function snapshot(state) {
  return {
    project: structuredClone(state.project),
    blocks: structuredClone(state.blocks),
    links: structuredClone(state.links),
  };
}

/** @param {Launchpad} current @param {Action} action @returns {Launchpad} */
export function transition(current, action) {
  const state = structuredClone(current);
  switch (action.type) {
    case "name":
      state.project.name = action.value.slice(0, 60);
      break;
    case "tagline":
      state.project.tagline = action.value.slice(0, 140);
      break;
    case "theme":
      if (themes.includes(action.value)) state.project.theme = action.value;
      break;
    case "accent":
      if (Object.hasOwn(palettes, action.value))
        state.project.accent = action.value;
      break;
    case "layout":
      if (layouts.includes(action.value)) state.project.layout = action.value;
      break;
    case "block":
      if (Object.hasOwn(state.blocks, action.block))
        state.blocks[action.block] = action.value === true;
      break;
    case "link": {
      const label = action.label.slice(0, 60);
      const url = action.url.slice(0, 200);
      const existing = state.links.find((link) => link.id === action.id);
      if (existing) {
        existing.label = label;
        existing.url = url;
      } else if (state.links.length < 4) {
        state.links.push({ id: action.id, label, url });
      }
      break;
    }
    case "unlink":
      state.links = state.links.filter((link) => link.id !== action.id);
      break;
    case "review": {
      const note = state.contributions.find((item) => item.id === action.id);
      if (note && note.status !== action.value) note.status = action.value;
      break;
    }
    case "save": {
      const id = (state.revisions.at(-1)?.id ?? 0) + 1;
      state.revisions.push({
        id,
        label: `Version ${id}`,
        ...snapshot(state),
      });
      state.revisions = state.revisions.slice(-SAVE_LIMIT);
      break;
    }
    case "restore": {
      const revision = state.revisions.find((item) => item.id === action.revision);
      if (revision) {
        state.project = structuredClone(revision.project);
        state.blocks = structuredClone(revision.blocks);
        state.links = structuredClone(revision.links);
        const id = (state.revisions.at(-1)?.id ?? 0) + 1;
        state.revisions.push({ id, label: `Restored version ${revision.id}`, ...snapshot(state) });
        state.revisions = state.revisions.slice(-SAVE_LIMIT);
      }
      break;
    }
  }
  return state;
}

/**
 * Read one saved sandbox. A corrupt or edited save never half-applies: the
 * visitor gets a clean sandbox and is told, rather than a broken preview.
 * @param {string|null} raw
 */
export function readLaunchpad(raw) {
  if (!raw || raw.length > 65536) return { state: initialLaunchpad(), recovered: false };
  try {
    /** @type {Launchpad} */
    const state = JSON.parse(raw);
    const project = state?.project;
    const text = (/** @type {unknown} */ value, /** @type {number} */ max) =>
      typeof value === "string" && value.length <= max;
    if (
      state.version !== 1 ||
      !project ||
      !text(project.name, 60) ||
      !text(project.tagline, 140) ||
      !themes.includes(project.theme) ||
      !Object.hasOwn(palettes, project.accent) ||
      !layouts.includes(project.layout) ||
      !state.blocks ||
      Object.keys(state.blocks).sort().join() !== "gallery,guestbook,profile" ||
      Object.values(state.blocks).some((value) => typeof value !== "boolean") ||
      !Array.isArray(state.links) ||
      state.links.length > 4 ||
      state.links.some(
        (link) => !text(link?.label, 60) || !text(link?.url, 200) || !text(link?.id, 40),
      ) ||
      !Array.isArray(state.contributions) ||
      state.contributions.length !== 2 ||
      state.contributions.some(
        (note) =>
          !text(note?.id, 40) ||
          !text(note?.label, 40) ||
          !text(note?.message, 200) ||
          !["pending", "approved", "hidden"].includes(note?.status),
      ) ||
      !Array.isArray(state.revisions) ||
      state.revisions.length > SAVE_LIMIT
    )
      throw new Error("Unsupported sandbox");
    return { state, recovered: false };
  } catch {
    return { state: initialLaunchpad(), recovered: true };
  }
}

/** @param {string} url */
function httpsLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/**
 * Build the same versioned specification Init already consumes. Nothing here
 * claims a build happened; it is the brief an owner's agent would act on.
 * @param {Launchpad} state
 */
export function launchpadSpec(state) {
  const blocks = state.blocks;
  const preset =
    blocks.profile && blocks.guestbook
      ? "composition"
      : blocks.profile
        ? "showcase"
        : blocks.guestbook
          ? "guestbook"
          : "";
  if (!preset)
    return {
      spec: null,
      carried: [],
      notCarried: ["No blocks are enabled, so there is nothing to export."],
    };
  const carried = [
    "Project name",
    "Introduction",
    blocks.profile && blocks.guestbook ? "Both apps" : "One app",
  ];
  if (state.project.theme) carried.push("Theme");
  if (preset !== "guestbook") carried.push("Layout");
  const notCarried = [];
  const cards = [];
  if (preset === "guestbook") {
    if (state.links.length)
      notCarried.push("Links: the guestbook-only blueprint has no link field.");
  } else {
    for (const link of state.links) {
      const label = link.label.trim();
      if (!label || !httpsLink(link.url)) {
        if (label || link.url)
          notCarried.push(`Link “${label || link.url}”: needs an https address.`);
        continue;
      }
      cards.push({ title: label, url: link.url });
      carried.push(`Link: ${label}`);
    }
  }
  if (blocks.gallery)
    notCarried.push(
      "Media Studio gallery: preview only. The current blueprint schema has no gallery field, so it is not exported.",
    );
  notCarried.push(
    "Accent colour: visual only, stored in this browser and not part of the blueprint.",
  );
  const base = validateSpec({
    version: 2,
    preset,
    sources: selectedSources(
      preset === "composition"
        ? ["guestbook", "showcase"]
        : [preset === "showcase" ? "showcase" : "guestbook"],
    ),
    appSettings: {},
    config: {
      title: state.project.name.trim() || "My project",
      intro: state.project.tagline.trim() || "A small app I own.",
      theme: state.project.theme,
      layout: state.project.layout,
    },
    privacy: "review-first",
    deployment: { mode: "preview", hostname: "" },
    cards,
    decisions: { goal: "composition", privacy: "review-first" },
  });
  const spec =
    blocks.guestbook || blocks.profile
      ? validateSpec({
          ...base,
          appSettings: {
            ...(blocks.guestbook
              ? {
                  guestbook: {
                    ...appConfiguration(base, "guestbook"),
                    title: "Here / there",
                    intro: "Leave a moment from where you are.",
                  },
                }
              : {}),
            ...(blocks.profile
              ? { showcase: appConfiguration(base, "showcase") }
              : {}),
          },
        })
      : base;
  return { spec, carried, notCarried };
}

/**
 * Apply an exported blueprint back onto the sandbox, reporting exactly which
 * fields the schema can carry so nothing disappears silently.
 * @param {unknown} input
 * @param {Launchpad} current
 */
export function specToLaunchpad(input, current) {
  const spec = validateSpec(input);
  const apps = /** @type {string[]} */ (spec.apps);
  const next = structuredClone(current);
  next.project.name = spec.config.title;
  next.project.tagline = spec.config.intro;
  next.project.theme = /** @type {LaunchpadTheme} */ (spec.config.theme);
  next.project.layout = /** @type {LaunchpadLayout} */ (spec.config.layout);
  next.blocks.profile = apps.includes("showcase");
  next.blocks.guestbook = apps.includes("guestbook");
  next.blocks.gallery = false;
  next.links = /** @type {LaunchLink[]} */ (spec.cards ?? []).map((card, index) => ({
    id: `link-${index + 1}`,
    label: card.title,
    url: card.url,
  }));
  const carried = ["Project name", "Introduction", "Theme", "Layout", "Links", "Enabled blocks"];
  const notCarried = [
    "Accent colour is not part of the blueprint and was kept as it is.",
    "Pending and hidden contributions are browser-only and were kept as they are.",
  ];
  if (current.blocks.gallery)
    notCarried.push("The preview-only Media Studio gallery was turned off.");
  return { state: next, carried, notCarried };
}

/**
 * A portable instruction for the owner's chosen agent. It repeats the boundary
 * that matters: a blueprint is a brief, not a deployment.
 * @param {Launchpad} state
 */
export function agentPrompt(state) {
  const exported = launchpadSpec(state);
  const enabled = Object.entries(state.blocks)
    .filter(([, on]) => on)
    .map(([key]) => blockLabels[/** @type {keyof Blocks} */ (key)]);
  return [
    `# Build my App Composer project: ${state.project.name || "My project"}`,
    "",
    "Use the exported versioned blueprint in this same conversation. It is the source of truth for the fields it covers.",
    "",
    "## What I chose",
    `- Name: ${state.project.name || "My project"}`,
    `- Introduction: ${state.project.tagline || "(none)"}`,
    `- Blocks: ${enabled.join(", ") || "(none selected)"}`,
    `- Theme: ${state.project.theme}`,
    `- Layout: ${state.project.layout}`,
    `- Review before anything is public: yes`,
    "",
    "## What I need from you",
    "1. Inspect my existing environment, repository and Cloudflare account before changing anything.",
    "2. Create or update my own copy of the selected blocks. Keep my source, data and configuration under my ownership.",
    "3. Apply the exported settings, then show me the changed result and the exact live address.",
    "4. Stop before any spend, new account, new domain or destructive change and ask me.",
    "",
    "## Not covered by this blueprint",
    ...exported.notCarried.map((note) => `- ${note}`),
    "",
    "This brief is not a deployment. Nothing has been built or published from the browser sandbox.",
  ].join("\n");
}
