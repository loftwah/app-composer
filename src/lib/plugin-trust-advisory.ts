// Bounded, credential-free advisory-source seam for Plugin Trust.
//
// This is an adapter interface, not a feed. No licensed source is purchased,
// configured or called by default. A caller may inject one adapter; it receives
// only the package identity and a time budget, never a token, cookie, account
// or filesystem path. A missing, unsupported or failed adapter is recorded as
// ADVISORY_SOURCE_NONE or ADVISORY_SOURCE_UNKNOWN and is never treated as a
// clean vulnerability result.
import { z } from "zod";

export const advisorySourceStates = ["none", "unknown", "checked"] as const;
export const advisorySeverities = [
  "low",
  "moderate",
  "high",
  "critical",
] as const;

const adapterId = z.string().regex(/^[a-z][a-z0-9-]{0,40}$/);
export const advisoryFinding = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._:-]{1,120}$/),
    severity: z.enum(advisorySeverities),
    summary: z.string().min(1).max(300),
    url: z.url().max(300).nullable(),
  })
  .strict();

export const advisoryState = z
  .object({
    source: z.enum(advisorySourceStates),
    adapter: adapterId,
    checkedAt: z.iso.datetime().nullable(),
    findings: z.array(advisoryFinding).max(20),
    note: z.string().min(1).max(300),
  })
  .strict();

export type AdvisoryState = z.infer<typeof advisoryState>;
export type AdvisoryFinding = z.infer<typeof advisoryFinding>;
export type AdvisoryAdapter = {
  id: string;
  // Credential-free by contract: this request carries package identity only.
  read(input: {
    did: string;
    slug: string;
    version: string;
  }): Promise<AdvisoryState>;
};

export const advisoryOff: AdvisoryState = {
  source: "none",
  adapter: "none",
  checkedAt: null,
  findings: [],
  note: "No advisory source is configured. Absence of advisories is not a clean result.",
};

export function advisoryUnavailable(
  adapter: string,
  checkedAt: string | null,
  note = "The advisory source could not be read. This is not a clean result.",
): AdvisoryState {
  return {
    source: "unknown",
    adapter: adapterId.parse(adapter),
    checkedAt,
    findings: [],
    note: note.slice(0, 300),
  };
}

// A null adapter is the default and stays off. A configured adapter that
// throws, times out, returns another adapter's identity or an invalid shape is
// recorded as unknown, never as a clean checked result.
export async function readAdvisory(
  adapter: AdvisoryAdapter | null | undefined,
  input: { did: string; slug: string; version: string },
  now = new Date(),
): Promise<AdvisoryState> {
  if (!adapter) return advisoryOff;
  try {
    const result = advisoryState.parse(await adapter.read(input));
    if (result.adapter !== adapter.id) throw Error("adapter identity differs");
    return result;
  } catch {
    return advisoryUnavailable(adapter.id, now.toISOString());
  }
}

// A stable signature for change detection. An absent advisory field and an
// explicit `none` state describe the same coverage, so the first observation
// after this seam ships does not raise noise.
export function advisorySignature(plugin: {
  advisory?: AdvisoryState;
}): string {
  const state = plugin.advisory;
  if (!state || state.source === "none") return "none";
  if (state.source === "unknown") return "unknown:" + state.adapter;
  return (
    "checked:" +
    state.adapter +
    ":" +
    [...state.findings]
      .map((finding) => finding.id + ":" + finding.severity)
      .sort()
      .join(",")
  );
}

export function advisoryWorstFinding(
  state: AdvisoryState,
): AdvisoryFinding | null {
  const rank: Record<AdvisoryFinding["severity"], number> = {
    low: 0,
    moderate: 1,
    high: 2,
    critical: 3,
  };
  return (
    [...state.findings].sort(
      (left, right) => rank[right.severity] - rank[left.severity],
    )[0] ?? null
  );
}
