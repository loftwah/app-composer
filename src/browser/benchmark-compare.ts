// MIT. Client behaviour for the Benchmarks Studio blind comparison.
//
// Two jobs:
//   1. Show the page each recorded take produced, side by side, without an
//      iframe and without letting its styles escape. The preview is fetched from
//      the opaque /benchmarks/preview route; the browser never learns the
//      configuration or trial id before a choice is recorded.
//   2. Record the observation on the server. The authoritative record lives in
//      D1, not localStorage. Submissions are append-only: "Record another
//      observation" adds a row and never rewrites an earlier one. localStorage
//      holds only a random browser token, which restores this browser's own
//      rows and is not an identity.

const STYLE_FALLBACK = "preview-unavailable";

type Check = { id: string; name: string; status: string; detail: string };

type Vote = {
  submissionId: string;
  runId: string;
  taskId: string;
  pairId: string;
  trialA: string;
  trialB: string;
  choice: string;
  reason: string;
  reasons: string[];
  blind: boolean;
  reviewerLabel: string;
  reviewerTokenHash: string;
  createdAt: string;
  updatedAt: string;
};

type Tally = {
  pairId: string;
  submissions: {
    submissionId: string;
    choice: string;
    blind: boolean;
    createdAt: string;
  }[];
};

type RevealSide = {
  key: "a" | "b";
  title: string;
  configurationId: string;
  configurationLabel: string;
  trialId: string;
  model: string;
  harness: string;
  harnessVersion: string;
  status: string;
  durationMs: number | null;
  failed: string[];
  checks: Check[];
};

type RevealPair = {
  pairId: string;
  label: string;
  sides: [RevealSide, RevealSide];
};

const TOKEN_KEY = "composer.benchmark.reviewer-token.v1";
const TOKEN_HEADER = "X-Benchmark-Reviewer-Token";

const tokenBytes = new Uint8Array(32);
crypto.getRandomValues(tokenBytes);
let reviewerToken = "";

function loadToken(): string {
  if (reviewerToken) return reviewerToken;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && /^[0-9a-f]{32,64}$/i.test(stored)) {
      reviewerToken = stored.toLowerCase();
      return reviewerToken;
    }
  } catch {
    // A browser that blocks storage still gets a token for this page load.
  }
  reviewerToken = [...tokenBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(TOKEN_KEY, reviewerToken);
  } catch {
    // Non-persistent, but still a valid token for this page.
  }
  return reviewerToken;
}

const ownVotes = new Map<string, Vote[]>();
const tallies = new Map<string, Tally>();
const reveals = new Map<string, RevealPair>();
const pending = new Set<string>();
let totals = { submissions: 0, independentTokens: 0 };
let runId = "";
let taskId = "";
let pairs = 0;
let loadTokenId = 0;
let localWrite = false;

function currentReviewer(): string {
  const input = document.querySelector<HTMLInputElement>("[data-reviewer]");
  return input?.value.trim() || "visitor";
}

function latestOwn(pairId: string): Vote | undefined {
  const votes = ownVotes.get(pairId) ?? [];
  return votes[votes.length - 1];
}

/** Only the current browser token's rows restore a revealed pair. Another
 * browser's row never unblinds this page. */
function applyOwnVotes(votes: Vote[]) {
  ownVotes.clear();
  for (const vote of votes) {
    const list = ownVotes.get(vote.pairId) ?? [];
    list.push(vote);
    list.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.submissionId.localeCompare(right.submissionId),
    );
    ownVotes.set(vote.pairId, list);
  }
}

function applyTallies(entries: Tally[]) {
  tallies.clear();
  for (const entry of entries) tallies.set(entry.pairId, entry);
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

/** Keep the produced page's body, drop its document wrapper. */
function bodyOf(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1];
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "");
}

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
    // element would be blocked and the preview would render unstyled.
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
    body.className = "preview-body";
    body.innerHTML = sanitise(bodyOf(html));
    shadow.append(body);
    root.append(mounted);
    if (status) status.hidden = true;
    root.dataset.ready = "true";
  } catch (error) {
    if (status) {
      status.hidden = false;
      status.textContent = `Preview unavailable: ${error instanceof Error ? error.message : String(error)}. The reveal still works.`;
    }
    host.dataset.state = STYLE_FALLBACK;
  }
}

function choiceLabel(choice: string): string {
  switch (choice) {
    case "a":
      return "A is better";
    case "b":
      return "B is better";
    case "tie":
      return "Tie";
    case "cant-tell":
      return "Can't tell";
    case "revealed":
      return "Revealed without choosing";
    default:
      return "unknown choice";
  }
}

