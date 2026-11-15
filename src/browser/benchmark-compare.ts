// MIT. Client behaviour for the Benchmarks Studio comparison page.
//
// Two jobs:
//   1. Show the page a configuration actually produced, live and side by side,
//      without an iframe (the site's policy sets frame-src 'none') and without
//      letting its styles escape into this page. Each preview is mounted in a
//      shadow root from same-origin static files that were sanitised when the
//      trial was published.
//   2. Record which take the reader would use, with a short reason and an
//      optional timestamp, on this device only. A vote belongs to one recorded
//      run, not to a reusable trial label, so a later run cannot inherit it.

const VOTE_KEY = "composer:benchmark-review:v2";
const LEGACY_KEY = "composer:benchmark-vote:v1";
const STYLE_FALLBACK = "preview-unavailable";

type Vote = {
  run: string;
  trial: string;
  configuration: string;
  choice: boolean;
  reason: string;
  at: string;
};

type LegacyVote = {
  trial: string;
  configuration: string;
  choice: boolean;
  reason: string;
  at: string;
};

/** @returns {Record<string, Vote>} */
function readVotes(): Record<string, Vote> {
  try {
    const raw = window.localStorage.getItem(VOTE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, Vote>;
  } catch {
    return {};
  }
}

/** @returns {Record<string, LegacyVote>} */
function readLegacy(): Record<string, LegacyVote> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, LegacyVote>) : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, Vote>} votes */
function writeVotes(votes: Record<string, Vote>) {
  try {
    window.localStorage.setItem(VOTE_KEY, JSON.stringify(votes));
  } catch {
    /* a device with no storage still gets the previews and the verdict */
  }
}

/** Strip anything that could execute or leave the sandbox. */
function sanitise(html: string) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "")
    .replace(/\s(href|src)\s*=\s*"(?!#|https:\/\/example\.com)[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'(?!#|https:\/\/example\.com)[^']*'/gi, " $1='#'");
}

/**
 * Keep the produced page's body, drop its document wrapper so the shadow root
 * renders it inside the card.
 * @param {string} html
 */
function bodyOf(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1];
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "");
}

/**
 * @param {HTMLElement} host
 */
async function mountPreview(host: HTMLElement) {
  const htmlUrl = host.dataset.html;
  const cssUrl = host.dataset.css;
  if (!htmlUrl) return;
  const status = host.querySelector<HTMLElement>("[data-preview-status]");
  try {
    const response = await fetch(htmlUrl, { credentials: "omit" });
    if (!response.ok) throw new Error(`The recorded page returned ${response.status}.`);
    const html = await response.text();
    const root = host.querySelector<HTMLElement>("[data-preview-canvas]");
    if (!root) throw new Error("No preview canvas.");
    root.textContent = "";
    // A shadow root keeps the produced page's selectors and colours inside the
    // card, so two previews sit beside each other without colliding.
    //
    // Styling arrives as a same-origin <link> inside the shadow root rather than
    // an inline <style>: the site's policy has no style-src, so an inline style
    // element would be blocked and the preview would render unstyled — exactly the
    // defect that shipped once already and was caught by a live check.
    const mounted = document.createElement("div");
    mounted.className = "preview-host";
    const shadow = mounted.attachShadow({ mode: "open" });
    if (cssUrl) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      shadow.append(link);
    }
    const body = document.createElement("div");
    body.innerHTML = sanitise(bodyOf(html));
    shadow.append(body);
    root.append(mounted);
    if (status) status.hidden = true;
    root.dataset.ready = "true";
  } catch (error) {
    if (status) {
      status.hidden = false;
      status.textContent = `Preview unavailable: ${error instanceof Error ? error.message : String(error)}. Open the page itself instead.`;
    }
    host.dataset.state = STYLE_FALLBACK;
  }
}

/** @param {HTMLElement} card */
function runOf(card: HTMLElement) {
  return card.getAttribute("data-run") ?? "unrecorded";
}

/** @param {HTMLElement} card */
function keyOf(card: HTMLElement) {
  return `${runOf(card)}::${card.getAttribute("data-trial") ?? ""}`;
}

/**
 * A note saved by the earlier trial-keyed version still shows for the same trial
 * in the same run; the next edit writes the run-scoped record.
 * @param {Record<string, Vote>} votes
 * @param {HTMLElement} card
 */
function voteFor(votes: Record<string, Vote>, card: HTMLElement): Partial<Vote> {
  const exact = votes[keyOf(card)];
  if (exact) return exact;
  const trial = card.getAttribute("data-trial") ?? "";
  return readLegacy()[trial] ?? {};
}

