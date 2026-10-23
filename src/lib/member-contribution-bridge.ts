// Trusted server bridge: browser input never supplies configuration or data class.
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { StackError } from "./stacks.mjs";
import { appSettings } from "./app-settings.mjs";
import { platformProfile, platformRequest } from "./platform-contract.ts";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import {
  contributionConfiguration,
  contributionInput,
  contributionLookup,
  memberContributionsQualified,
  memberServiceV2,
} from "./member-contribution-contract.ts";

const origin = "https://composer.loftwah.com";
const conflict = () =>
  new StackError(
    "CONFLICT",
    "The governed service or its active configuration changed. Refresh its current state before continuing.",
    409,
  );
interface GovernedRow {
  profile_json: string;
  request_json: string;
  request_status: string;
  stack_status: string;
  published_json: string;
  configuration_revision: number;
  configuration_digest: string;
  configuration_source: string;
  configuration_json: string;
}
const publication = z.object({
  instances: z.array(
    z.object({
      app: z.string(),
      resource: z
        .object({
          id: z.string(),
          configurationRevision: z.number().int().positive(),
          digest: z.string(),
          source: z.string(),
        })
        .optional(),
    }),
  ),
});

// Also used by focused contract tests. Authority comes from the trusted SQL
// selection and current service checks in prepareGovernedMemberOperation.
export function governedSyntheticConfiguration(
  row: GovernedRow,
  resource: string,
  contributing: boolean,
) {
  const request = platformRequest.parse(JSON.parse(row.request_json));
  const profile = platformProfile.parse(JSON.parse(row.profile_json));
  if (
    row.request_status !== "complete" ||
    row.stack_status !== "published" ||
    request.recipe !== "guestbook" ||
    request.environment !== "preview" ||
    request.dataClass !== "synthetic"
  )
    throw conflict();
  const configuration = contributionConfiguration.parse({
    revision: row.configuration_revision,
    digest: row.configuration_digest,
    source: row.configuration_source,
  });
  const values = z
    .object({ guestAccess: z.enum(["closed", "postcards", "members"]) })
    .parse(JSON.parse(row.configuration_json));
  if (
    contributing &&
    (!profile.enabled ||
      profile.allowMemberContributions !== true ||
      !profile.allowedRecipes.includes("guestbook") ||
      !profile.environments.includes("preview") ||
      !profile.dataClasses.includes("synthetic") ||
      request.contributions !== "members" ||
      values.guestAccess !== "members")
  )
    throw new StackError(
      "FORBIDDEN",
      "Member contributions require current workspace opt-in and an active member-only application. Public postcard access is separate.",
      403,
    );
  const selected = publication
    .parse(JSON.parse(row.published_json))
    .instances.some(
      (instance) =>
        instance.app === "guestbook" &&
        instance.resource?.id === resource &&
        instance.resource.configurationRevision === configuration.revision &&
        instance.resource.digest === configuration.digest &&
        instance.resource.source === configuration.source,
    );
  if (!selected) throw conflict();
  return configuration;
}

export async function prepareGovernedMemberOperation(
  db: D1Database,
  actor: { issuer: string; accountId: string },
  workspace: string,
  resource: string,
  action: "contribute" | "moderate" | "contribution-status",
  input: unknown,
  runtime: ResourceRuntime,
  source: string,
) {
  if (!memberContributionsQualified())
    throw new StackError(
      "UNSUPPORTED",
      "The reviewed current Guestbook source does not qualify member contributions. No submission was sent.",
    );
  if (source !== appSettings.guestbook.source.commit) throw conflict();
  const selectedInput =
    action === "contribute"
      ? contributionInput.parse(input)
      : action === "contribution-status"
        ? contributionLookup.parse(input)
        : input;
  const selection = `FROM creator_platform_requests r JOIN creator_platform_profiles p ON p.workspace_id=r.workspace_id
    JOIN creator_stacks s ON s.id=r.stack_id AND s.workspace_id=r.workspace_id
    JOIN creator_stack_resource_bindings b ON b.stack_id=s.id
    JOIN creator_app_resources a ON a.id=b.resource_id AND a.workspace_id=r.workspace_id
    WHERE r.workspace_id=? AND a.id=? AND a.app='guestbook' AND a.state='ready'
    AND a.account_id=? AND a.environment=? AND a.target=?`;
  const values = [
    workspace,
    resource,
    String(runtime.RESOURCE_ACCOUNT_ID),
    String(runtime.RESOURCE_ENVIRONMENT),
    origin + "/guestbook",
  ];
  const read = () =>
    db
      .prepare(
        `SELECT p.profile_json,r.request_json,r.status AS request_status,
    s.status AS stack_status,s.published_json,a.configuration_revision,a.configuration_digest,a.configuration_source,a.configuration_json
    ${selection} LIMIT 1`,
      )
      .bind(...values)
      .first<GovernedRow>();
  const before = await read();
  if (!before) throw conflict();
  const configuration = governedSyntheticConfiguration(
    before,
    resource,
    action === "contribute",
  );
  if (configuration.source !== source) throw conflict();
  const connection = resourceConnection(runtime, workspace);
  const actual = await connection.status(resource);
  if (
    (action !== "contribution-status" &&
      (!actual.resource.visible || actual.resource.paused)) ||
    !actual.configuration ||
    actual.configuration.revision !== configuration.revision ||
    actual.configuration.digest !== configuration.digest ||
    actual.configuration.source !== configuration.source ||
    (action === "contribute" &&
      actual.configuration.values.guestAccess !== "members")
  )
    throw conflict();
  const build = await runtime.GUESTBOOK!.fetch(
    new Request(origin + "/guestbook/build.json", {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "X-Composer-Verification": "1" },
    }),
  );
  if (!build.ok) throw conflict();
  const reader = build.body?.getReader();
  if (!reader) throw conflict();
  let bytes = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 32768) throw conflict();
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel();
  }
  const identity = z
    .object({ revision: z.literal(source), memberService: memberServiceV2 })
    .safeParse(JSON.parse(text));
  if (!identity.success) throw conflict();
  const current = await read();
  if (!current || JSON.stringify(current) !== JSON.stringify(before))
    throw conflict();
  let contributionAllowed = false;
  if (action === "contribution-status") {
    try {
      governedSyntheticConfiguration(current, resource, true);
      contributionAllowed =
        actual.resource.visible &&
        !actual.resource.paused &&
        actual.configuration.values.guestAccess === "members";
    } catch {
      /* Original receipts remain observable after explicit closure. */
    }
  }
  const envelope = {
    schema: "composer.member-operation/2" as const,
    actor,
    workspace,
    resource,
    action,
    configuration,
    context: { dataClass: "synthetic" as const },
    input: selectedInput,
  };
  return {
    envelope,
    contributionAllowed,
    dispatchGuard: {
      sql: ` AND EXISTS(SELECT 1 ${selection} AND p.profile_json=? AND r.request_json=?
      AND r.status='complete' AND s.status='published' AND s.published_json=?
      AND a.configuration_revision=? AND a.configuration_digest=? AND a.configuration_source=? AND a.configuration_json=?)`,
      values: [
        ...values,
        before.profile_json,
        before.request_json,
        before.published_json,
        configuration.revision,
        configuration.digest,
        configuration.source,
        before.configuration_json,
      ],
    },
  };
}
