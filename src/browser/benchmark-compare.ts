// MIT. Client behaviour for the Benchmarks Studio blind comparison.
//
// Two jobs:
//   1. Show the page each recorded take produced, side by side, without an
//      iframe and without letting its styles escape. The preview is fetched from
//      the opaque /benchmarks/preview route; the browser never learns the
//      configuration or trial id before a choice is recorded.
//   2. Record the choice on the server. The authoritative vote lives in D1, not
//      localStorage. A pair stays blind until the API returns its reveal.

const STYLE_FALLBACK = "preview-unavailable";

type Check = { id: string; name: string; status: string; detail: string };

type Vote = {
  id: string;
  runId: string;
  taskId: string;
  pairId: string;
  trialA: string;
  trialB: string;
  choice: string;
  reason: string;
  blind: boolean;
  reviewerLabel: string;
  createdAt: string;
  updatedAt: string;
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

type Recorded = { vote: Vote; reveal: RevealPair | null };

const recorded = new Map<string, Recorded>();
let allVotes: (Vote & { reveal?: RevealPair | null })[] = [];
let runId = "";
let taskId = "";
let pairs = 0;
let loadToken = 0;
let localWrite = false;

function currentReviewer(): string {
  const input = document.querySelector<HTMLInputElement>("[data-reviewer]");
  return input?.value.trim() || "visitor";
}

/** Only the current reviewer label's votes restore a revealed pair. Another
 * reviewer's vote never unblinds this reviewer's page. */
function applyReviewerVotes() {
  recorded.clear();
  const reviewer = currentReviewer();
  for (const vote of allVotes) {
    if (vote.reviewerLabel === reviewer) recorded.set(vote.pairId, { vote, reveal: vote.reveal ?? null });
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

function statusFor(pair: HTMLElement): HTMLElement | null {
  return pair.querySelector<HTMLElement>("[data-pair-status]");
}

function setButtons(pair: HTMLElement, disabled: boolean) {
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]"))
    button.disabled = disabled;
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

function renderReveal(pair: HTMLElement, entry: Recorded) {
  const host = pair.querySelector<HTMLElement>("[data-pair-reveal]");
  if (!host) return;
  clear(host);
  host.hidden = false;
  const reveal = entry.reveal;
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
  const vote = entry.vote;
  const head = element("div", "cmp-reveal-head");
  head.append(
    element("p", "eyebrow", "Revealed"),
    element(
      "p",
      "cmp-reveal-verdict",
      vote.choice === "revealed" ? "No preference was recorded." : `Recorded choice: ${choiceLabel(vote.choice)}.`,
    ),
    element(
      "p",
      "small cmp-reveal-meta",
      `${vote.blind ? "Blind when cast" : "Unblinded"} · reviewer ${vote.reviewerLabel || "unknown"} (unauthenticated label) · ${instant(vote.updatedAt)}${vote.updatedAt !== vote.createdAt ? " · updated" : ""}`,
    ),
  );
  if (vote.reason) head.append(element("p", "cmp-reveal-reason", `Reason: ${vote.reason}`));
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
  const entry = recorded.get(pairId);
  pair.dataset.revealed = entry ? "true" : "false";
  const status = statusFor(pair);
  const reason = pair.querySelector<HTMLInputElement>("[data-pair-reason]");
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
    button.setAttribute(
      "aria-pressed",
      entry && button.dataset.choice === entry.vote.choice ? "true" : "false",
    );
  }
  if (reason && document.activeElement !== reason)
    reason.value = entry?.vote.reason ?? "";
  const revealHost = pair.querySelector<HTMLElement>("[data-pair-reveal]");
  if (entry) {
    renderReveal(pair, entry);
  } else if (revealHost) {
    clear(revealHost);
    revealHost.hidden = true;
  }
  if (status) {
    if (entry) {
      const updated = entry.vote.updatedAt !== entry.vote.createdAt ? " · updated" : "";
      status.textContent = entry.vote.blind
        ? `Recorded ${instant(entry.vote.updatedAt)}${updated}: ${choiceLabel(entry.vote.choice)} · blind when cast · unauthenticated label.`
        : `Recorded ${instant(entry.vote.updatedAt)}${updated}: ${choiceLabel(entry.vote.choice)} · unblinded · unauthenticated label.`;
    } else if (recorded.size > 0) {
      const other = [...recorded.values()][0]?.vote.pairId ?? "another pair";
      status.textContent = `A vote is already recorded on ${other}. Choosing here replaces it; the server will say so.`;
    } else {
      status.textContent = "";
    }
  }
}

function paintAll() {
  for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]")) paintPair(pair);
  const summary = document.querySelector<HTMLElement>("[data-vote-summary]");
  if (summary) {
    const reviewer = currentReviewer();
    summary.textContent =
      recorded.size === 0
        ? `0 of ${pairs} pairs recorded for reviewer ${reviewer} (unauthenticated label) on the server. Only this label's votes are restored on this page.`
        : `${recorded.size} of ${pairs} pairs recorded for reviewer ${reviewer} (unauthenticated label) on the server. Reloading this page restores them.`;
  }
  const runLink = document.querySelector<HTMLElement>("[data-run-link]");
  if (runLink) {
    runLink.hidden = recorded.size === 0;
    if (recorded.size > 0 && runLink.childElementCount === 0) {
      const link = element("a", "button secondary", "Open the revealed run record");
      link.href = `/benchmarks/runs/${encodeURIComponent(runId)}`;
      const note = element(
        "span",
        undefined,
        " This page shows every label, every trial and the recorded votes.",
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
  }
}

async function loadVotes() {
  const token = ++loadToken;
  try {
    const response = await fetch(
      `/api/benchmark-votes?run=${encodeURIComponent(runId)}&reviewer=${encodeURIComponent(currentReviewer())}`,
      {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      },
    );
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; votes?: (Vote & { reveal?: RevealPair | null })[]; error?: string }
      | null;
    if (!response.ok || !body?.ok) {
      availability(
        body?.error ?? "The server vote record is unavailable, so this page cannot record a choice.",
        true,
      );
      return;
    }
    if (token !== loadToken || localWrite) return;
    allVotes = body.votes ?? [];
    applyReviewerVotes();
    availability(
      "The authoritative record is server-side but unauthenticated: the reviewer label is self-declared, not a sign-in.",
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
  const reviewer = document.querySelector<HTMLInputElement>("[data-reviewer]")?.value.trim() || "visitor";
  const blind = pair.dataset.revealed === "true" ? false : choice !== "revealed";
  const status = statusFor(pair);
  setButtons(pair, true);
  if (status) status.textContent = "Recording on the server…";
  try {
    const response = await fetch("/api/benchmark-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ run: runId, task: taskId, pair: pairId, choice, reason, reviewer, blind }),
    });
    const body = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          error?: string;
          updated?: boolean;
          replacedPair?: string | null;
          blindStayedOff?: boolean;
          vote?: Vote;
          reveal?: RevealPair | null;
        }
      | null;
    if (!response.ok || !body?.ok || !body.vote) {
      throw new Error(body?.error ?? `The server returned ${response.status}.`);
    }
    const vote = body.vote;
    localWrite = true;
    allVotes = allVotes.filter((entry) => entry.reviewerLabel !== vote.reviewerLabel);
    allVotes.push({ ...vote, reveal: body.reveal ?? null });
    applyReviewerVotes();
    paintAll();
    if (status) {
      const changes = [
        body.updated ? "Updated your recorded vote." : "Recorded on the server.",
        body.replacedPair ? `The earlier choice on ${body.replacedPair} was replaced.` : "",
        body.blindStayedOff
          ? "This pair stays unblinded because it was revealed earlier."
          : choice !== "revealed" && !vote.blind
            ? "This vote is recorded as unblinded."
            : "",
        choice === "revealed"
          ? "You revealed this pair without choosing; the record says it was unblinded."
          : "",
        "Stored unauthenticated; the reviewer label is not verified.",
      ].filter(Boolean);
      status.textContent = changes.join(" ");
    }
  } catch (error) {
    if (status)
      status.textContent = `Not recorded: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    setButtons(pair, false);
  }
}

function wirePairs() {
  for (const pair of document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]")) {
    for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
      button.addEventListener("click", () => {
        const choice = button.dataset.choice ?? "";
        if (choice) void sendVote(pair, choice);
      });
    }
  }
}

function main() {
  const root = document.querySelector<HTMLElement>("[data-blind-review]");
  runId = root?.dataset.run ?? "";
  taskId = root?.dataset.task ?? "";
  pairs = document.querySelectorAll<HTMLElement>("[data-pair-grid] > [data-pair]").length;
  for (const host of document.querySelectorAll<HTMLElement>("[data-recorded-preview]"))
    void mountPreview(host);
  wirePairs();
  document.querySelector<HTMLInputElement>("[data-reviewer]")?.addEventListener("change", () => {
    recorded.clear();
    allVotes = [];
    localWrite = false;
    paintAll();
    if (runId) void loadVotes();
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