function readableDuration(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) return "unknown";
  const ms = Number(value);
  return ms < 1000 ? `${Math.round(ms)}ms` : `${Math.round(ms / 100) / 10}s`;
}

function instant(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "unknown";
  return `${new Date(ms).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value || "unknown";
}

function statusFor(pair: HTMLElement): HTMLElement | null {
  return pair.querySelector<HTMLElement>("[data-pair-status]");
}

function setButtons(pair: HTMLElement, disabled: boolean) {
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]"))
    button.disabled = disabled;
  const reason = pair.querySelector<HTMLInputElement>("[data-pair-reason]");
  if (reason) reason.disabled = disabled;
}

function clear(node: HTMLElement) {
  node.textContent = "";
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderChecks(side: RevealSide): HTMLElement {
  const checks = Array.isArray(side.checks) ? side.checks : [];
  const passed = checks.filter((check) => check.status === "pass").length;
  const wrapper = element("div", "cmp-reveal-checks");
  if (side.failed.length > 0) {
    const failed = element(
      "p",
      "cmp-reveal-failed",
      `Failed: ${side.failed.join(", ")}`,
    );
    wrapper.append(failed);
  }
  const details = element("details");
  details.append(
    element(
      "summary",
      "small",
      `Judge results: ${passed} of ${checks.length} assertions passed`,
    ),
  );
  const list = element("ul", "cmp-reveal-check-list");
  for (const check of checks) {
    const item = element("li", check.status === "pass" ? "is-pass" : "is-fail");
    item.append(
      element("span", undefined, check.status === "pass" ? "✓" : "✕"),
      element("div", undefined, check.name),
      element("p", "small", check.detail),
    );
    list.append(item);
  }
  details.append(list);
  wrapper.append(details);
  return wrapper;
}

function renderObservations(pairId: string): HTMLElement {
  const wrapper = element("div", "cmp-reveal-observations");
  for (const vote of ownVotes.get(pairId) ?? []) {
    const item = element("p", "small cmp-observation");
    item.append(
      element("strong", undefined, choiceLabel(vote.choice)),
      element(
        "span",
        undefined,
        ` · ${vote.blind ? "blind when cast" : "unblinded"} · by ${vote.reviewerLabel || "unknown"} (unauthenticated label) · recorded ${instant(vote.createdAt)} · submission ${shortId(vote.submissionId)}`,
      ),
    );
    if (vote.reason) item.append(element("span", "cmp-observation-reason", ` · reason: ${vote.reason}`));
    wrapper.append(item);
  }
  const tally = tallies.get(pairId);
  if (tally && tally.submissions.length > 0) {
    wrapper.append(
      element(
        "p",
        "small cmp-tally-label",
        `${tally.submissions.length} independent submission${tally.submissions.length === 1 ? "" : "s"} on the server for this pair:`,
      ),
    );
    const list = element("ul", "cmp-tally");
    for (const submission of tally.submissions) {
      list.append(
        element(
          "li",
          "small",
          `${choiceLabel(submission.choice)} · ${submission.blind ? "blind" : "unblinded"} · ${instant(submission.createdAt)} · ${shortId(submission.submissionId)}`,
        ),
      );
    }
    wrapper.append(list);
  }
  return wrapper;
}

function renderReveal(pair: HTMLElement, entry: Vote) {
  const host = pair.querySelector<HTMLElement>("[data-pair-reveal]");
  if (!host) return;
  clear(host);
  host.hidden = false;
  const reveal = reveals.get(entry.pairId);
  if (!reveal) {
    host.append(
      element(
        "p",
        "small",
        "The labels for this pair are not part of the committed run record, so they stay unknown rather than guessed.",
      ),
    );
    return;
  }
  const observationPending = pending.has(entry.pairId);
  const head = element("div", "cmp-reveal-head");
  head.append(
    element("p", "eyebrow", "Revealed by your recorded submission"),
    element(
      "p",
      "cmp-reveal-verdict",
      entry.choice === "revealed" ? "No preference was recorded." : `Recorded choice: ${choiceLabel(entry.choice)}.`,
    ),
    element(
      "p",
      "small cmp-reveal-meta",
      `${entry.blind ? "Blind when cast" : "Unblinded"} · reviewer ${entry.reviewerLabel || "unknown"} (unauthenticated label) · ${instant(entry.createdAt)} · submission ${shortId(entry.submissionId)} · token hash ${shortId(entry.reviewerTokenHash)}`,
    ),
  );
  if (entry.reason) head.append(element("p", "cmp-reveal-reason", `Reason: ${entry.reason}`));
  const observe = element(
    "button",
    "button secondary cmp-observe",
    observationPending ? "Cancel another observation" : "Record another observation",
  );
  observe.type = "button";
  observe.dataset.observe = entry.pairId;
  observe.setAttribute("aria-pressed", observationPending ? "true" : "false");
  head.append(observe);
  head.append(renderObservations(entry.pairId));
  host.append(head);

  const sides = element("div", "cmp-reveal-sides");
  for (const side of reveal.sides) {
    const article = element("article", "cmp-reveal-side");
    const title = element("h4", undefined, `${side.title} — ${side.configurationLabel || "unknown"}`);
    const facts = element("dl", "cmp-reveal-facts");
    const rows: [string, string][] = [
      ["Model", side.model || "unknown"],
      ["Harness", side.harness || "unknown"],
      ["Harness version", side.harnessVersion || "unknown"],
      ["Trial status", side.status || "unknown"],
      ["Duration", readableDuration(side.durationMs)],
      ["Failed assertions", side.failed.length > 0 ? side.failed.join(", ") : "none recorded"],
    ];
    for (const [label, value] of rows) {
      const row = element("div");
      row.append(element("dt", undefined, label), element("dd", undefined, value));
      facts.append(row);
    }
    article.append(title, facts, renderChecks(side));
    sides.append(article);
  }
  host.append(sides);
}

function paintPair(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  const entry = latestOwn(pairId);
  const observationPending = pending.has(pairId);
  pair.dataset.revealed = entry ? "true" : "false";
  const status = statusFor(pair);
  const reason = pair.querySelector<HTMLInputElement>("[data-pair-reason]");
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
    button.setAttribute(
      "aria-pressed",
      entry && !observationPending && button.dataset.choice === entry.choice ? "true" : "false",
    );
  }
  setButtons(pair, Boolean(entry) && !observationPending);
  if (reason && !observationPending && document.activeElement !== reason)
    reason.value = entry?.reason ?? "";
  const revealHost = pair.querySelector<HTMLElement>("[data-pair-reveal]");
  if (entry) {
    renderReveal(pair, entry);
  } else if (revealHost) {
    clear(revealHost);
    revealHost.hidden = true;
  }
  if (status) {
    if (entry && observationPending) {
      status.textContent =
        "Recording another observation on a pair whose labels are already revealed. It will be stored as a new, separate unblinded row; the earlier row is not changed.";
    } else if (entry) {
      status.textContent = `Recorded ${instant(entry.createdAt)} as a new submission: ${choiceLabel(entry.choice)} · ${entry.blind ? "blind when cast" : "unblinded"} · unauthenticated label. Every earlier submission is still on the record.`;
    } else {
      const tally = tallies.get(pairId);
      status.textContent =
        tally && tally.submissions.length > 0
          ? `${tally.submissions.length} independent submission${tally.submissions.length === 1 ? "" : "s"} recorded for this pair. Record your own before seeing the labels.`
          : "";
    }
  }
}

function paintAll() {
  for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]"))
    paintPair(pair);
  const summary = document.querySelector<HTMLElement>("[data-vote-summary]");
  if (summary) {
    const ownPairs = [...ownVotes.values()].filter((votes) => votes.length > 0).length;
    summary.textContent = `${ownPairs} of ${pairs} pairs have a submission from this browser (a random token kept in localStorage, not an identity). ${totals.submissions} independent submission${totals.submissions === 1 ? "" : "s"} from ${totals.independentTokens} browser token${totals.independentTokens === 1 ? "" : "s"} are on the server.`;
  }
  const runLink = document.querySelector<HTMLElement>("[data-run-link]");
  if (runLink) {
    const ownPairs = [...ownVotes.values()].filter((votes) => votes.length > 0).length;
    runLink.hidden = ownPairs === 0;
    if (ownPairs > 0 && runLink.childElementCount === 0) {
      const link = element("a", "button secondary", "Open the revealed run record");
      link.href = `/benchmarks/runs/${encodeURIComponent(runId)}`;
      const note = element(
        "span",
        undefined,
        " This page lists every submission with its receipt time and token hash; raw browser tokens are not published.",
      );
      runLink.append(link, note);
    }
  }
}

function availability(message: string, unavailable: boolean) {
  const node = document.querySelector<HTMLElement>("[data-vote-availability]");
  if (node) {
    node.textContent = message;
    node.dataset.state = unavailable ? "unavailable" : "ready";
  }
  if (unavailable) {
    for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]"))
      setButtons(pair, true);
  } else {
    for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]"))
      paintPair(pair);
  }
}

async function loadVotes() {
  const token = ++loadTokenId;
  try {
    const response = await fetch(`/api/benchmark-votes?run=${encodeURIComponent(runId)}`, {
      headers: { Accept: "application/json", [TOKEN_HEADER]: loadToken() },
      credentials: "same-origin",
    });
    const body = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          votes?: (Vote & { reveal?: RevealPair | null })[];
          tallies?: Tally[];
          totals?: { submissions?: number; independentTokens?: number };
          error?: string;
        }
      | null;
    if (!response.ok || !body?.ok) {
      availability(
        body?.error ?? "The server vote record is unavailable, so this page cannot record a choice.",
        true,
      );
      return;
    }
    if (token !== loadTokenId || localWrite) return;
    reveals.clear();
    for (const vote of body.votes ?? []) {
      if (vote.reveal) reveals.set(vote.pairId, vote.reveal);
    }
    applyOwnVotes(body.votes ?? []);
    applyTallies(body.tallies ?? []);
    totals = {
      submissions: body.totals?.submissions ?? 0,
      independentTokens: body.totals?.independentTokens ?? 0,
    };
    availability(
      "The record is server-side but unauthenticated. The browser token only restores this browser's own rows; it is not a sign-in.",
      false,
    );
    paintAll();
  } catch {
    availability(
      "The server vote record could not be reached, so this page cannot record a choice.",
      true,
    );
  }
}

async function sendVote(pair: HTMLElement, choice: string) {
  const pairId = pair.dataset.pair ?? "";
  const reason = pair.querySelector<HTMLInputElement>("[data-pair-reason]")?.value ?? "";
  const reviewer = currentReviewer();
  const blind = pair.dataset.revealed === "true" ? false : choice !== "revealed";
  const status = statusFor(pair);
  setButtons(pair, true);
  if (status) status.textContent = "Recording on the server…";
  try {
    const response = await fetch("/api/benchmark-votes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [TOKEN_HEADER]: loadToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ run: runId, task: taskId, pair: pairId, choice, reason, reviewer, blind }),
    });
    const body = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          error?: string;
          appended?: boolean;
          vote?: Vote;
          reveal?: RevealPair | null;
          tally?: Tally | null;
          totals?: { submissions?: number; independentTokens?: number };
        }
      | null;
    if (!response.ok || !body?.ok || !body.vote) {
      throw new Error(body?.error ?? `The server returned ${response.status}.`);
    }
    const vote = body.vote;
    localWrite = true;
    ownVotes.set(
      vote.pairId,
      [...(ownVotes.get(vote.pairId) ?? []), vote].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.submissionId.localeCompare(right.submissionId),
      ),
    );
    if (body.reveal) reveals.set(vote.pairId, body.reveal);
    if (body.tally) tallies.set(vote.pairId, body.tally);
    totals = {
      submissions: body.totals?.submissions ?? totals.submissions,
      independentTokens: body.totals?.independentTokens ?? totals.independentTokens,
    };
    pending.delete(pairId);
    const reasonInput = pair.querySelector<HTMLInputElement>("[data-pair-reason]");
    if (reasonInput) reasonInput.value = "";
    paintAll();
    if (status) {
      status.textContent = [
        "Recorded as a new submission on the server.",
        vote.blind ? "Blind when cast." : "Recorded unblinded because the labels had already been revealed.",
        "Any earlier submission was left unchanged; this browser token may submit again.",
        "The reviewer label is unauthenticated and this token is not an identity.",
      ].join(" ");
    }
  } catch (error) {
    if (status)
      status.textContent = `Not recorded: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    paintPair(pair);
  }
}

