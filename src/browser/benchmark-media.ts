// MIT. Client behaviour for the Benchmarks Studio matched media comparison.
//
// The page ships two playable saved clips behind opaque pair/side URLs. Until
// the server returns a recorded submission from this browser, the page gets no
// model, provider, configuration or trial name. The reveal is server-side and
// survives a reload; there is no vote in localStorage, only a random token.
//
// Submissions are append-only. Recording once does not stop a second
// observation: "Record another observation" sends a new row, and the earlier
// row stays on the record. The token only restores this browser's own rows and
// is never an identity. Only its hash is published.

type Check = { id: string; name: string; kind: string; status: string; detail: string };

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

type MediaArtifact = {
  mime: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sha256: string;
  videoCodec: string | null;
  frameRate: string | null;
  audio: Record<string, unknown> | null;
};

type RevealSide = {
  key: "a" | "b";
  title: string;
  configurationId: string;
  configurationLabel: string;
  trialId: string;
  model: string;
  resolvedModel: string;
  provider: string;
  harness: string;
  harnessVersion: string;
  status: string;
  durationMs: number | null;
  latencyMs: number | null;
  failed: string[];
  checks: Check[];
  settings: Record<string, unknown>;
  artifact: MediaArtifact | null;
  poster: { mime: string; bytes: number | null; sha256: string } | null;
  cost: { estimateMicro: number | null; providerChargedMicro: number | null; basis: string } | null;
};

type RevealPair = { pairId: string; label: string; sides: RevealSide[] };

const TOKEN_KEY = "composer.benchmark.reviewer-token.v1";
const TOKEN_HEADER = "X-Benchmark-Reviewer-Token";

/** A random per-browser token, not an identity. 32 random bytes as 64 hex. */
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

/** Only these browser-scoped rows restore a reveal. Other browsers' rows are
 * counted but never delivered with labels attached. */
const ownVotes = new Map<string, Vote[]>();
const tallies = new Map<string, Tally>();
const pending = new Set<string>();
const selectedChips = new Map<string, Set<string>>();
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

function chipsFor(pairId: string): Set<string> {
  let set = selectedChips.get(pairId);
  if (!set) {
    set = new Set<string>();
    selectedChips.set(pairId, set);
  }
  return set;
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

function clear(node: HTMLElement) {
  node.textContent = "";
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

function readableDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "unknown";
  const ms = Number(value);
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function money(micro: number | null | undefined): string {
  if (micro === null || micro === undefined || !Number.isFinite(Number(micro))) return "not recorded";
  const value = Number(micro) / 1_000_000;
  return `US$${value.toFixed(value >= 0.1 ? 2 : 4)}`;
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
  return pair.querySelector<HTMLElement>("[data-media-status]");
}

function setButtons(pair: HTMLElement, disabled: boolean) {
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]"))
    button.disabled = disabled;
}

function setControls(pair: HTMLElement, disabled: boolean) {
  setButtons(pair, disabled);
  for (const control of pair.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
    "[data-media-reason], [data-reason-chip]",
  ))
    control.disabled = disabled;
}

function renderChecks(side: RevealSide): HTMLElement {
  const checks = Array.isArray(side.checks) ? side.checks : [];
  const passed = checks.filter((check) => check.status === "pass").length;
  const observed = checks.filter((check) => check.kind === "observed").length;
  const wrapper = element("div", "media-reveal-checks");
  if (side.failed.length > 0) {
    wrapper.append(
      element("p", "media-reveal-failed", `Failed: ${side.failed.join(", ")}`),
    );
  }
  const details = element("details");
  details.append(
    element(
      "summary",
      "small",
      `Checks: ${passed} of ${checks.length} passed · ${observed} observed, ${checks.length - observed} measured`,
    ),
  );
  const list = element("ul", "media-reveal-check-list");
  for (const check of checks) {
    const item = element("li", check.status === "pass" ? "is-pass" : "is-fail");
    item.append(
      element("span", undefined, check.status === "pass" ? "✓" : "✕"),
      element("div", undefined, `${check.name} · ${check.kind}`),
      element("p", "small", check.detail),
    );
    list.append(item);
  }
  details.append(list);
  wrapper.append(details);
  return wrapper;
}

