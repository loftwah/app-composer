// Versioned, portable Creator Hub blueprints. A blueprint names the locked apps
// it needs and the evidence behind it; it never carries a credential, grants
// permission or deploys anything. Source pins are read from the active
// composition lock so a blueprint cannot drift from the apps actually mounted.
import lock from "../../composition.lock.json" with { type: "json" };
import { selectedSources } from "./app-settings.mjs";
import { presets, validateSpec } from "./spec.mjs";

export const blueprintsVersion = 1;
export const blueprintStates = ["reference", "evidence-pending", "ready"];
export const blueprintKeys = [
  "id",
  "version",
  "name",
  "summary",
  "state",
  "preset",
  "apps",
  "requires",
  "evidence",
  "limits",
];

// One record per blueprint. Everything here is publishable: no private
// metadata, no owner identifiers, no provider keys and no unverified claim.
export const blueprints = [
  {
    id: "creator-hub",
    version: 1,
    name: "Creator Hub",
    summary:
      "A home for your work. A moderated photo guestbook collects contributions, and a Linkarooie profile features the ones you approve.",
    state: "reference",
    preset: "composition",
    apps: ["guestbook", "showcase"],
    requires: [
      "Get Ready has checked your agent, GitHub access and Cloudflare account.",
      "Each app keeps its own repository, database and media storage.",
      "The owner reviews every contribution before it can be public.",
    ],
    evidence: [
      {
        label: "Creator Hub reference",
        url: "https://composer.loftwah.com/creator-hub",
        observed: "Describes the published guestbook and profile pair.",
      },
      {
        label: "Live guestbook",
        url: "https://creator-hub-guestbook.loftwah.com",
        observed: "Deployed on its own host with owner moderation.",
      },
      {
        label: "Composition lock",
        url: "https://github.com/loftwah/app-composer/blob/main/composition.lock.json",
        observed: "Exact source revision for each mounted app.",
      },
    ],
    limits: [
      "This blueprint is a brief. Opening it in Init prepares settings; it does not deploy.",
      "No independent owner has rebuilt this blueprint on their own Cloudflare account yet, so it stays a reference rather than a proven repeatable build.",
      "The preview-only Media Studio gallery in the /demo sandbox is not part of this blueprint.",
    ],
  },
];

/** @param {string} text */
function https(text) {
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Reject a blueprint that names an unsupported app, carries anything
 * credential-shaped or makes a claim the catalogue cannot back.
 * @param {any} input
 */
export function validateBlueprint(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A blueprint must be an object");
  for (const key of Object.keys(input))
    if (!blueprintKeys.includes(key))
      throw new Error(`Unknown blueprint field: ${key}`);
  for (const key of blueprintKeys)
    if (input[key] === undefined) throw new Error(`Missing blueprint field: ${key}`);
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    throw new Error("Blueprint version must be a positive integer");
  if (typeof input.id !== "string" || !/^[a-z0-9-]+$/.test(input.id))
    throw new Error("Blueprint id must be lowercase letters, digits or dashes");
  for (const key of ["name", "summary"])
    if (typeof input[key] !== "string" || !input[key].trim())
      throw new Error(`Blueprint ${key} is required`);
  if (!blueprintStates.includes(input.state))
    throw new Error("Choose a supported blueprint state");
  if (!Object.hasOwn(presets, input.preset))
    throw new Error("Choose a supported preset");
  if (!Array.isArray(input.apps) || input.apps.length === 0)
    throw new Error("A blueprint needs at least one app");
  const expected = presets[input.preset].apps;
  if (
    input.apps.length !== expected.length ||
    !expected.every((/** @type {string} */ id) => input.apps.includes(id))
  )
    throw new Error(`Preset ${input.preset} requires ${expected.join(" + ")}`);
  const texts = (/** @type {unknown} */ value, /** @type {string} */ label) => {
    if (!Array.isArray(value) || value.length === 0)
      throw new Error(`${label} must be a non-empty list`);
    if (value.some((entry) => typeof entry !== "string" || !entry.trim()))
      throw new Error(`${label} must contain non-empty text`);
  };
  texts(input.requires, "Blueprint requires");
  texts(input.limits, "Blueprint limits");
  if (!Array.isArray(input.evidence) || input.evidence.length === 0)
    throw new Error("A blueprint needs at least one evidence entry");
  for (const entry of input.evidence) {
    if (!entry || typeof entry.label !== "string" || !entry.label.trim())
      throw new Error("Each evidence entry needs a label");
    if (!https(entry.url)) throw new Error("Evidence must be an https address");
    if (typeof entry.observed !== "string" || !entry.observed.trim())
      throw new Error("Each evidence entry needs an observation");
  }
  return input;
}

/** @param {string} id */
export function blueprint(id) {
  const found = blueprints.find((entry) => entry.id === id);
  if (!found) return undefined;
  return validateBlueprint(found);
}

/**
 * The locked source revision for each app in a blueprint. An app that is not
 * mounted has no pin, and the blueprint cannot pretend otherwise.
 * @param {any} entry
 */
export function blueprintSources(entry) {
  const pinned = lock.apps;
  return entry.apps.map((/** @type {string} */ id) => {
    const app = pinned.find((/** @type {any} */ candidate) => candidate.id === id);
    if (!app) throw new Error(`Blueprint app is not mounted: ${id}`);
    return {
      id,
      name: app.manifest.name,
      repository: app.repository,
      commit: app.commit,
      short: String(app.commit).slice(0, 10),
      url: app.url,
    };
  });
}

/**
 * A blueprint is only "ready" when every app is mounted and every evidence
 * address resolves to https. This is a catalogue-level claim, not a build proof.
 * @param {any} entry
 */
export function blueprintReadiness(entry) {
  try {
    const sources = blueprintSources(entry);
    if (entry.evidence.some((/** @type {any} */ item) => !https(item.url)))
      return { state: "evidence-pending", sources, reason: "Evidence needs an https address." };
    if (entry.state === "reference")
      return {
        state: "reference",
        sources,
        reason: "No independent owner has replayed this build yet.",
      };
    return { state: "ready", sources, reason: "All apps are mounted at exact revisions." };
  } catch (error) {
    return {
      state: "evidence-pending",
      sources: [],
      reason: error instanceof Error ? error.message : "Blueprint is incomplete.",
    };
  }
}

/**
 * The same versioned specification Init consumes. A blueprint never adds
 * settings the current schema cannot carry.
 * @param {any} entry
 * @param {{title?: string, intro?: string}} overrides
 */
export function blueprintSpec(entry, overrides = {}) {
  const blueprintValue = validateBlueprint(entry);
  const defaults = presets[blueprintValue.preset];
  return validateSpec({
    version: 2,
    preset: blueprintValue.preset,
    sources: selectedSources(blueprintValue.apps),
    appSettings: {},
    config: {
      title: overrides.title ?? defaults.title,
      intro: overrides.intro ?? defaults.intro,
      theme: "daylight",
      layout: "grid",
    },
    privacy: "review-first",
    deployment: { mode: "preview", hostname: "" },
    cards: [],
    decisions: { goal: blueprintValue.preset, privacy: "review-first" },
  });
}
