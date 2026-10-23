import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import { decodePlatformList } from "../plugins/platform/protocol.ts";
import type { PlatformAssessment } from "../../lib/get-ready/platform.mjs";

const setup = z
  .object({
    target: z
      .object({
        account: z.string().max(80),
        environment: z.string().max(40),
        url: z.string().max(250),
      })
      .strict(),
    existingStacks: z.number().int().min(0).max(1000000),
    managed: z.boolean(),
    canConfigurePolicy: z.boolean().optional(),
  })
  .strict();
export const unavailable =
  "Sign in with EmDash, then check again. Your account needs current workspace access; an invitation alone does not grant it.";

export async function currentPlatform(
  workspace: string,
  installationOrigin: string,
  transport: typeof apiFetch = apiFetch,
) {
  const query = new URLSearchParams({ action: "list", workspace });
  const options = { cache: "no-store", redirect: "error" } as const;
  let response = await transport(
    "/_emdash/api/plugins/composer-members/platformRead?" + query,
    options,
  );
  // Compatibility with the first platform release. A denial never triggers
  // another identity or route; only an absent endpoint uses the older reader.
  if (response.status === 404)
    response = await transport(
      "/_emdash/api/plugins/composer-stacks/platformRead?" + query,
      options,
    );
  const raw = await parseApiResponse<unknown>(response, unavailable);
  const snapshot = decodePlatformList(raw);
  if (snapshot.workspace.id !== workspace)
    throw Error(
      "The server returned another workspace. Select the intended team and check again.",
    );
  const extra =
    raw && typeof raw === "object" && "setup" in raw
      ? setup.parse(raw.setup)
      : undefined;
  if (extra && extra.target.url !== installationOrigin + "/guestbook")
    throw Error(
      "The reported app connection belongs to another installation. Ask the operator to inspect it.",
    );
  return { ...snapshot, ...(extra ? { setup: extra } : {}) };
}

export function platformContinuation(assessment: PlatformAssessment) {
  const report = assessment.report;
  const native =
    "/_emdash/admin/plugins/composer-stacks/platform?" +
    new URLSearchParams({ workspace: report.workspace.id });
  const member =
    "/me?" +
    new URLSearchParams({ view: "platform", workspace: report.workspace.id });
  return report.workspace.role === "viewer"
    ? { href: native, label: "View protected platform" }
    : assessment.next.id === "adoption"
      ? { href: "/people", label: "Review teams and access" }
      : report.operator
        ? { href: native, label: "Open protected platform" }
        : { href: member, label: "Open my team applications" };
}
