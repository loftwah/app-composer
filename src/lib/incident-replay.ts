import { incidentSitrep } from "./incident-contract.ts";

/** Public invented data, deliberately separate from every private database. */
export const replaySitrep = incidentSitrep.parse({
  version: "composer.incident-sitrep/1",
  id: "replay-trail-notes-0001",
  mode: "replay",
  service: "Fictional Trail Notes",
  owner: "Fictional Team A",
  impact:
    "The visitor-book page is unavailable in this fictional example; a shallow health check still responds.",
  firstSeen: "2026-10-25T00:00:00Z",
  lastSeen: "2026-10-25T00:03:00Z",
  observations: [
    {
      text: "The visitor-book journey returns 500; the health route returns 200.",
      evidence: "journey-01",
    },
    {
      text: "The separate Team B control still returns its expected content.",
      evidence: "control-01",
    },
  ],
  hypotheses: [
    {
      explanation:
        "The optional caption is used as text before its presence is checked.",
      confidence: "possible",
      nextCheck:
        "Run the exact request with a missing caption and compare the retained source.",
    },
    {
      explanation: "The data service may be unreachable.",
      confidence: "possible",
      nextCheck:
        "Check the scoped data read independently; do not infer health from a root response.",
    },
  ],
  stepsTaken: [
    "Retained the failing request and the unchanged control result.",
    "Prepared an investigation proposal; no recovery action has run.",
  ],
  unknowns: [
    "Root cause and compatible recovery remain unverified.",
    "No email or PagerDuty connection has been exercised.",
  ],
  nextUpdate:
    "After the missing-caption reproduction and scoped data check are attached to a new proposal version.",
  recovery: "unverified",
  notification: "not-sent",
});
