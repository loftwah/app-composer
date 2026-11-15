// MIT. Deterministic judging for the Benchmarks Studio comparison track.
//
// The point of this module is that a model's own claim that it finished is not
// evidence. Every trial is judged from the bytes it produced, using the same
// assertions for every configuration. Nothing here calls a provider, reads a
// network response or trusts a summary the agent wrote about itself.

/** The exact link set the frozen brief asks for. Order matters. */
export const REQUIRED_LINKS = [
  { label: "Latest release", url: "https://example.com/release" },
  { label: "Behind the scenes", url: "https://example.com/notes" },
  { label: "Get the newsletter", url: "https://example.com/subscribe" },
];

export const REQUIRED_TITLE = "Night Shift Radio";
export const REQUIRED_TAGLINE = "Two hours of quiet, made on a kitchen table.";
export const REQUIRED_FILES = ["index.html", "app.css", "app.json"];

/** @param {string} value */
function text(value) {
  return typeof value === "string" ? value : "";
}

/**
 * Every origin the page is allowed to reach. The three link targets are the
 * brief's own destinations; anything else is a new request the owner did not ask
 * for.
 */
function allowedUrls() {
  return new Set(REQUIRED_LINKS.map((link) => link.url));
}

/**
 * Strip the permitted link destinations before looking for other origins, so a
 * legitimate `href="https://example.com/release"` is not reported as a leak.
 * @param {string} html
 */
