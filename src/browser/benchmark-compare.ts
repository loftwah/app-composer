// MIT. Client behaviour for the Benchmarks Studio comparison page.
//
// Two jobs:
//   1. Show the page a configuration actually produced, live and side by side,
//      without an iframe (the site's policy sets frame-src 'none') and without
//      letting its styles escape into this page. Each preview is mounted in a
//      shadow root from same-origin static files that were sanitised when the
//      trial was published.
//   2. Record which take the reader would use, with a short reason and an
//      optional timestamp, on this device only. A vote is a private note, not a
//      rating that changes the recorded run.

const VOTE_KEY = "composer:benchmark-vote:v1";
const STYLE_FALLBACK = "preview-unavailable";

/** @typedef {{trial: string, configuration: string, choice: boolean, reason: string, at: string, note?: string}} Vote */

/** @returns {Record<string, Vote>} */
function readVotes() {
  try {
    const raw = window.localStorage.getItem(VOTE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

/** @param {Record<string, Vote>} votes */
function writeVotes(votes) {
  try {
    window.localStorage.setItem(VOTE_KEY, JSON.stringify(votes));
  } catch {
    /* a device with no storage still gets the previews and the verdict */
  }
}

/** Strip anything that could execute or leave the sandbox. */
function sanitise(html) {
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
function bodyOf(html) {
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
async function mountPreview(host) {
  const htmlUrl = host.dataset.html;
  const cssUrl = host.dataset.css;
  if (!htmlUrl) return;
  const status = host.querySelector("[data-preview-status]");
  try {
    const [htmlResponse, cssResponse] = await Promise.all([
      fetch(htmlUrl, { credentials: "omit" }),
      cssUrl ? fetch(cssUrl, { credentials: "omit" }) : Promise.resolve(null),
    ]);
    if (!htmlResponse.ok) throw new Error(`The recorded page returned ${htmlResponse.status}.`);
    const html = await htmlResponse.text();
    const css = cssResponse && cssResponse.ok ? await cssResponse.text() : "";
    const root = host.querySelector("[data-preview-canvas]");
    if (!root) throw new Error("No preview canvas.");
    root.textContent = "";
    // A shadow root keeps the produced page's selectors and colours inside the
    // card, so two previews can sit next to each other without colliding.
    const mounted = document.createElement("div");
    mounted.className = "preview-host";
    const shadow = mounted.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${css}\n:host{all:initial;display:block;color:inherit;background:#fff;font-family:system-ui,sans-serif}\n:host body,:host .page{margin:0}`;
    const body = document.createElement("div");
    body.innerHTML = sanitise(bodyOf(html));
    shadow.append(style, body);
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

/** Paint the saved vote state into every trial card. */
function paintVotes() {
  const votes = readVotes();
  for (const card of document.querySelectorAll("[data-trial]")) {
    const trial = card.getAttribute("data-trial") ?? "";
    const vote = votes[trial];
    const badge = card.querySelector("[data-vote-badge]");
    const button = card.querySelector("[data-vote-button]");
    const note = card.querySelector("[data-vote-note]");
    const reason = card.querySelector("[data-vote-reason]");
    const stamp = card.querySelector("[data-vote-at]");
    if (badge) badge.hidden = !vote?.choice;
    if (button) button.setAttribute("aria-pressed", vote?.choice ? "true" : "false");
    if (reason && document.activeElement !== reason) reason.value = vote?.reason ?? "";
    if (stamp && document.activeElement !== stamp) stamp.value = vote?.at ?? "";
    if (note) note.hidden = !(vote?.reason || vote?.at);
  }
  const tally = document.querySelector("[data-vote-tally]");
  if (tally) {
    const chosen = Object.values(votes).filter((vote) => vote?.choice).length;
    tally.textContent =
      chosen === 0
        ? "No take picked yet. Choose the one you would actually use."
        : `${chosen} take${chosen === 1 ? "" : "s"} picked on this device. Your notes stay in this browser.`;
  }
}

/** @param {HTMLElement} card */
function wireTrial(card) {
  const trial = card.getAttribute("data-trial") ?? "";
  const button = card.querySelector("[data-vote-button]");
  const reason = card.querySelector("[data-vote-reason]");
  const stamp = card.querySelector("[data-vote-at]");

  button?.addEventListener("click", () => {
    const votes = readVotes();
    const chosen = !votes[trial]?.choice;
    // One pick per job: choosing a take clears the other picks in this comparison.
    for (const key of Object.keys(votes)) {
      if (votes[key]) votes[key] = { ...votes[key], choice: false };
    }
    votes[trial] = {
      trial,
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
      const existing = votes[trial];
      if (!existing) return;
      votes[trial] = {
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
  for (const control of document.querySelectorAll("[data-compare-select]")) {
    control.addEventListener("change", () => {
      const target = control.getAttribute("data-compare-select") ?? "";
      const value = control instanceof HTMLSelectElement ? control.value : "";
      for (const panel of document.querySelectorAll(`[data-compare-panel="${target}"]`)) {
        panel.hidden = panel.getAttribute("data-compare-trial") !== value;
      }
    });
  }
}

function main() {
  for (const host of document.querySelectorAll("[data-trial-preview]")) void mountPreview(host);
  for (const card of document.querySelectorAll("[data-trial]")) wireTrial(card);
  wireSwitcher();
  paintVotes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  main();
}

export {};