function toggleObservation(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  if (!latestOwn(pairId)) return;
  if (pending.has(pairId)) {
    pending.delete(pairId);
  } else {
    pending.add(pairId);
    const reason = pair.querySelector<HTMLInputElement>("[data-pair-reason]");
    if (reason) reason.value = "";
  }
  paintPair(pair);
  if (pending.has(pairId))
    pair.querySelector<HTMLInputElement>("[data-pair-reason]")?.focus();
}

function wirePairs() {
  for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]")) {
    for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
      button.addEventListener("click", () => {
        const choice = button.dataset.choice ?? "";
        if (choice) void sendVote(pair, choice);
      });
    }
    pair.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const observe = target.closest<HTMLButtonElement>("[data-observe]");
      if (observe) toggleObservation(pair);
    });
  }
}

function main() {
  const root = document.querySelector<HTMLElement>("[data-blind-review]");
  runId = root?.dataset.run ?? "";
  taskId = root?.dataset.task ?? "";
  pairs = document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]").length;
  loadToken();
  for (const host of document.querySelectorAll<HTMLElement>("[data-recorded-preview]"))
    void mountPreview(host);
  wirePairs();
  document.querySelector<HTMLInputElement>("[data-reviewer]")?.addEventListener("change", () => {
    paintAll();
  });
  paintAll();
  if (runId) void loadVotes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  main();
}

export {};