function renderSettings(side: RevealSide): HTMLElement {
  const details = element("details", "media-reveal-settings");
  details.append(element("summary", undefined, "Recorded settings"));
  const list = element("dl");
  for (const [key, value] of Object.entries(side.settings ?? {})) {
    const row = element("div");
    row.append(
      element("dt", undefined, key),
      element("dd", undefined, typeof value === "string" ? value : JSON.stringify(value)),
    );
    list.append(row);
  }
  details.append(list);
  return details;
}

function renderObservations(pairId: string): HTMLElement {
  const wrapper = element("div", "media-reveal-observations");
  const own = ownVotes.get(pairId) ?? [];
  own.forEach((vote) => {
    const item = element("p", "small media-observation");
    item.append(
      element("strong", undefined, choiceLabel(vote.choice)),
      element(
        "span",
        undefined,
        ` · ${vote.blind ? "blind when cast" : "unblinded"} · by ${vote.reviewerLabel || "unknown"} (unauthenticated label) · recorded ${instant(vote.createdAt)} · submission ${shortId(vote.submissionId)}`,
      ),
    );
    if (vote.reason) item.append(element("span", "media-observation-reason", ` · reason: ${vote.reason}`));
    if (vote.reasons.length > 0) {
      const chips = element("span", "media-observation-chips", " · chips: ");
      vote.reasons.forEach((reason, index) => {
        if (index > 0) chips.append(document.createTextNode(", "));
        chips.append(element("em", undefined, reason));
      });
      item.append(chips);
    }
    wrapper.append(item);
  });

  const tally = tallies.get(pairId);
  if (tally && tally.submissions.length > 0) {
    const label = `${tally.submissions.length} independent submission${tally.submissions.length === 1 ? "" : "s"} on the server for this pair:`;
    wrapper.append(element("p", "small media-tally-label", label));
    const list = element("ul", "media-tally");
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
  const host = pair.querySelector<HTMLElement>("[data-media-reveal]");
  if (!host) return;
  clear(host);
  host.hidden = false;
  const reveal = revealFor(pair.dataset.pair ?? "");
  if (!reveal) {
    host.append(
      element(
        "p",
        "small",
        "The labels for this pair are not part of the committed record, so they stay unknown rather than guessed.",
      ),
    );
    return;
  }
  const pairId = reveal.pairId;
  const observationPending = pending.has(pairId);
  const head = element("div", "media-reveal-head");
  head.append(
    element("p", "eyebrow", "Revealed by your recorded submission"),
    element(
      "p",
      "media-reveal-verdict",
      entry.choice === "revealed" ? "No preference was recorded." : `Recorded choice: ${choiceLabel(entry.choice)}.`,
    ),
    element(
      "p",
      "small media-reveal-meta",
      `${entry.blind ? "Blind when cast" : "Unblinded"} · reviewer ${entry.reviewerLabel || "unknown"} (unauthenticated label) · ${instant(entry.createdAt)} · submission ${shortId(entry.submissionId)} · token hash ${shortId(entry.reviewerTokenHash)}`,
    ),
  );
  if (entry.reason) head.append(element("p", "media-reveal-reason", `Reason: ${entry.reason}`));
  if (entry.reasons.length > 0) {
    const chips = element("p", "small media-reveal-chips", "Selected reasons: ");
    chips.append(element("span", undefined, entry.reasons.join(" · ")));
    head.append(chips);
  }
  const observe = element(
    "button",
    "button secondary media-observe",
    observationPending ? "Cancel another observation" : "Record another observation",
  );
  observe.type = "button";
  observe.dataset.observe = pairId;
  observe.setAttribute("aria-pressed", observationPending ? "true" : "false");
  head.append(observe);
  head.append(renderObservations(pairId));
  host.append(head);

  const sides = element("div", "media-reveal-sides");
  for (const side of reveal.sides) {
    const article = element("article", "media-reveal-side");
    article.append(
      element("h4", undefined, `${side.title} — ${side.configurationLabel || "unknown"}`),
    );
    const facts = element("dl", "media-reveal-facts");
    const artifact = side.artifact;
    const rows: [string, string][] = [
      ["Model", side.model || "unknown"],
      ["Provider", side.provider || "unknown"],
      ["Harness", `${side.harness || "unknown"} · ${side.harnessVersion || "unknown"}`],
      ["Trial", `${side.trialId} · ${side.status || "unknown"}`],
      ["Job latency", readableDuration(side.latencyMs)],
      ["Clip duration", readableDuration(artifact?.durationMs)],
      ["Dimensions", artifact ? `${artifact.width}×${artifact.height}` : "unknown"],
      ["Bytes", artifact?.bytes ? `${artifact.bytes.toLocaleString("en-AU")} bytes` : "unknown"],
      ["Video", artifact ? `${artifact.videoCodec || "unknown"} · ${artifact.frameRate || "unknown"} fps` : "unknown"],
      ["Audio track", artifact?.audio ? `${artifact.audio.codec || "present"}` : "none recorded"],
      ["Estimate", side.cost ? `${money(side.cost.estimateMicro)} · ${side.cost.basis}` : "not recorded"],
      ["Provider charge", side.cost ? money(side.cost.providerChargedMicro) : "not recorded"],
      ["SHA-256", artifact?.sha256 ? `${artifact.sha256.slice(0, 16)}…` : "unknown"],
    ];
    for (const [label, value] of rows) {
      const row = element("div");
      row.append(element("dt", undefined, label), element("dd", undefined, value));
      facts.append(row);
    }
    article.append(facts, renderChecks(side), renderSettings(side));
    sides.append(article);
  }
  host.append(sides);
}

// The reveal for a pair comes back with this browser's submission. It is kept
// in memory, not requested by a second unauthenticated call.
const reveals = new Map<string, RevealPair>();

function revealFor(pairId: string): RevealPair | null {
  return reveals.get(pairId) ?? null;
}

function paintChips(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  const selected = chipsFor(pairId);
  for (const chip of pair.querySelectorAll<HTMLButtonElement>("[data-reason-chip]")) {
    const token = `${chip.dataset.side}: ${chip.dataset.reason}`;
    const active = selected.has(token);
    chip.dataset.active = active ? "true" : "false";
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function paintPair(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  const entry = latestOwn(pairId);
  const observationPending = pending.has(pairId);
  pair.dataset.revealed = entry ? "true" : "false";
  const status = statusFor(pair);
  const reason = pair.querySelector<HTMLInputElement>("[data-media-reason]");
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
    button.setAttribute(
      "aria-pressed",
      entry && !observationPending && button.dataset.choice === entry.choice ? "true" : "false",
    );
  }
  setControls(pair, Boolean(entry) && !observationPending);
  if (reason && !observationPending && document.activeElement !== reason) reason.value = entry?.reason ?? "";
  const revealHost = pair.querySelector<HTMLElement>("[data-media-reveal]");
  if (entry) renderReveal(pair, entry);
  else if (revealHost) {
    clear(revealHost);
    revealHost.hidden = true;
  }
  paintChips(pair);
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
  for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]")) paintPair(pair);
  const summary = document.querySelector<HTMLElement>("[data-media-summary]");
  if (summary) {
    const ownPairs = [...ownVotes.values()].filter((votes) => votes.length > 0).length;
    summary.textContent = `${ownPairs} of ${pairs} pairs have a submission from this browser (a random token kept in localStorage, not an identity). ${totals.submissions} independent submission${totals.submissions === 1 ? "" : "s"} from ${totals.independentTokens} browser token${totals.independentTokens === 1 ? "" : "s"} are on the server.`;
  }
  const runLink = document.querySelector<HTMLElement>("[data-media-run-link]");
  if (runLink) {
    const ownPairs = [...ownVotes.values()].filter((votes) => votes.length > 0).length;
    runLink.hidden = ownPairs === 0;
    if (ownPairs > 0 && runLink.childElementCount === 0) {
      const revealed = element("a", "button secondary", "Open the revealed run record");
      revealed.href = `/benchmarks/media/runs/${encodeURIComponent(runId)}`;
      const download = element("a", "button secondary", "Download the evidence JSON");
      download.href = `/benchmarks/media/runs/${encodeURIComponent(runId)}/export.json`;
      download.download = `composer-benchmark-media-${runId}.json`;
      const note = element(
        "span",
        undefined,
        " The record lists every submission with its receipt time and token hash; raw browser tokens are not published.",
      );
      runLink.append(revealed, download, note);
    }
  }
}

function availability(message: string, unavailable: boolean) {
  const node = document.querySelector<HTMLElement>("[data-media-availability]");
  if (node) {
    node.textContent = message;
    node.dataset.state = unavailable ? "unavailable" : "ready";
  }
  if (unavailable) {
    for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]"))
      setControls(pair, true);
  } else {
    for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]"))
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
  const reason = pair.querySelector<HTMLInputElement>("[data-media-reason]")?.value ?? "";
  const reviewer = currentReviewer();
  const blind = pair.dataset.revealed === "true" ? false : choice !== "revealed";
  const status = statusFor(pair);
  setControls(pair, true);
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
      body: JSON.stringify({
        run: runId,
        task: taskId,
        pair: pairId,
        choice,
        reason,
        chips: [...chipsFor(pairId)],
        reviewer,
        blind,
      }),
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
    const own = ownVotes.get(vote.pairId) ?? [];
    ownVotes.set(
      vote.pairId,
      [...own, vote].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.submissionId.localeCompare(right.submissionId),
      ),
    );
    if (body.reveal) reveals.set(vote.pairId, body.reveal);
    const existingTally = tallies.get(vote.pairId);
    if (body.tally) tallies.set(vote.pairId, body.tally);
    else if (existingTally)
      tallies.set(vote.pairId, {
        ...existingTally,
        submissions: [
          ...existingTally.submissions,
          {
            submissionId: vote.submissionId,
            choice: vote.choice,
            blind: vote.blind,
            createdAt: vote.createdAt,
          },
        ],
      });
    totals = {
      submissions: body.totals?.submissions ?? totals.submissions,
      independentTokens: body.totals?.independentTokens ?? totals.independentTokens,
    };
    pending.delete(pairId);
    chipsFor(pairId).clear();
    const reasonInput = pair.querySelector<HTMLInputElement>("[data-media-reason]");
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