function externalReferences(html) {
  const permitted = allowedUrls();
  const found = new Set();
  const pattern = /\b(?:href|src|srcset|action|poster|data-src)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const value = match[1].trim();
    if (!value || value.startsWith("#")) continue;
    if (/^(?:mailto:|tel:)/i.test(value)) continue;
    if (permitted.has(value)) continue;
    if (/^(?:https?:)?\/\//i.test(value)) found.add(value);
    else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) found.add(value);
  }
  for (const match of html.matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)/gi)) {
    found.add(match[1]);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const value = match[1].trim();
    if (/^(?:data:|#)/i.test(value)) continue;
    found.add(value);
  }
  return [...found];
}

/** @param {number[]} values */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

/**
 * Judge one trial from the files it produced. Returns the full check list and a
 * status that only becomes `pass` when every assertion holds.
 * @param {{ files?: Record<string, string> }} input
 */
export function evaluateTrial(input = {}) {
  const files = input.files && typeof input.files === "object" ? input.files : {};
  const html = text(files["index.html"]);
  const css = text(files["app.css"]);
  const rawJson = text(files["app.json"]);

  /** @type {{id: string, name: string, status: "pass"|"fail", detail: string}[]} */
  const checks = [];
  /** @param {string} id @param {string} name @param {() => string} body */
  const assert = (id, name, body) => {
    try {
      checks.push({ id, name, status: "pass", detail: body() });
    } catch (error) {
      checks.push({
        id,
        name,
        status: "fail",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const missing = REQUIRED_FILES.filter((name) => !text(files[name]).trim());
  const extra = Object.keys(files).filter((name) => !REQUIRED_FILES.includes(name));

  assert("files-present", "The three required files exist", () => {
    if (missing.length > 0) throw new Error(`Missing or empty: ${missing.join(", ")}.`);
    if (extra.length > 0) throw new Error(`Produced files the brief did not ask for: ${extra.join(", ")}.`);
    return "index.html, app.css and app.json all present, and nothing else.";
  });

  /** @type {any} */
  let manifest = null;
  assert("manifest-schema", "app.json is a valid manifest with the required shape", () => {
    try {
      manifest = JSON.parse(rawJson);
    } catch (error) {
      throw new Error(`app.json is not JSON: ${error instanceof Error ? error.message : String(error)}.`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("app.json is not a JSON object.");
    }
    for (const key of ["title", "tagline", "theme"]) {
      if (typeof manifest[key] !== "string" || !manifest[key].trim()) {
        throw new Error(`app.json is missing a ${key} string.`);
      }
    }
    if (!["light", "dark"].includes(manifest.theme)) {
      throw new Error(`app.json theme is "${manifest.theme}", not light or dark.`);
    }
    if (!Array.isArray(manifest.links)) throw new Error("app.json links is not an array.");
    for (const [index, link] of manifest.links.entries()) {
      if (!link || typeof link.label !== "string" || typeof link.url !== "string") {
        throw new Error(`Link ${index + 1} is not a {label, url} pair.`);
      }
    }
    if (!Array.isArray(manifest.sections) || manifest.sections.length === 0) {
      throw new Error("app.json sections is not a non-empty array.");
    }
    return `${manifest.links.length} links, theme ${manifest.theme}, sections ${manifest.sections.join(" and ")}.`;
  });

  assert("manifest-content", "The manifest carries the given title, tagline and three links in order", () => {
    if (!manifest) throw new Error("No manifest to judge.");
    if (manifest.title !== REQUIRED_TITLE) {
      throw new Error(`Title is "${manifest.title}", not "${REQUIRED_TITLE}".`);
    }
    if (manifest.tagline !== REQUIRED_TAGLINE) {
      throw new Error(`Tagline is "${manifest.tagline}", not the brief's line.`);
    }
    if (manifest.links.length !== REQUIRED_LINKS.length) {
      throw new Error(`Manifest has ${manifest.links.length} links, not ${REQUIRED_LINKS.length}.`);
    }
    const wrong = REQUIRED_LINKS.filter(
      (link, index) => manifest.links[index]?.label !== link.label || manifest.links[index]?.url !== link.url,
    );
    if (wrong.length > 0) {
      throw new Error(`Links differ at: ${wrong.map((link) => link.label).join(", ")}.`);
    }
    return "Title, tagline and all three links match the brief exactly, in order.";
  });

  assert("page-shows-brief", "index.html shows the title, tagline and all three labels", () => {
    if (!html.trim()) throw new Error("index.html is empty.");
    if (!html.includes(REQUIRED_TITLE)) throw new Error("index.html does not contain the title.");
    if (!html.includes(REQUIRED_TAGLINE)) throw new Error("index.html does not contain the tagline.");
    const absent = REQUIRED_LINKS.filter((link) => !html.includes(link.label));
    if (absent.length > 0) throw new Error(`Missing link text: ${absent.map((link) => link.label).join(", ")}.`);
    return "Title, tagline and all three labels appear in the rendered markup.";
  });

  assert("stylesheet-linked", "index.html links app.css and app.css declares styling", () => {
    if (!/<link[^>]+href\s*=\s*["']\/?app\.css["']/i.test(html)) {
      throw new Error("index.html does not link app.css.");
    }
    if (!/\{[\s\S]*\}/.test(css)) throw new Error("app.css has no rule blocks.");
    return `app.css is linked and declares ${(css.match(/\{/g) ?? []).length} rule blocks.`;
  });

  assert("csp-compatible", "No script, no inline style attributes and no style blocks", () => {
    const problems = [];
    if (/<script\b/i.test(html)) problems.push("a <script> element");
    if (/<\/script>/i.test(html)) problems.push("a closing script tag");
    if (/<style\b/i.test(html)) problems.push("a <style> block");
    if (/\sstyle\s*=/i.test(html)) problems.push("an inline style attribute");
    if (/\son[a-z]+\s*=/i.test(html)) problems.push("an inline event handler attribute");
    if (/\bjavascript:/i.test(html)) problems.push("a javascript: URL");
    if (problems.length > 0) throw new Error(`Blocked by the site policy: ${problems.join(", ")}.`);
    return "No scripts, style blocks, inline style attributes or inline handlers.";
  });

  assert("no-external", "No requests to other origins", () => {
    const found = externalReferences(html);
    if (found.length > 0) throw new Error(`Other origins referenced: ${found.slice(0, 4).join(", ")}.`);
    return "Every reference stays on the three brief destinations or a relative path.";
  });

  assert("document-basics", "One h1, a declared language, a viewport meta and no empty links", () => {
    const h1 = (html.match(/<h1\b/gi) ?? []).length;
    if (h1 !== 1) throw new Error(`Found ${h1} h1 elements, expected 1.`);
    if (!/<html[^>]+lang\s*=\s*["'][a-zA-Z-]+["']/i.test(html)) throw new Error("The html element has no lang attribute.");
    if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(html)) throw new Error("No viewport meta tag.");
    if (!/<title>\s*\S[\s\S]*?<\/title>/i.test(html)) throw new Error("No non-empty <title>.");
    const emptyAnchor = /<a\b[^>]*>\s*<\/a>/i.test(html);
    if (emptyAnchor) throw new Error("A link has no text.");
    return "One h1, a declared language, a viewport meta, a title and no empty links.";
  });

  assert("sections-present", "The about and guestbook sections each have a heading", () => {
    for (const section of ["about", "guestbook"]) {
      const pattern = new RegExp(`<h[23][^>]*>[^<]*${section}[^<]*</h[23]>`, "i");
      const idPattern = new RegExp(`id\\s*=\\s*["']${section}["']`, "i");
      if (!pattern.test(html) && !idPattern.test(html)) {
        throw new Error(`No heading or anchor for the ${section} section.`);
      }
    }
    return "Both the about and guestbook sections are identifiable in the markup.";
  });

  const failed = checks.filter((check) => check.status === "fail");
  return {
    status: failed.length === 0 ? "pass" : "fail",
    checks,
    failed: failed.map((check) => check.id),
  };
}

/**
 * A take is usable when every assertion held and the run actually produced
 * files. Failures are kept: they are the interesting half of a comparison.
 * @param {{ status?: string, checks?: {status: string}[] }} trial
 */
export function isUsable(trial) {
  if (!trial || trial.status !== "pass") return false;
  const checks = Array.isArray(trial.checks) ? trial.checks : [];
  return checks.length > 0 && checks.every((check) => check.status === "pass");
}

/**
 * Roll a configuration's trials into the numbers the page shows. Costs are real
 * fields but "how much did one good take cost" is the only honest headline: a
 * cheap run that produced nothing did not save money.
 * @param {{ trials?: any[] }} configuration
 */
export function summariseConfiguration(configuration) {
  const trials = Array.isArray(configuration?.trials) ? configuration.trials : [];
  const usable = trials.filter(isUsable);
  const durations = trials
    .map((trial) => (trial.durationMs === null || trial.durationMs === undefined ? NaN : Number(trial.durationMs)))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const estimateValues = trials.map((trial) => trial?.cost?.estimateMicro).filter((value) => Number.isFinite(value));
  const estimateMicro = estimateValues.length === 0 ? null : estimateValues.reduce((total, value) => total + value, 0);
  const reportedMicro = trials.reduce((total, trial) => total + Number(trial?.cost?.providerChargedMicro ?? 0), 0);
  const reportedTrials = trials.filter((trial) => Number.isFinite(Number(trial?.cost?.providerChargedMicro))).length;
  const blocked = trials.filter((trial) => trial.status === "blocked").length;
  return {
    trials: trials.length,
    usable: usable.length,
    failed: trials.filter((trial) => trial.status === "fail").length,
    blocked,
    passRate: trials.length === 0 ? null : Math.round((usable.length / trials.length) * 100),
    medianDurationMs: median(durations),
    slowestDurationMs: durations.length === 0 ? null : Math.max(...durations),
    fastestDurationMs: durations.length === 0 ? null : Math.min(...durations),
    estimatedCostMicro: estimateMicro,
    reportedCostMicro: reportedTrials === 0 ? null : reportedMicro,
    reportedTrials,
    costPerUsableTakeMicro:
      usable.length === 0 || estimateMicro === null ? null : Math.round(estimateMicro / usable.length),
    failures: [...new Set(trials.flatMap((trial) => trial.failed ?? []))],
  };
}

/** @param {number|null} micro */
export function money(micro) {
  if (micro === null || micro === undefined || !Number.isFinite(Number(micro))) return "unknown";
  const value = Number(micro) / 1_000_000;
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/**
 * A verdict for one job, not a leaderboard. It names the strongest trade-off the
 * recorded numbers actually support, and refuses to declare a winner when the
 * evidence cannot separate the configurations.
 * @param {any[]} configurations
 */
export function verdictFor(configurations) {
  const rows = (Array.isArray(configurations) ? configurations : []).map((configuration) => ({
    id: configuration.id,
    label: configuration.label ?? configuration.id,
    summary: summariseConfiguration(configuration),
  }));
  const judged = rows.filter((row) => row.summary.trials > 0);
  if (judged.length === 0) {
    return { headline: "No trials recorded yet", detail: "Nothing has been run, so there is no verdict to give.", comparable: false };
  }
  if (judged.length === 1) {
    const [only] = judged;
    return {
      headline: `${only.label}: ${only.summary.usable} of ${only.summary.trials} usable`,
      detail: "One configuration ran. That is a check, not a comparison.",
      comparable: false,
      lead: only.id,
    };
  }

  const allUsable = judged.every((row) => row.summary.usable === row.summary.trials && row.summary.trials > 0);
  const anyoneUsable = judged.some((row) => row.summary.usable > 0);
  if (!anyoneUsable) {
    return {
      headline: "Neither configuration produced a usable take",
      detail: "Both failed the same frozen assertions. The weakness is in the brief or the harness, not the model choice.",
      comparable: true,
    };
  }

  const byUsable = [...judged].sort(
    (a, b) => b.summary.usable - a.summary.usable || (b.summary.passRate ?? 0) - (a.summary.passRate ?? 0),
  );
  const best = byUsable[0];
  const worst = byUsable[byUsable.length - 1];

  if (best.summary.passRate === worst.summary.passRate) {
    const rate =
    judged.length > 2
      ? `${judged.map((row) => `${row.summary.usable} of ${row.summary.trials} for ${row.label}`).join(", ")}`
      : `${best.summary.usable} of ${best.summary.trials} usable takes for ${best.label} and ${worst.summary.usable} of ${worst.summary.trials} for ${worst.label}`;

    const costed = judged.filter((row) => row.summary.costPerUsableTakeMicro !== null);
    const distinctCosts = new Set(costed.map((row) => row.summary.costPerUsableTakeMicro));
    if (costed.length >= 2 && distinctCosts.size > 1) {
      const cheapest = [...costed].sort(
        (a, b) => a.summary.costPerUsableTakeMicro - b.summary.costPerUsableTakeMicro,
      )[0];
      const dearest = [...costed].sort(
        (a, b) => b.summary.costPerUsableTakeMicro - a.summary.costPerUsableTakeMicro,
      )[0];
      return {
        headline: "Same reliability, different price",
        detail: `${rate}. ${cheapest.label} costs ${money(cheapest.summary.costPerUsableTakeMicro)} per usable take against ${money(dearest.summary.costPerUsableTakeMicro)}.`,
        comparable: true,
        lead: cheapest.id,
      };
    }

    const timed = judged.filter((row) => row.summary.medianDurationMs !== null);
    const distinctTimes = new Set(timed.map((row) => row.summary.medianDurationMs));
    if (timed.length >= 2 && distinctTimes.size > 1) {
      const fastest = [...timed].sort((a, b) => a.summary.medianDurationMs - b.summary.medianDurationMs)[0];
      const slowest = [...timed].sort((a, b) => b.summary.medianDurationMs - a.summary.medianDurationMs)[0];
      const untimed = judged.filter((row) => row.summary.medianDurationMs === null).map((row) => row.label);
      return {
        headline: "Same reliability, different speed",
        detail: `${rate}. ${fastest.label} ran at a median ${Math.round(fastest.summary.medianDurationMs / 1000)}s against ${Math.round(slowest.summary.medianDurationMs / 1000)}s.${untimed.length > 0 ? ` Not timed: ${untimed.join(", ")} — that harness reported no duration, so it is left out of this comparison rather than counted as instant.` : ""}`,
        comparable: true,
        lead: fastest.id,
      };
    }

    const unpriced = judged.filter((row) => row.summary.costPerUsableTakeMicro === null).length;
    const untimedCount = judged.filter((row) => row.summary.medianDurationMs === null).length;
    const gaps = [
      unpriced > 0 ? `no rate card, so ${unpriced === judged.length ? "no" : `${unpriced} of ${judged.length}`} configurations have a known cost` : "",
      untimedCount > 0 ? `${untimedCount} configuration${untimedCount === 1 ? "" : "s"} reported no duration` : "",
    ].filter(Boolean);
    return {
      headline: "This job does not separate the configurations",
      detail: `${rate}, and nothing else in the recorded numbers differs.${gaps.length > 0 ? ` Two values are genuinely unknown here: ${gaps.join("; ")}.` : ""}`,
      comparable: true,
    };
  }

  const reliability = allUsable
    ? "Both configurations met every assertion on every trial."
    : `${best.label} produced ${best.summary.usable} of ${best.summary.trials} usable takes; ${worst.label} produced ${worst.summary.usable} of ${worst.summary.trials}.`;
  return {
    headline: `${best.label} is the safer choice for this job`,
    detail: `${reliability} Cost per usable take: ${money(best.summary.costPerUsableTakeMicro)}.`,
    comparable: true,
    lead: best.id,
  };
}

/**
 * The fix that turns a failure into a regression case: name the owning issue for
 * each assertion that failed at least once.
 * @param {any[]} configurations
 * @param {Record<string, string>} owners
 */
export function routeFailures(configurations, owners = {}) {
  const seen = new Set();
  const routes = [];
  for (const configuration of Array.isArray(configurations) ? configurations : []) {
    for (const trial of configuration.trials ?? []) {
      for (const id of trial.failed ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        routes.push({ assertion: id, owner: owners[id] ?? null });
      }
    }
  }
  return routes;
}