/** Paint the saved vote state into every trial card. */
function paintVotes() {
  const votes = readVotes();
  for (const card of document.querySelectorAll<HTMLElement>("[data-trial]")) {
    const vote = voteFor(votes, card);
    const badge = card.querySelector<HTMLElement>("[data-vote-badge]");
    const button = card.querySelector<HTMLElement>("[data-vote-button]");
    const note = card.querySelector<HTMLElement>("[data-vote-note]");
    const reason = card.querySelector<HTMLInputElement>("[data-vote-reason]");
    const stamp = card.querySelector<HTMLInputElement>("[data-vote-at]");
    if (badge) badge.hidden = !vote?.choice;
    if (button) button.setAttribute("aria-pressed", vote?.choice ? "true" : "false");
    if (reason && document.activeElement !== reason) reason.value = vote?.reason ?? "";
    if (stamp && document.activeElement !== stamp) stamp.value = vote?.at ?? "";
    if (note) note.hidden = !(vote?.reason || vote?.at);
  }
  const tally = document.querySelector<HTMLElement>("[data-vote-tally]");
  if (tally) {
    const cards = [...document.querySelectorAll<HTMLElement>("[data-trial]")];
    const run = cards[0] ? runOf(cards[0]) : "unrecorded";
    const chosen = cards.filter((card) => runOf(card) === run && voteFor(votes, card).choice).length;
    tally.textContent =
      chosen === 0
        ? "No take picked yet. Choose the one you would actually use."
        : `${chosen} take${chosen === 1 ? "" : "s"} picked in this run on this device. Your notes stay in this browser.`;
  }
}

/** @param {HTMLElement} card */
function wireTrial(card: HTMLElement) {
  const button = card.querySelector<HTMLElement>("[data-vote-button]");
  const reason = card.querySelector<HTMLInputElement>("[data-vote-reason]");
  const stamp = card.querySelector<HTMLInputElement>("[data-vote-at]");

  button?.addEventListener("click", () => {
    const votes = readVotes();
    const key = keyOf(card);
    const run = runOf(card);
    const chosen = !votes[key]?.choice;

    // One pick per run: choosing a take clears the other picks in this same
    // recorded run. A pick from a different run is left alone.
    for (const other of Object.keys(votes)) {
      if (other !== key && votes[other]?.run === run) votes[other] = { ...votes[other], choice: false };
    }
    votes[key] = {
      run,
      trial: card.getAttribute("data-trial") ?? "",
      configuration: card.getAttribute("data-configuration") ?? "",
      choice: chosen,
      reason: reason instanceof HTMLInputElement ? reason.value.trim() : "",
      at: stamp instanceof HTMLInputElement ? stamp.value.trim() : "",
    };
    writeVotes(votes);
    paintVotes();
  });

  for (const field of [reason, stamp]) {
    field?.addEventListener("change", () => {
      const votes = readVotes();
      const key = keyOf(card);
      const existing = votes[key] ?? {
        run: runOf(card),
        trial: card.getAttribute("data-trial") ?? "",
        configuration: card.getAttribute("data-configuration") ?? "",
        choice: false,
        reason: "",
        at: "",
      };
      votes[key] = {
        ...existing,
        reason: reason instanceof HTMLInputElement ? reason.value.trim() : "",
        at: stamp instanceof HTMLInputElement ? stamp.value.trim() : "",
      };
      writeVotes(votes);
      paintVotes();
    });
  }
}

/** The "compare the two" control: swap which trial is enlarged. */
function wireSwitcher() {
  for (const control of document.querySelectorAll<HTMLSelectElement>("[data-compare-select]")) {
    control.addEventListener("change", () => {
      const target = control.getAttribute("data-compare-select") ?? "";
      const value = control.value;
      for (const panel of document.querySelectorAll<HTMLElement>(`[data-compare-panel="${target}"]`)) {
        panel.hidden = panel.getAttribute("data-compare-trial") !== value;
      }
    });
  }
}

/** Private export: the exact run and the notes made against its takes. */
function reviewPayload() {
  const cards = [...document.querySelectorAll<HTMLElement>("[data-trial]")];
  const votes = readVotes();
  const meta = document.querySelector<HTMLElement>("[data-run-meta]");
  return {
    schema: "benchmarks-comparison-review/v2",
    run: {
      id: cards[0] ? runOf(cards[0]) : "unrecorded",
      sourceVersion: meta?.getAttribute("data-source") ?? null,
      briefSha256: meta?.getAttribute("data-brief") ?? null,
      generatedAt: meta?.getAttribute("data-generated") ?? null,
      taskId: meta?.getAttribute("data-task") ?? null,
      taskVersion: meta?.getAttribute("data-task-version") ?? null,
    },
    recordedAt: new Date().toISOString(),
    takes: cards.map((card) => {
      const vote = voteFor(votes, card);
      return {
        trial: card.getAttribute("data-trial") ?? "",
        configuration: card.getAttribute("data-configuration") ?? "",
        model: card.getAttribute("data-model") ?? "",
        harness: card.getAttribute("data-harness") ?? "",
        status: card.getAttribute("data-status") ?? "",
        durationMs: Number(card.getAttribute("data-duration")) || null,
        choice: Boolean(vote.choice),
        reason: vote.reason ?? "",
        at: vote.at ?? "",
      };
    }),
  };
}

function wireExport() {
  const button = document.querySelector<HTMLButtonElement>("[data-review-export]");
  const status = document.querySelector<HTMLElement>("[data-review-status]");
  button?.addEventListener("click", async () => {
    const text = JSON.stringify(reviewPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = "Review copied as JSON, bound to this exact recorded run.";
    } catch {
      if (status) status.textContent = "The clipboard was unavailable. Select the review text from the page instead.";
      window.prompt("Copy this review:", text);
    }
  });
}

function main() {
  for (const host of document.querySelectorAll<HTMLElement>("[data-trial-preview]")) void mountPreview(host);
  for (const card of document.querySelectorAll<HTMLElement>("[data-trial]")) wireTrial(card);
  wireSwitcher();
  wireExport();
  paintVotes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  main();
}

export {};
