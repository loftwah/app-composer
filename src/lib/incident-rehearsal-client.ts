// Browser controller for the write-free incident rehearsal on /incident-replay.
// It performs no network request and never calls an admin endpoint.
import { replaySitrep } from "./incident-replay.ts";
import {
  decide,
  emailPreview,
  requestChanges,
  resetRehearsal,
  startRehearsal,
  type RehearsalState,
} from "./incident-rehearsal.ts";

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

export function mountIncidentRehearsal(root: Element | null): void {
  if (!root) return;
  const container = root;
  container.replaceChildren();
  let state: RehearsalState = startRehearsal(replaySitrep);
  let message =
    "Version 1 is awaiting review. Send it back with instructions, or decide it.";
  let note = "";

  const badge = element("p", "rehearsal-badge", "Simulated rehearsal · no network, no email, no execution");
  const status = element("p", "rehearsal-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.tabIndex = -1;
  const versions = element("div", "rehearsal-versions");
  const controls = element("div", "rehearsal-controls");
  const outcome = element("div", "rehearsal-outcome");

  const preview = emailPreview(replaySitrep);
  const email = element("details", "rehearsal-email");
  email.appendChild(
    element("summary", undefined, "Preview the owner notification (not sent)"),
  );
  const emailBody = element("div", "rehearsal-email-body");
  emailBody.appendChild(element("p", undefined, `To: ${preview.to}`));
  emailBody.appendChild(element("p", undefined, `Subject: ${preview.subject}`));
  const pre = element("pre", "rehearsal-email-text", preview.body);
  emailBody.appendChild(pre);
  emailBody.appendChild(element("p", "rehearsal-muted", preview.note));
  email.appendChild(emailBody);

  const reset = element("button", "rehearsal-reset", "Reset rehearsal");
  reset.type = "button";
  reset.addEventListener("click", () => {
    state = resetRehearsal(replaySitrep);
    message = "Rehearsal reset. No outside record was changed.";
    note = "";
    paint("none");
  });

  function versionCard(version: RehearsalState["versions"][number]) {
    const card = element("article", "rehearsal-version");
    const head = element("div", "rehearsal-version-head");
    head.appendChild(element("h3", undefined, `Version ${version.version}`));
    const active = version.version === state.active && state.stage === "review";
    head.appendChild(
      element(
        "span",
        active ? "rehearsal-tag is-active" : "rehearsal-tag",
        active ? "Active proposal" : version.version === 1 && state.versions.length > 1 ? "Retained · stale for approval" : "Retained",
      ),
    );
    card.appendChild(head);
    card.appendChild(element("p", "rehearsal-digest", `Digest ${version.digest}`));
    const list = element("ul", "rehearsal-evidence");
    for (const item of version.evidence) list.appendChild(element("li", undefined, item.label));
    card.appendChild(list);
    card.appendChild(element("p", undefined, version.change));
    card.appendChild(element("p", "rehearsal-muted", `Submitted ${version.submittedAt}`));
    return card;
  }

  function paint(focus: "status" | "outcome" | "note" | "none") {
    versions.replaceChildren(...state.versions.map(versionCard));
    controls.replaceChildren();
    outcome.replaceChildren();
    outcome.hidden = state.stage === "review";
    status.textContent = message;
    if (state.stage === "review") {
      if (state.versions.length === 1) {
        const label = element("label", "rehearsal-label", "What must change before approval?");
        label.htmlFor = "rehearsal-note";
        const input = element("textarea", "rehearsal-note");
        input.id = "rehearsal-note";
        input.maxLength = 500;
        input.rows = 3;
        input.placeholder =
          "For example: keep the failing request and control, reproduce the missing caption, add a regression check.";
        input.value = note;
        input.addEventListener("input", () => {
          note = input.value;
        });
        const send = element("button", "rehearsal-primary", "Send back with notes");
        send.type = "button";
        send.addEventListener("click", () => {
          const result = requestChanges(state, note);
          state = result.state;
          message = result.message;
          note = "";
          paint(result.ok ? "status" : "note");
        });
        const approve = element("button", undefined, "Approve version 1");
        approve.type = "button";
        approve.addEventListener("click", () => {
          const result = decide(state, "approve", 1);
          state = result.state;
          message = result.message;
          paint("outcome");
        });
        const reject = element("button", undefined, "Reject");
        reject.type = "button";
        reject.addEventListener("click", () => {
          const result = decide(state, "reject", 1);
          state = result.state;
          message = result.message;
          paint("outcome");
        });
        controls.append(label, input, send, approve, reject);
      } else {
        controls.appendChild(
          element(
            "p",
            "rehearsal-note-retained",
            `Send-back instruction retained: “${state.note}”`,
          ),
        );
        const approve = element("button", "rehearsal-primary", "Approve version 2");
        approve.type = "button";
        approve.addEventListener("click", () => {
          const result = decide(state, "approve", 2);
          state = result.state;
          message = result.message;
          paint("outcome");
        });
        const stale = element("button", undefined, "Try approving stale version 1");
        stale.type = "button";
        stale.addEventListener("click", () => {
          const result = decide(state, "approve", 1);
          state = result.state;
          message = result.message;
          paint("status");
        });
        const reject = element("button", undefined, "Reject version 2");
        reject.type = "button";
        reject.addEventListener("click", () => {
          const result = decide(state, "reject", 2);
          state = result.state;
          message = result.message;
          paint("outcome");
        });
        controls.append(approve, stale, reject);
      }
      if (focus === "note") {
        const input = container.querySelector<HTMLTextAreaElement>("#rehearsal-note");
        input?.focus();
      }
    } else {
      const heading = element(
        "h3",
        undefined,
        state.stage === "approved" ? "Simulated approval recorded" : "Proposal rejected",
      );
      heading.tabIndex = -1;
      outcome.appendChild(heading);
      outcome.appendChild(element("p", undefined, state.outcome ?? ""));
      outcome.appendChild(
        element(
          "p",
          "rehearsal-muted",
          "Opening this page or pressing a button sends no notification, starts no agent and changes no application. The private Incident Desk is a separate signed-in surface.",
        ),
      );
      if (focus === "outcome") heading.focus();
    }
    if (focus === "status") status.focus();
  }

  const live = element("div", "rehearsal-live");
  live.append(status, versions, controls, outcome, email, reset);
  container.append(badge, live);
  paint("none");
}
