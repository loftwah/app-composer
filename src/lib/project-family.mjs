// The Composer project family reads the dated portfolio inventory at build
// time. Every row is provenance: the tier says what Composer actually has with
// the project, not what the product would like to claim. Nothing here fetches a
// live URL, so the recorded status is the status the reader sees.
import inventory from "../../docs/portfolio/woodhouse-inventory-20261116.json" with { type: "json" };

export const inventoryPath = "docs/portfolio/woodhouse-inventory-20261116.json";

// Strongest integration first. An empty tier stays visible instead of being
// hidden, because "we have none of these yet" is the honest answer.
export const relationshipTiers = Object.freeze([
  Object.freeze({
    id: "built-with-composer",
    label: "Built with Composer",
    meaning:
      "A Composer brief produced the app's own source and a build record names the result. This is the strongest claim here and needs a real receipt.",
    empty: "No project record carries a Composer build receipt yet.",
  }),
  Object.freeze({
    id: "connected-managed",
    label: "Connected and managed",
    meaning:
      "The app publishes a versioned manifest and Composer connects to it for scoped work. Its source, data and release stay with its owner.",
    empty: "No project record is registered as a connected app yet.",
  }),
  Object.freeze({
    id: "blueprint-rebuildable",
    label: "Blueprint-rebuildable",
    meaning:
      "A shipped, pinned blueprint can rebuild a faithful slice on another owner's account. The two current blueprints are reference recipes that no independent owner has replayed, and neither rebuilds these project records.",
    empty:
      "The two shipped blueprints rebuild Composer reference apps, not these Woodhouse project records.",
  }),
  Object.freeze({
    id: "showcased",
    label: "Showcased",
    meaning:
      "Presented here from a dated, verified public record. This inventory records no Composer build, connection or project blueprint for it.",
    empty: "No current project record is presented here.",
  }),
  Object.freeze({
    id: "legacy",
    label: "Legacy record",
    meaning:
      "A paused or retired Woodhouse record kept for provenance. Its links may still work, but it is retained as history rather than presented as current work.",
    empty: "No paused or retired project record is kept here.",
  }),
]);

const tierIds = new Set(relationshipTiers.map((tier) => tier.id));

/** @param {string} value */
function https(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Turn one inventory project into the row the page renders. Unknown values stay
 * null so the page can say "not recorded" instead of inventing a link.
 * @param {any} project
 * @param {any[]} blueprints
 */
function projectRow(project, blueprints) {
  const relationship = project?.relationship;
  const tier = relationship?.tier;
  if (!relationship || typeof relationship !== "object" || Array.isArray(relationship)) {
    throw new Error(`${inventoryPath}: project ${project?.id ?? "(unknown)"} needs a relationship record`);
  }
  if (!tierIds.has(tier)) {
    throw new Error(
      `${inventoryPath}: project ${project?.id ?? "(unknown)"} has no supported relationship tier`,
    );
  }
  if (typeof relationship.evidence !== "string" || !relationship.evidence.trim()) {
    throw new Error(`${inventoryPath}: project ${project.id} needs a relationship evidence note`);
  }
  if (!Object.hasOwn(relationship, "canonicalUrl")) {
    throw new Error(`${inventoryPath}: project ${project.id} needs a canonicalUrl or null`);
  }
  if (relationship.canonicalUrl !== null && !https(relationship.canonicalUrl)) {
    throw new Error(`${inventoryPath}: project ${project.id} has an unsafe canonical URL`);
  }
  if (relationship.canonicalUrl === null && project.live) {
    throw new Error(`${inventoryPath}: project ${project.id} records a live entry but no canonical URL`);
  }

  // A blueprint link is emitted only when a shipped blueprint names the same
  // app id. No current blueprint does, so the page says "not recorded".
  const blueprint = blueprints.find(
    (entry) => Array.isArray(entry?.apps) && entry.apps.includes(project.id),
  );

  return {
    id: project.id,
    name: project.name,
    summary: project.summary,
    discipline: project.discipline,
    lifecycle: project.lifecycle,
    state: project.state,
    reviewed: project.reviewed,
    tier,
    evidence: relationship.evidence.trim(),
    canonicalUrl: relationship.canonicalUrl,
    live: project.live
      ? {
          status: project.live.status,
          finalUrl: project.live.finalUrl,
          title: project.live.title,
          observedAt: project.live.observedAt,
        }
      : null,
    probe: project.probe
      ? {
          url: project.probe.url,
          status: project.probe.status,
          title: project.probe.title,
          observedAt: project.probe.observedAt,
          reason: project.probe.reason,
        }
      : null,
    sourcePin: project.deployedSource?.value ?? null,
    sourceObservedAt: project.deployedSource?.value
      ? project.deployedSource.observedAt
      : null,
    sourceNote: project.deployedSource?.value
      ? project.deployedSource.evidence
      : project.deployedSource?.reason,
    dossier: project.dossier,
    blueprint: blueprint ? { id: blueprint.id, recipe: blueprint.recipe } : null,
  };
}

/**
 * Group the inventory's project records by their recorded relationship tier.
 * A malformed inventory throws instead of rendering a plausible empty page.
 * @param {any} [doc]
 */
export function projectFamily(doc = inventory) {
  if (!doc || !Array.isArray(doc.projects)) {
    throw new Error(`${inventoryPath}: projects must be a list`);
  }

  /** @type {Map<string, any[]>} */
  const rows = new Map(relationshipTiers.map((tier) => [tier.id, []]));
  for (const project of doc.projects) {
    const row = projectRow(project, Array.isArray(doc.blueprints) ? doc.blueprints : []);
    rows.get(row.tier)?.push(row);
  }

  return {
    asOf: doc.asOf,
    title: doc.title,
    total: doc.projects.length,
    groups: relationshipTiers.map((tier) => ({
      ...tier,
      projects: rows.get(tier.id) ?? [],
    })),
  };
}

/** A recorded instant as a plain date, for the same label used elsewhere. */
export function recordedDay(value) {
  return typeof value === "string" && value.includes("T") ? value.slice(0, 10) : null;
}
