// A deterministic, write-free rehearsal of the incident decision contract.
//
// The public replay may show what a review would do, but it can never notify,
// deploy, execute recovery or approve real work. This module is deliberately
// pure: the page passes the pinned replay incident and receives the next state.
import type { IncidentSitrep } from "./incident-contract.ts";

export const rehearsalVersion = "composer.incident-rehearsal/1";

export interface RehearsalEvidence {
  id: string;
  label: string;
}

export interface RehearsalVersion {
  version: 1 | 2;
  digest: string;
  evidence: RehearsalEvidence[];
  change: string;
  submittedAt: string;
}

export type RehearsalStage = "review" | "approved" | "rejected";

export interface RehearsalState {
  version: typeof rehearsalVersion;
  incident: string;
  stage: RehearsalStage;
  active: 1 | 2;
  versions: RehearsalVersion[];
  note: string;
  decision: "none" | "changes-requested" | "approved" | "rejected";
  decisionLabel: string;
  outcome: string | null;
  /** Always false here; the field exists so the UI cannot imply a send. */
  emailSent: false;
  writesPerformed: 0;
}

export interface RehearsalResult {
  state: RehearsalState;
  ok: boolean;
  message: string;
  repeated?: boolean;
}

const evidence = {
  journey: { id: "journey-01", label: "Visitor-book journey returned HTTP 500." },
  control: { id: "control-01", label: "The separate Team B control still matched." },
  caption: {
    id: "caption-01",
    label: "The same request with a missing caption reproduced the 500.",
  },
  data: {
    id: "data-read-01",
    label: "The scoped data read still answered; health was not inferred from it.",
  },
  regression: {
    id: "regression-01",
    label: "A missing-caption regression check now fails before release.",
  },
} as const;

export function digestOf(value: unknown): string {
  const text = JSON.stringify(value);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return (a.toString(16) + b.toString(16)).padStart(16, "0").slice(0, 12);
}

export function emailPreview(incident: IncidentSitrep) {
  return {
    sent: false as const,
    to: "owner@example.invalid",
    subject: `Review ${incident.id}: ${incident.service} needs a decision`,
    body: [
      `Impact: ${incident.impact}`,
      `First seen: ${incident.firstSeen}`,
      `Recovery: ${incident.recovery.replaceAll("-", " ")}`,
      "Open the private Incident Desk to review this proposal.",
      "This is a rehearsal preview. No message was sent and no link grants approval.",
    ].join("\n"),
    note: "Fictional recipient and fixture body. No delivery provider is contacted.",
  };
}

export function startRehearsal(incident: IncidentSitrep): RehearsalState {
  const first = versionOne();
  return {
    version: rehearsalVersion,
    incident: incident.id,
    stage: "review",
    active: 1,
    versions: [first],
    note: "",
    decision: "none",
    decisionLabel: "Awaiting the owner",
    outcome: null,
    emailSent: false,
    writesPerformed: 0,
  };
}

function versionOne(): RehearsalVersion {
  return {
    version: 1,
    digest: digestOf({ evidence: [evidence.journey.id, evidence.control.id] }),
    evidence: [evidence.journey, evidence.control],
    change:
      "Guard the optional caption before use and add a missing-caption regression check.",
    submittedAt: "2026-10-25T00:04:00Z",
  };
}

function versionTwo(note: string): RehearsalVersion {
  return {
    version: 2,
    digest: digestOf({
      evidence: [
        evidence.journey.id,
        evidence.control.id,
        evidence.caption.id,
        evidence.data.id,
        evidence.regression.id,
      ],
      note,
    }),
    evidence: [
      evidence.journey,
      evidence.control,
      evidence.caption,
      evidence.data,
      evidence.regression,
    ],
    change:
      "Guard the optional caption before use; retain the missing-caption reproduction and add a regression check before release.",
    submittedAt: "2026-10-25T00:09:00Z",
  };
}

const copy = (state: RehearsalState, patch: Partial<RehearsalState>): RehearsalState => ({
  ...state,
  ...patch,
  versions: patch.versions ?? state.versions,
});

/**
 * Send back with useful instructions. The first proposal stays readable, a
 * linked second version is created, and the old digest can no longer approve.
 */
export function requestChanges(state: RehearsalState, note: string): RehearsalResult {
  if (state.stage !== "review")
    return { state, ok: false, message: "This rehearsal has already ended. Reset it to try again." };
  const clean = note.trim().replace(/\s+/g, " ");
  if (clean.length < 12)
    return {
      state,
      ok: false,
      message: "Add at least 12 characters of useful instruction. A send-back needs a real reason.",
    };
  if (clean.length > 500)
    return {
      state,
      ok: false,
      message: "Keep the instruction within 500 characters for this rehearsal.",
    };
  if (state.versions.length > 1)
    return { state, ok: false, message: "Version 2 already exists in this rehearsal." };
  return {
    state: copy(state, {
      stage: "review",
      active: 2,
      versions: [...state.versions, versionTwo(clean)],
      note: clean,
      decision: "changes-requested",
      decisionLabel: "Changes requested on version 1",
      outcome: null,
    }),
    ok: true,
    message:
      "Version 1 is retained with its note. Version 2 has a new digest; the old approval is invalid.",
  };
}

/** A decision only applies to the active version; a stale version is refused. */
export function decide(
  state: RehearsalState,
  decision: "approve" | "reject",
  version: number,
): RehearsalResult {
  if (state.stage !== "review")
    return {
      state,
      ok: false,
      repeated: state.stage === "approved" && decision === "approve",
      message:
        state.stage === "approved"
          ? "This rehearsal is already approved. No effect was or will be performed."
          : "This rehearsal is already closed. Reset it to try again.",
    };
  if (version !== state.active)
    return {
      state,
      ok: false,
      message:
        version === 1 && state.active === 2
          ? "Version 1 is stale after the send-back. Decide on version 2."
          : "That version is not the active proposal.",
    };
  if (decision === "approve") {
    const active = state.versions.find((entry) => entry.version === state.active)!;
    return {
      state: copy(state, {
        stage: "approved",
        decision: "approved",
        decisionLabel: `Version ${active.version} approved`,
        outcome:
          "Rehearsal outcome: the decision is recorded here only. No email was sent, no deployment ran and no recovery was executed. A real approval would need the separate signed-in Incident Desk and its own execution check.",
      }),
      ok: true,
      message: `Approved version ${active.version} in this rehearsal. Nothing was executed.`,
    };
  }
  return {
    state: copy(state, {
      stage: "rejected",
      decision: "rejected",
      decisionLabel: `Version ${state.active} rejected`,
      outcome:
        "The proposal is rejected for this rehearsal only. Its evidence and versions stay readable; the incident is not automatically resolved and no recovery was attempted.",
    }),
    ok: true,
    message: "Rejected in this rehearsal. The investigation and versions are preserved.",
  };
}

export function resetRehearsal(incident: IncidentSitrep): RehearsalState {
  return startRehearsal(incident);
}