function toggleReason(pair: HTMLElement, chip: HTMLButtonElement) {
  const pairId = pair.dataset.pair ?? "";
  const side = chip.dataset.side ?? "";
  const reason = chip.dataset.reason ?? "";
  if (!side || !reason) return;
  const selected = chipsFor(pairId);
  const token = `${side}: ${reason}`;
  if (selected.has(token)) selected.delete(token);
  else selected.add(token);
  paintChips(pair);
}

function toggleObservation(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  if (!latestOwn(pairId)) return;
  if (pending.has(pairId)) {
    pending.delete(pairId);
  } else {
    pending.add(pairId);
    chipsFor(pairId).clear();
    const reason = pair.querySelector<HTMLInputElement>("[data-media-reason]");
    if (reason) reason.value = "";
  }
  paintPair(pair);
  if (pending.has(pairId))
    pair.querySelector<HTMLInputElement>("[data-media-reason]")?.focus();
}

function wirePlaybackFallbacks() {
  for (const video of document.querySelectorAll<HTMLVideoElement>("[data-media-video]")) {
    const show = () => {
      const message = video.parentElement?.querySelector<HTMLElement>("[data-media-playback-error]");
      if (message) message.hidden = false;
    };
    video.addEventListener("error", show);
    for (const source of video.querySelectorAll("source")) source.addEventListener("error", show);
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) show();
  }
}

function wirePairs() {
  for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]")) {
    for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
      button.addEventListener("click", () => {
        const choice = button.dataset.choice ?? "";
        if (choice) void sendVote(pair, choice);
      });
    }
    for (const chip of pair.querySelectorAll<HTMLButtonElement>("[data-reason-chip]")) {
      chip.addEventListener("click", () => toggleReason(pair, chip));
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
  const root = document.querySelector<HTMLElement>("[data-media-review]");
  runId = root?.dataset.run ?? "";
  taskId = root?.dataset.task ?? "";
  pairs = document.querySelectorAll<HTMLElement>("[data-media-pair]").length;
  loadToken();
  wirePlaybackFallbacks();
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
