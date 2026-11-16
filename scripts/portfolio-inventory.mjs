// The dated Woodhouse portfolio inventory is publishable data: every project
// record, a real live-entry check and only the source identities an app or a
// public repository actually publishes. This checker keeps the record honest
// and catches drift between a blueprint pin and the recipe that explains it.
//
//   --check    validate the committed inventory and its recipe (offline)
//   --verify   re-read the live snapshot, entry points, builds and public heads
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const INVENTORY = "docs/portfolio/woodhouse-inventory-20261116.json";
export const RECIPE = "docs/portfolio/blueprints.md";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = (path) => JSON.parse(read(path));

const SHA = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9-]+$/;
const LIFECYCLES = new Set(["active", "paused", "retired"]);
const STATES = new Set(["reference", "evidence-pending", "ready"]);

// The integration tier is a provenance claim, not a roadmap. A project only
// reaches a stronger tier when the inventory carries the record that backs it.
export const RELATIONSHIP_TIERS = Object.freeze([
  "built-with-composer",
  "connected-managed",
  "blueprint-rebuildable",
  "showcased",
  "legacy",
]);
const RELATIONSHIP_KEYS = new Set(["tier", "evidence", "canonicalUrl"]);

function https(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function date(value) {
  return typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function instant(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && value.includes("T");
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** All 40-character revisions named in a markdown document. */
export function revisionsIn(markdown) {
  return [...String(markdown).matchAll(/\b[0-9a-f]{40}\b/g)].map((match) => match[0]);
}

function section(markdown, anchor) {
  const parts = String(markdown).split(/^## /m);
  const found = parts.find((part) => part.split("\n")[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === anchor);
  return found ?? "";
}

/**
 * Validate the committed record. Returns a list of human-readable problems; an
 * empty list means the inventory, its pins and its recipe agree.
 *
 * @param {any} doc
 * @param {{lock?: any, mediaStudio?: any, recipe?: string}} [options]
 */
export function checkInventory(doc, options = {}) {
  const problems = [];
  const fail = (message) => problems.push(message);
  const lock = options.lock ?? readJson("composition.lock.json");
  const mediaStudio = options.mediaStudio ?? readJson("config/media-studio-standalone.json");
  const recipe = options.recipe ?? read(RECIPE);

  if (doc?.schema !== "composer.portfolio-inventory/1") fail("schema must be composer.portfolio-inventory/1");
  if (!date(doc?.asOf)) fail("asOf must be a real YYYY-MM-DD date");
  if (!text(doc?.title)) fail("title is required");
  if (!text(doc?.method?.summary)) fail("method.summary is required");
  if (!text(doc?.method?.liveRequests)) fail("method.liveRequests is required");
  if (!text(doc?.method?.repositoryChecks)) fail("method.repositoryChecks is required");
  if (!text(doc?.method?.identityChecks)) fail("method.identityChecks is required");
  if (!Array.isArray(doc?.method?.boundaries) || doc.method.boundaries.length < 2) fail("method.boundaries must hold at least two statements");

  const snapshot = doc?.method?.snapshot;
  if (!snapshot) fail("method.snapshot is required");
  else {
    if (!https(snapshot.url)) fail("snapshot.url must be https");
    if (snapshot.status !== 200) fail("snapshot.status must be 200");
    if (!/^[0-9a-f]{64}$/.test(snapshot.sha256 ?? "")) fail("snapshot.sha256 must be a 64-character digest");
    if (!Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 1) fail("snapshot.bytes must be positive");
    if (!date(snapshot.reviewed)) fail("snapshot.reviewed must be a date");
    if (!date(snapshot.currentAsOf)) fail("snapshot.currentAsOf must be a date");
    if (!text(snapshot.recordType)) fail("snapshot.recordType is required");
    if (!Number.isSafeInteger(snapshot.projectCount) || snapshot.projectCount < 1) fail("snapshot.projectCount must be positive");
    if (!Array.isArray(snapshot.projectIds) || snapshot.projectIds.some((id) => !ID.test(id))) fail("snapshot.projectIds must be ids");
    if (!instant(snapshot.retrievedAt)) fail("snapshot.retrievedAt must be an instant");
  }
  const index = doc?.method?.index;
  if (!index) fail("method.index is required");
  else {
    if (!https(index.url)) fail("index.url must be https");
    if (index.status !== 200) fail("index.status must be 200");
    if (!/^[0-9a-f]{64}$/.test(index.sha256 ?? "")) fail("index.sha256 must be a 64-character digest");
    if (!Number.isSafeInteger(index.bytes) || index.bytes < 1) fail("index.bytes must be positive");
  }

  if (!Array.isArray(doc?.projects)) fail("projects must be a list");
  const projects = Array.isArray(doc?.projects) ? doc.projects : [];
  const ids = new Set();
  const canonicalUrls = new Map();
  for (const [position, entry] of projects.entries()) {
    const where = `project ${entry?.id ?? `#${position + 1}`}`;
    if (!ID.test(entry?.id ?? "")) fail(`${where}: id must be lowercase letters, digits or dashes`);
    if (ids.has(entry.id)) fail(`${where}: duplicate id`);
    ids.add(entry.id);
    for (const key of ["name", "summary", "state", "current", "nextProof", "proofBoundary", "discipline"])
      if (!text(entry?.[key])) fail(`${where}: ${key} is required`);
    if (!LIFECYCLES.has(entry?.lifecycle)) fail(`${where}: lifecycle must be active, paused or retired`);
    if (!date(entry?.reviewed)) fail(`${where}: reviewed must be a date`);
    if (entry?.dossier !== `https://woodhouse.loftwah.com/projects/${entry?.id}/`) fail(`${where}: dossier must be the canonical Woodhouse URL`);

    checkRelationship(entry, where, fail, canonicalUrls);

    checkRecord(entry?.statusRecord, `${where}: statusRecord`, 200, fail);
    if (entry?.live) checkRecord(entry.live, `${where}: live`, 200, fail);
    else if (entry?.probe) {
      if (!https(entry.probe.url) || entry.probe.status < 400) fail(`${where}: a probe is only for a failed entry point`);
      if (!text(entry.probe.title) || !instant(entry.probe.observedAt) || !text(entry.probe.request)) fail(`${where}: probe needs title, observedAt and request`);
      if (!text(entry.probe.reason)) fail(`${where}: a failed probe needs a reason`);
    } else fail(`${where}: a live record or a failed probe is required`);

    checkRepository(entry?.repository, where, fail);
    checkDeployedSource(entry?.deployedSource, where, fail);
  }

  const sourceIds = [...(snapshot?.projectIds ?? [])].sort().join(",");
  const projectIds = [...ids].sort().join(",");
  if (sourceIds !== projectIds) fail("projects must cover exactly snapshot.projectIds");
  if (snapshot?.projectCount !== projects.length) fail("snapshot.projectCount must equal the project list length");

  if (!Array.isArray(doc?.connected)) fail("connected must be a list");
  const connectedEntries = Array.isArray(doc?.connected) ? doc.connected : [];
  for (const entry of connectedEntries) {
    const where = `connected ${entry?.id}`;
    if (!["guestbook", "showcase", "media-studio"].includes(entry?.id)) fail(`${where}: unsupported connected app`);
    checkRecord(entry?.live, `${where}: live`, 200, fail);
    checkRepository(entry?.repository, where, fail);
    checkDeployedSource(entry?.deployedSource, where, fail);
    if (!SHA.test(entry?.lockedSource?.commit ?? "")) fail(`${where}: lockedSource.commit must be a full revision`);
    if (!text(entry?.lockedSource?.declaredIn)) fail(`${where}: lockedSource.declaredIn is required`);
    if (!text(entry?.pinNote)) fail(`${where}: pinNote is required`);
  }
  if ((doc?.connected ?? []).length !== 3) fail("connected must list guestbook, showcase and media-studio");

  if (!Array.isArray(doc?.surfaces) || doc.surfaces.length !== 1) fail("surfaces must hold Woodhouse");
  const surfaceEntries = Array.isArray(doc?.surfaces) ? doc.surfaces : [];
  for (const entry of surfaceEntries) {
    checkRecord(entry?.live, "surface woodhouse: live", 200, fail);
    checkRepository(entry?.repository, "surface woodhouse", fail);
    checkDeployedSource(entry?.deployedSource, "surface woodhouse", fail);
  }

  const lockApps = new Map((lock.apps ?? []).map((app) => [app.id, app]));
  const declaredPins = new Set();
  const anchors = new Set();
  if (!Array.isArray(doc?.blueprints)) fail("blueprints must be a list");
  const blueprintEntries = Array.isArray(doc?.blueprints) ? doc.blueprints : [];
  for (const blueprint of blueprintEntries) {
    const where = `blueprint ${blueprint?.id}`;
    if (!STATES.has(blueprint?.state)) fail(`${where}: unsupported state`);
    if (typeof blueprint?.replayed !== "boolean") fail(`${where}: replayed must be a boolean`);
    if (blueprint?.state === "ready" && blueprint?.replayed !== true) fail(`${where}: ready requires a replay`);
    if (blueprint?.state !== "ready" && blueprint?.replayed === true) fail(`${where}: a replayed build cannot stay below ready`);
    if (!text(blueprint?.replayNote)) fail(`${where}: replayNote is required`);
    const recipePath = String(blueprint?.recipe ?? "");
    const [file, anchor] = recipePath.split("#");
    if (file !== RECIPE || !anchor) fail(`${where}: recipe must point into ${RECIPE}`);
    else {
      anchors.add(anchor);
      const body = section(recipe, anchor);
      if (!body) fail(`${where}: recipe section #${anchor} is missing`);
      else if (!/Replay status:.*not replayed/is.test(body)) fail(`${where}: recipe must label the build as not replayed`);
    }
    if (!Array.isArray(blueprint?.pins) || blueprint.pins.length < 1) fail(`${where}: pins are required`);
    for (const pin of blueprint?.pins ?? []) {
      declaredPins.add(pin.commit);
      if (!SHA.test(pin?.commit ?? "")) fail(`${where}: ${pin?.app} pin must be a full revision`);
      if (!https(pin?.repository)) fail(`${where}: ${pin?.app} repository must be https`);
      if (!text(pin?.declaredIn)) fail(`${where}: ${pin?.app} declaredIn is required`);
      const source = pin?.app === "media-studio" ? mediaStudio.source : lockApps.get(pin?.app);
      if (!source) fail(`${where}: ${pin?.app} is not a declared source`);
      else {
        if (source.commit !== pin.commit) fail(`${where}: ${pin?.app} pin ${pin.commit} does not match ${pin.declaredIn}`);
        if (source.repository !== pin.repository) fail(`${where}: ${pin?.app} repository does not match ${pin.declaredIn}`);
      }
    }
  }
  const expectedPins = [
    ...(lock.apps ?? []).map((app) => app.commit),
    mediaStudio.source?.commit,
  ].filter(Boolean);
  for (const commit of expectedPins) if (!declaredPins.has(commit)) fail(`blueprints omit the declared source ${commit}`);

  const observedRevisions = new Set([
    ...declaredPins,
    ...(doc?.connected ?? []).map((entry) => entry?.deployedSource?.value).filter(Boolean),
    ...projects.map((entry) => entry?.deployedSource?.value).filter(Boolean),
  ]);
  for (const revision of revisionsIn(recipe)) {
    if (!observedRevisions.has(revision)) fail(`recipe names a revision that is neither a declared pin nor an observed identity: ${revision}`);
  }
  const namedInRecipe = new Set(revisionsIn(recipe));
  for (const pin of declaredPins) if (!namedInRecipe.has(pin)) fail(`recipe omits the declared pin ${pin}`);
  for (const anchor of anchors) if (!section(recipe, anchor)) fail(`recipe section #${anchor} is missing`);

  return problems;
}

function checkRelationship(entry, where, fail, canonicalUrls) {
  const relationship = entry?.relationship;
  if (!relationship || typeof relationship !== "object" || Array.isArray(relationship))
    return fail(`${where}: relationship is required`);
  for (const key of Object.keys(relationship))
    if (!RELATIONSHIP_KEYS.has(key)) fail(`${where}: relationship has an unsupported field: ${key}`);
  if (!RELATIONSHIP_TIERS.includes(relationship.tier))
    fail(`${where}: relationship tier must be one of ${RELATIONSHIP_TIERS.join(", ")}`);
  if (!text(relationship.evidence)) fail(`${where}: relationship evidence is required`);
  if (!Object.hasOwn(relationship, "canonicalUrl"))
    return fail(`${where}: relationship canonicalUrl must be an https URL or null`);

  const canonical = relationship.canonicalUrl;
  if (canonical === null) {
    if (entry.live) fail(`${where}: an unknown canonical URL contradicts the recorded live entry point`);
    return;
  }
  if (!https(canonical)) return fail(`${where}: relationship canonicalUrl must be an https URL or null`);
  if (!entry.live) return fail(`${where}: a canonical URL requires a recorded live entry point`);
  if (!text(entry.live.finalUrl) || new URL(canonical).href !== new URL(entry.live.finalUrl).href)
    fail(`${where}: canonical URL must match the recorded live finalUrl`);

  const key = new URL(canonical).href.replace(/\/$/, "");
  const alreadyRecorded = canonicalUrls.get(key);
  if (alreadyRecorded) fail(`${where}: duplicate canonical URL, already recorded for ${alreadyRecorded}`);
  else canonicalUrls.set(key, entry.id);
}

function checkRecord(record, where, expectedStatus, fail) {
  if (!record) return fail(`${where} is required`);
  if (!https(record.url)) fail(`${where}: url must be https`);
  if (record.status !== expectedStatus) fail(`${where}: status must be ${expectedStatus}`);
  if (record.finalUrl !== undefined && !https(record.finalUrl)) fail(`${where}: finalUrl must be https`);
  if (!text(record.title)) fail(`${where}: title is required`);
  if (!instant(record.observedAt)) fail(`${where}: observedAt must be an instant`);
  if (!text(record.request) || !record.request.startsWith("GET ")) fail(`${where}: request must name the GET`);
}

function checkRepository(repository, where, fail) {
  if (!repository) return fail(`${where}: repository is required`);
  if (repository.visibility === "public") {
    if (!https(repository.url) || !repository.url.startsWith("https://github.com/")) fail(`${where}: public repository must be a GitHub URL`);
    if (!SHA.test(repository.head ?? "")) fail(`${where}: public repository needs a full HEAD`);
    if (!instant(repository.headObservedAt)) fail(`${where}: public repository needs headObservedAt`);
    if (!(repository.license === null || text(repository.license))) fail(`${where}: license must be a name or null`);
    return;
  }
  if (repository.visibility !== "private") return fail(`${where}: repository visibility must be public or private`);
  if (repository.published !== false) fail(`${where}: a private repository must set published: false`);
  if (repository.url !== undefined || repository.head !== undefined) fail(`${where}: a private repository must not publish a URL or HEAD`);
  if (!text(repository.reason)) fail(`${where}: a private repository needs a reason`);
}

function checkDeployedSource(source, where, fail) {
  if (!source) return fail(`${where}: deployedSource is required`);
  if (source.value === null) {
    if (!text(source.reason)) fail(`${where}: an unknown deployed source needs a reason`);
    return;
  }
  if (!SHA.test(source.value ?? "")) fail(`${where}: deployed source must be a full revision or null`);
  if (!text(source.evidence)) fail(`${where}: a deployed source needs evidence`);
  if (!instant(source.observedAt)) fail(`${where}: a deployed source needs observedAt`);
}

/** @param {string} [path] */
export function loadInventory(path = INVENTORY) {
  return readJson(path);
}

async function get(url, { json = false } = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "AppComposer-Inventory/1.0 (+https://composer.loftwah.com)",
      accept: json ? "application/json" : "*/*",
    },
    signal: AbortSignal.timeout(25000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const body = bytes.toString("utf8");
  let parsed;
  if (json) {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = undefined;
    }
  }
  return {
    status: response.status,
    finalUrl: response.url,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    title: body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    body,
    parsed,
  };
}

/**
 * Re-read what the inventory claims to have observed. A changed snapshot or a
 * moved repository is a prompt to refresh the dated record, not an incident.
 * @param {any} doc
 */
export async function verifyInventory(doc) {
  const findings = [];
  const note = (message) => findings.push(message);
  const snapshot = doc.method.snapshot;
  const current = await get(snapshot.url, { json: true });
  if (current.sha256 !== snapshot.sha256) note(`snapshot changed: ${snapshot.sha256} -> ${current.sha256} (${current.bytes} bytes)`);
  if (current.status !== 200) note(`snapshot status ${current.status}`);
  const index = await get(doc.method.index.url);
  if (index.sha256 !== doc.method.index.sha256) note(`index changed: ${doc.method.index.sha256} -> ${index.sha256} (${index.bytes} bytes)`);

  for (const entry of [...doc.projects, ...doc.connected, ...doc.surfaces]) {
    const live = entry.live;
    if (!live) continue;
    const observed = await get(live.url);
    if (observed.status !== live.status) note(`${entry.id}: live status ${live.status} -> ${observed.status}`);
    if (observed.title !== live.title) note(`${entry.id}: title changed: ${JSON.stringify(live.title)} -> ${JSON.stringify(observed.title)}`);
  }
  for (const entry of doc.projects) {
    const observed = await get(entry.statusRecord.url);
    if (observed.status !== 200) note(`${entry.id}: status record returned ${observed.status}`);
  }

  const builds = [
    ...doc.connected.map((entry) => [entry.id, entry.live.url.replace(/\/$/, "") + "/build.json", entry.deployedSource.value]),
    ["app-composer", "https://composer.loftwah.com/build.json", doc.projects.find((entry) => entry.id === "app-composer")?.deployedSource?.value],
  ];
  for (const [id, url, expected] of builds) {
    if (!expected) continue;
    const observed = await get(url, { json: true });
    const revision = observed.parsed?.revision ?? observed.parsed?.commit;
    if (observed.status !== 200 || revision !== expected) note(`${id}: build revision ${expected} -> ${revision ?? `HTTP ${observed.status}`}`);
  }

  const metaBuilds = [
    ["fighter", "https://fighter.loftwah.com/", "loftwah-fighter-build"],
    ["asset-hunter", "https://assets.loftwah.com/", "asset-hunter:commit"],
  ];
  for (const [id, url, name] of metaBuilds) {
    const expected = doc.projects.find((entry) => entry.id === id)?.deployedSource?.value;
    if (!expected) continue;
    const observed = await get(url);
    const revision = observed.body.match(new RegExp(`<meta name="${name}" content="([0-9a-f]{40})"`))?.[1];
    if (revision !== expected) note(`${id}: page meta ${name} ${expected} -> ${revision ?? "missing"}`);
  }

  const repositories = [
    ...doc.projects.map((entry) => entry.repository),
    ...doc.connected.map((entry) => entry.repository),
    ...doc.surfaces.map((entry) => entry.repository),
  ].filter((repository) => repository.visibility === "public");
  for (const repository of repositories) {
    try {
      const head = execFileSync("git", ["ls-remote", `${repository.url}.git`, "HEAD"], { encoding: "utf8" }).trim().split(/\s+/)[0];
      if (head !== repository.head) note(`${repository.url}: HEAD ${repository.head} -> ${head}`);
    } catch {
      note(`${repository.url}: HEAD could not be read`);
    }
  }

  const age = Math.floor((Date.now() - Date.parse(`${doc.asOf}T00:00:00Z`)) / 86400000);
  console.log(`Checked ${doc.projects.length} project records, ${doc.connected.length} connected apps and ${repositories.length} public repositories; snapshot age ${age} day(s).`);
  for (const finding of findings) console.log(`- ${finding}`);
  if (!findings.length) console.log("Live sources match the dated inventory.");
  return findings;
}

export async function main(argv = process.argv.slice(2)) {
  const mode = argv[0] ?? "--check";
  const doc = loadInventory();
  if (mode === "--check") {
    const problems = checkInventory(doc);
    if (!problems.length) {
      console.log(`Portfolio inventory passed: ${doc.projects.length} dated project records; ${doc.blueprints.length} pinned blueprint(s).`);
      return 0;
    }
    console.error("Portfolio inventory failed:");
    for (const problem of problems) console.error(`- ${problem}`);
    return 1;
  }
  if (mode === "--verify") {
    const findings = await verifyInventory(doc);
    return findings.length ? 1 : 0;
  }
  console.error("usage: portfolio-inventory.mjs --check | --verify");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main());
