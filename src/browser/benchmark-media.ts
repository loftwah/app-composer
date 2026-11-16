// MIT. Client behaviour for the Benchmarks Studio matched media comparison.
//
// The page ships two playable saved clips behind opaque pair/side URLs. Until
// the server returns a recorded vote for this reviewer label, the browser gets
// no model, provider, configuration or trial name. The reveal is server-side
// and survives a reload; there is no localStorage vote.
//
// Feedback is one short text field, not a second scoring system. The chips add
// a take prefix ("A: holds the still") so a reason names the side it describes.

type Check = { id: string; name: string; kind: string; status: string; detail: string };

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

function applyReviewerVotes() {
  recorded.clear();
  const reviewer = currentReviewer();
  for (const vote of allVotes) {
    if (vote.reviewerLabel === reviewer) recorded.set(vote.pairId, { vote, reveal: vote.reveal ?? null });
  }
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

function statusFor(pair: HTMLElement): HTMLElement | null {
  return pair.querySelector<HTMLElement>("[data-media-status]");
}

function setButtons(pair: HTMLElement, disabled: boolean) {
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]"))
    button.disabled = disabled;
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

function renderReveal(pair: HTMLElement, entry: Recorded) {
  const host = pair.querySelector<HTMLElement>("[data-media-reveal]");
  if (!host) return;
  clear(host);
  host.hidden = false;
  const reveal = entry.reveal;
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
  const vote = entry.vote;
  const head = element("div", "media-reveal-head");
  head.append(
    element("p", "eyebrow", "Revealed"),
    element(
      "p",
      "media-reveal-verdict",
      vote.choice === "revealed" ? "No preference was recorded." : `Recorded choice: ${choiceLabel(vote.choice)}.`,
    ),
    element(
      "p",
      "small media-reveal-meta",
      `${vote.blind ? "Blind when cast" : "Unblinded"} · reviewer ${vote.reviewerLabel || "unknown"} (unauthenticated label) · ${instant(vote.updatedAt)}${vote.updatedAt !== vote.createdAt ? " · updated" : ""}`,
    ),
  );
  if (vote.reason) head.append(element("p", "media-reveal-reason", `Reason: ${vote.reason}`));
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

function paintChips(pair: HTMLElement) {
  const input = pair.querySelector<HTMLInputElement>("[data-media-reason]");
  const value = input?.value ?? "";
  for (const chip of pair.querySelectorAll<HTMLButtonElement>("[data-reason-chip]")) {
    const token = `${chip.dataset.side}: ${chip.dataset.reason}`;
    chip.dataset.active = value.includes(token) ? "true" : "false";
    chip.setAttribute("aria-pressed", value.includes(token) ? "true" : "false");
  }
}

function paintPair(pair: HTMLElement) {
  const pairId = pair.dataset.pair ?? "";
  const entry = recorded.get(pairId);
  pair.dataset.revealed = entry ? "true" : "false";
  const status = statusFor(pair);
  const reason = pair.querySelector<HTMLInputElement>("[data-media-reason]");
  for (const button of pair.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
    button.setAttribute(
      "aria-pressed",
      entry && button.dataset.choice === entry.vote.choice ? "true" : "false",
    );
  }
  if (reason && document.activeElement !== reason) reason.value = entry?.vote.reason ?? "";
  const revealHost = pair.querySelector<HTMLElement>("[data-media-reveal]");
  if (entry) renderReveal(pair, entry);
  else if (revealHost) {
    clear(revealHost);
    revealHost.hidden = true;
  }
  paintChips(pair);
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
  for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]")) paintPair(pair);
  const summary = document.querySelector<HTMLElement>("[data-media-summary]");
  if (summary) {
    const reviewer = currentReviewer();
    summary.textContent =
      recorded.size === 0
        ? `0 of ${pairs} pairs recorded for reviewer ${reviewer} (unauthenticated label) on the server. Only this label's votes are restored on this page.`
        : `${recorded.size} of ${pairs} pairs recorded for reviewer ${reviewer} (unauthenticated label) on the server. Reloading this page restores them.`;
  }
  const runLink = document.querySelector<HTMLElement>("[data-media-run-link]");
  if (runLink) {
    runLink.hidden = recorded.size === 0;
    if (recorded.size > 0 && runLink.childElementCount === 0) {
      const revealed = element("a", "button secondary", "Open the revealed run record");
      revealed.href = `/benchmarks/media/runs/${encodeURIComponent(runId)}`;
      const download = element("a", "button secondary", "Download the evidence JSON");
      download.href = `/benchmarks/media/runs/${encodeURIComponent(runId)}/export.json`;
      download.download = `composer-benchmark-media-${runId}.json`;
      const note = element(
        "span",
        undefined,
        " The record shows every label, trial, setting and recorded vote; the export reopens the same view.",
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
      setButtons(pair, true);
  } else {
    for (const pair of document.querySelectorAll<HTMLElement>("[data-media-pair]"))
      setButtons(pair, false);
  }
}

async function loadVotes() {
  const token = ++loadToken;
  try {
    const response = await fetch(
      `/api/benchmark-votes?run=${encodeURIComponent(runId)}&reviewer=${encodeURIComponent(currentReviewer())}`,
      { headers: { Accept: "application/json" }, credentials: "same-origin" },
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
  const reason = pair.querySelector<HTMLInputElement>("[data-media-reason]")?.value ?? "";
  const reviewer = currentReviewer();
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

function toggleReason(pair: HTMLElement, chip: HTMLButtonElement) {
  const input = pair.querySelector<HTMLInputElement>("[data-media-reason]");
  if (!input) return;
  const side = chip.dataset.side ?? "";
  const reason = chip.dataset.reason ?? "";
  if (!side || !reason) return;
  const token = `${side}: ${reason}`;
  let value = input.value;
  if (value.includes(token)) {
    value = value
      .replace(token, "")
      .replace(/;\s*;/g, "; ")
      .replace(/^;\s*/, "")
      .replace(/;\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    value = value.trim().length > 0 ? `${value.replace(/;\s*$/, "")}; ${token}` : token;
  }
  input.value = value.slice(0, 240);
  paintChips(pair);
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
    pair.querySelector<HTMLInputElement>("[data-media-reason]")?.addEventListener("input", () =>
      paintChips(pair),
    );
  }
}

function main() {
  const root = document.querySelector<HTMLElement>("[data-media-review]");
  runId = root?.dataset.run ?? "";
  taskId = root?.dataset.task ?? "";
  pairs = document.querySelectorAll<HTMLElement>("[data-media-pair]").length;
  wirePlaybackFallbacks();
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
