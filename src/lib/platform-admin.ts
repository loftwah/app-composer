// MIT. Governed requests reuse the existing workspace, stack and resource store.
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  membership,
  requireCapability,
  StackError,
  readStack,
  publishStack,
  normaliseStack,
  trustedPlatformActor,
} from "./stacks.mjs";
import {
  applyStackResources,
  listStackResources,
  resourcePublication,
  reconcileStackResources,
} from "./stack-resources.ts";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import {
  platformRequest,
  platformProfile,
  platformPlan,
  platformDigest,
  evaluatePlatformRequest,
  recipes,
  type PlatformProfile,
  type PlatformRequest,
  type PolicyDecision,
} from "./platform-contract.ts";

const origin = "https://composer.loftwah.com";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const base = { workspace: id };
const commands = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("configure"),
      expectedRevision: z.number().int().nonnegative(),
      profile: platformProfile,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("submit"),
      key: z.uuid(),
      request: platformRequest,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("update"),
      id,
      expectedRevision: revision,
      request: platformRequest,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("revise"),
      id,
      expectedRevision: revision,
      request: platformRequest,
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("review"),
      id,
      expectedRevision: revision,
      decision: z.enum(["accept", "send-back", "deny"]),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.enum(["run", "reconcile"]),
      id,
      expectedRevision: revision,
    })
    .strict(),
]);
interface RequestRow {
  id: string;
  workspace_id: string;
  actor_id: string;
  submission_key: string;
  revision: number;
  request_json: string;
  plan_json: string;
  plan_digest: string;
  policy_revision: number;
  decision_json: string;
  status: string;
  stack_id: string | null;
  expected_stack_revision: number | null;
  expected_stack_json: string | null;
  approval_digest: string | null;
  approval_actor: string | null;
  approval_expires: number | null;
  lease_token: string | null;
  lease_until: number | null;
  reason: string | null;
  updated_at: string;
}
type User = { id: string; role: number; name?: string | null };
export type PlatformRuntime = ResourceRuntime & {
  DB?: D1Database;
  PLATFORM_PUBLIC_FETCH?: typeof fetch;
};
const conflict = () =>
  new StackError(
    "CONFLICT",
    "The request, policy or workspace changed. Refresh before continuing.",
    409,
  );
const authority =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor'))";
export async function readPlatformProfile(
  db: D1Database,
  workspace: string,
): Promise<PlatformProfile | null> {
  const row = await db
    .prepare("SELECT * FROM creator_platform_profiles WHERE workspace_id=?")
    .bind(workspace)
    .first<{ revision: number; profile_json: string }>();
  return row
    ? {
        ...platformProfile.parse(JSON.parse(row.profile_json)),
        version: 1,
        revision: row.revision,
      }
    : null;
}
async function allocated(db: D1Database, workspace: string, except = "") {
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM creator_platform_requests WHERE workspace_id=? AND id!=? AND (status NOT IN ('denied','sent-back') OR stack_id IS NOT NULL)",
    )
    .bind(workspace, except)
    .first<{ n: number }>();
  return result?.n ?? 0;
}
async function rowFor(
  db: D1Database,
  workspace: string,
  request: string,
): Promise<RequestRow> {
  const row = await db
    .prepare(
      "SELECT * FROM creator_platform_requests WHERE id=? AND workspace_id=?",
    )
    .bind(request, workspace)
    .first<RequestRow>();
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "This request is not in the selected workspace.",
      404,
    );
  return row;
}
function target(runtime: PlatformRuntime) {
  // Missing execution connection can still produce a useful pending plan. Values
  // are host-derived, never a caller-selected account, binding or destination.
  return {
    account:
      typeof runtime.RESOURCE_ACCOUNT_ID === "string"
        ? runtime.RESOURCE_ACCOUNT_ID
        : "unavailable",
    environment:
      typeof runtime.RESOURCE_ENVIRONMENT === "string"
        ? runtime.RESOURCE_ENVIRONMENT
        : "unavailable",
    url: origin + "/guestbook",
  };
}
function runner(runtime: PlatformRuntime, workspace: string) {
  try {
    resourceConnection(runtime, workspace);
    return {
      available: true,
      kind: "existing-resource-adapter",
      message:
        "The trusted existing app-resource adapter is connected. No hosted build runner or dedicated per-app infrastructure is implied.",
    };
  } catch {
    return {
      available: false,
      kind: "existing-resource-adapter",
      message:
        "The trusted app-resource adapter is unavailable. Requests remain pending; no cloud work has been started.",
    };
  }
}
async function audit(
  db: D1Database,
  row: RequestRow,
  actor: string,
  action: string,
) {
  await db
    .prepare(
      "INSERT INTO creator_platform_events(id,request_id,workspace_id,actor_id,action,plan_digest,detail_json) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      row.id,
      row.workspace_id,
      actor,
      action,
      row.plan_digest,
      row.plan_json,
    )
    .run();
}
async function requestView(db: D1Database, row: RequestRow, actor: User) {
  const request = platformRequest.parse(JSON.parse(row.request_json));
  const resources = row.stack_id
    ? await listStackResources(db, row.workspace_id, row.stack_id)
    : [];
  let stack = null;
  if (row.stack_id) {
    try {
      stack = await readStack(db, row.workspace_id, row.stack_id);
    } catch (cause) {
      if (!(cause instanceof StackError) || cause.code !== "NOT_FOUND")
        throw cause;
    }
  }
  const unavailable =
    row.status === "complete" &&
    (!stack || stack.status !== "published" || !resources.length);
  return {
    id: row.id,
    name: request.name,
    status: unavailable ? "needs-attention" : row.status,
    revision: row.revision,
    decision: JSON.parse(row.decision_json) as PolicyDecision,
    request,
    plan: JSON.parse(row.plan_json) as ReturnType<typeof platformPlan>,
    planDigest: row.plan_digest,
    stackId: row.stack_id,
    url: stack?.status === "published" ? "/s/" + stack.slug : null,
    resources,
    reason: unavailable
      ? "The previously completed service is no longer published or its retained stack is missing. Inspect its ownership and history before changing anything."
      : row.reason,
    updatedAt: row.updated_at,
    actorIsRequester: row.actor_id === actor.id,
    resumable:
      ["waiting", "needs-attention", "running", "verifying"].includes(
        row.status,
      ) &&
      (!row.lease_until || row.lease_until <= Date.now()),
  };
}
export async function platformSnapshot(
  db: D1Database,
  user: User,
  workspaceId: string | null,
  runtime: PlatformRuntime,
) {
  const workspace = await resolveWorkspace(db, user, workspaceId);
  requireCapability(workspace.role, "read");
  const profile = await readPlatformProfile(db, workspace.id);
  const rows = await db
    .prepare(
      "SELECT * FROM creator_platform_requests WHERE workspace_id=? ORDER BY created_at DESC,id LIMIT 50",
    )
    .bind(workspace.id)
    .all<RequestRow>();
  const requests = await Promise.all(
    rows.results.map((row) => requestView(db, row, user)),
  );
  requireCapability(await membership(db, workspace.id, user.id), "read");
  return {
    ok: true as const,
    workspace,
    profile,
    recipes,
    requests,
    runner: runner(runtime, workspace.id),
  };
}
async function configure(
  db: D1Database,
  user: User,
  command: Extract<z.infer<typeof commands>, { action: "configure" }>,
  now: number,
) {
  if ((await membership(db, command.workspace, user.id)) !== "owner")
    throw new StackError(
      "FORBIDDEN",
      "Only a current workspace owner can establish standing policy.",
      403,
    );
  const json = JSON.stringify(command.profile);
  const emptyWorkspace =
    "NOT EXISTS(SELECT 1 FROM creator_stacks WHERE workspace_id=?)";
  if (
    command.expectedRevision === 0 &&
    (await db
      .prepare("SELECT id FROM creator_stacks WHERE workspace_id=? LIMIT 1")
      .bind(command.workspace)
      .first())
  )
    throw new StackError(
      "UNSUPPORTED",
      "Start platform policy in an empty workspace. Adopting existing services into governed delivery is not qualified yet.",
    );
  const noRunning =
    "NOT EXISTS(SELECT 1 FROM creator_platform_requests WHERE workspace_id=? AND status IN ('running','verifying') AND lease_until>?)";
  const owner =
    "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner')";
  const result =
    command.expectedRevision === 0
      ? await db
          .prepare(
            `INSERT INTO creator_platform_profiles(workspace_id,profile_json,updated_by) SELECT ?,?,? WHERE ${owner} AND ${noRunning} AND ${emptyWorkspace} AND NOT EXISTS(SELECT 1 FROM creator_platform_profiles WHERE workspace_id=?) RETURNING revision`,
          )
          .bind(
            command.workspace,
            json,
            user.id,
            command.workspace,
            user.id,
            command.workspace,
            now,
            command.workspace,
            command.workspace,
          )
          .first()
      : await db
          .prepare(
            `UPDATE creator_platform_profiles SET profile_json=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND ${owner} AND ${noRunning} RETURNING revision`,
          )
          .bind(
            json,
            user.id,
            command.workspace,
            command.expectedRevision,
            command.workspace,
            user.id,
            command.workspace,
            now,
          )
          .first();
  if (!result) throw conflict();
}
async function submit(
  db: D1Database,
  user: User,
  command: Extract<z.infer<typeof commands>, { action: "submit" }>,
  runtime: PlatformRuntime,
) {
  const workspace = command.workspace;
  requireCapability(await membership(db, workspace, user.id), "create");
  const existing = await db
    .prepare(
      "SELECT * FROM creator_platform_requests WHERE workspace_id=? AND submission_key=?",
    )
    .bind(workspace, command.key)
    .first<RequestRow>();
  if (existing) {
    if (
      existing.actor_id !== user.id ||
      existing.request_json !== JSON.stringify(command.request)
    )
      throw conflict();
    return existing;
  }
  const profile = await readPlatformProfile(db, workspace);
  const decision = evaluatePlatformRequest(
    command.request,
    profile,
    await allocated(db, workspace),
  );
  const plan = platformPlan(command.request, profile, target(runtime));
  const digest = await platformDigest(plan),
    requestId = crypto.randomUUID();
  const status = ["denied", "unsupported"].includes(decision.outcome)
    ? "denied"
    : "waiting";
  // Quota and policy checks participate in the same SQL write as reservation.
  const result = await db
    .prepare(
      `INSERT INTO creator_platform_requests(id,workspace_id,actor_id,submission_key,request_json,plan_json,plan_digest,policy_revision,decision_json,status)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${authority}
    AND COALESCE((SELECT revision FROM creator_platform_profiles WHERE workspace_id=?),0)=?
    AND (?='denied' OR (SELECT COUNT(*) FROM creator_platform_requests WHERE workspace_id=? AND (status NOT IN ('denied','sent-back') OR stack_id IS NOT NULL))<?) RETURNING *`,
    )
    .bind(
      requestId,
      workspace,
      user.id,
      command.key,
      JSON.stringify(command.request),
      JSON.stringify(plan),
      digest,
      profile?.revision ?? 0,
      JSON.stringify(decision),
      status,
      workspace,
      user.id,
      workspace,
      profile?.revision ?? 0,
      status,
      workspace,
      profile?.maxApplications ?? 0,
    )
    .first<RequestRow>();
  if (!result) throw conflict();
  await audit(db, result, user.id, "submitted:" + decision.outcome);
  return result;
}
async function revise(
  db: D1Database,
  user: User,
  command: Extract<z.infer<typeof commands>, { action: "revise" | "update" }>,
  runtime: PlatformRuntime,
) {
  const row = await rowFor(db, command.workspace, command.id);
  requireCapability(await membership(db, command.workspace, user.id), "save");
  if (
    row.actor_id !== user.id ||
    (command.action === "update"
      ? !row.stack_id || row.status !== "complete"
      : !["sent-back", "denied", "waiting", "needs-attention"].includes(
          row.status,
        ))
  )
    throw new StackError(
      "FORBIDDEN",
      "Only the requester can revise a waiting, sent-back or denied plan, or plan an update to its completed service.",
      403,
    );
  if (row.lease_until && row.lease_until > Date.now()) throw conflict();
  if (
    row.status === "needs-attention" &&
    row.stack_id &&
    (await db
      .prepare(
        "SELECT id FROM creator_resource_operations WHERE stack_id=? AND state IN ('pending','unknown') LIMIT 1",
      )
      .bind(row.stack_id)
      .first())
  )
    throw new StackError(
      "CONFLICT",
      "Reconcile the existing app operation before revising its plan. Its retained identities and uncertain outcome must be preserved.",
      409,
    );
  const profile = await readPlatformProfile(db, command.workspace);
  const decision = evaluatePlatformRequest(
    command.request,
    profile,
    await allocated(db, command.workspace, row.id),
  );
  const plan = platformPlan(command.request, profile, target(runtime));
  const result = await db
    .prepare(
      `UPDATE creator_platform_requests SET request_json=?,plan_json=?,plan_digest=?,policy_revision=?,decision_json=?,status=?,approval_digest=NULL,approval_actor=NULL,approval_expires=NULL,reason=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND workspace_id=? AND revision=? AND status=? AND ${authority}
    AND COALESCE((SELECT revision FROM creator_platform_profiles WHERE workspace_id=?),0)=?
    AND (?='denied' OR (SELECT COUNT(*) FROM creator_platform_requests WHERE workspace_id=? AND id!=? AND (status NOT IN ('denied','sent-back') OR stack_id IS NOT NULL))<?) RETURNING *`,
    )
    .bind(
      JSON.stringify(command.request),
      JSON.stringify(plan),
      await platformDigest(plan),
      profile?.revision ?? 0,
      JSON.stringify(decision),
      ["denied", "unsupported"].includes(decision.outcome)
        ? "denied"
        : "waiting",
      row.id,
      command.workspace,
      command.expectedRevision,
      row.status,
      command.workspace,
      user.id,
      command.workspace,
      profile?.revision ?? 0,
      ["denied", "unsupported"].includes(decision.outcome)
        ? "denied"
        : "waiting",
      command.workspace,
      row.id,
      profile?.maxApplications ?? 0,
    )
    .first<RequestRow>();
  if (!result) throw conflict();
  await audit(db, result, user.id, command.action + ":" + decision.outcome);
  return result;
}
async function review(
  db: D1Database,
  user: User,
  command: Extract<z.infer<typeof commands>, { action: "review" }>,
  now: number,
) {
  const row = await rowFor(db, command.workspace, command.id);
  if (
    (await membership(db, command.workspace, user.id)) !== "owner" ||
    row.actor_id === user.id
  )
    throw new StackError(
      "FORBIDDEN",
      "A different current workspace owner must review this request.",
      403,
    );
  const profile = await readPlatformProfile(db, command.workspace);
  const request = platformRequest.parse(JSON.parse(row.request_json));
  const decision = evaluatePlatformRequest(
    request,
    profile,
    await allocated(db, command.workspace, row.id),
  );
  if (
    row.status !== "waiting" ||
    row.policy_revision !== profile?.revision ||
    decision.outcome !== "requires-approval"
  )
    throw conflict();
  const result = await db
    .prepare(
      `UPDATE creator_platform_requests SET status=?,approval_digest=?,approval_actor=?,approval_expires=?,reason=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND status='waiting' AND policy_revision=(SELECT revision FROM creator_platform_profiles WHERE workspace_id=?) AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner') RETURNING *`,
    )
    .bind(
      command.decision === "accept"
        ? "waiting"
        : command.decision === "deny"
          ? "denied"
          : "sent-back",
      command.decision === "accept" ? row.plan_digest : null,
      user.id,
      command.decision === "accept" ? now + 3600000 : null,
      command.reason,
      row.id,
      command.workspace,
      command.expectedRevision,
      command.workspace,
      command.workspace,
      user.id,
    )
    .first<RequestRow>();
  if (!result) throw conflict();
  await audit(db, result, user.id, "review:" + command.decision);
  return result;
}

export async function runPlatformRequest(
  db: D1Database,
  user: User,
  workspace: string,
  requestId: string,
  expectedRevision: number,
  runtime: PlatformRuntime,
  now = Date.now(),
) {
  let row = await rowFor(db, workspace, requestId);
  requireCapability(await membership(db, workspace, user.id), "save");
  if (row.status === "complete") return row;
  if (
    !["waiting", "needs-attention", "running", "verifying"].includes(
      row.status,
    ) ||
    row.revision !== expectedRevision
  )
    throw conflict();
  if (!runner(runtime, workspace).available) return row;
  const token = crypto.randomUUID();
  const claimed = await db
    .prepare(
      `UPDATE creator_platform_requests SET lease_token=?,lease_until=?,status='running',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND (lease_until IS NULL OR lease_until<=?) AND ${authority} RETURNING *`,
    )
    .bind(
      token,
      now + 120000,
      row.id,
      workspace,
      expectedRevision,
      now,
      workspace,
      user.id,
    )
    .first<RequestRow>();
  if (!claimed) throw conflict();
  row = claimed;
  const guard = async () => {
    requireCapability(await membership(db, workspace, user.id), "save");
    requireCapability(await membership(db, workspace, row.actor_id), "create");
    const current = await rowFor(db, workspace, row.id);
    if (
      current.lease_token !== token ||
      (current.lease_until ?? 0) <= Date.now()
    )
      throw conflict();
    const profile = await readPlatformProfile(db, workspace);
    const request = platformRequest.parse(JSON.parse(current.request_json));
    const plan = platformPlan(request, profile, target(runtime));
    if (
      (await platformDigest(plan)) !== current.plan_digest ||
      current.plan_digest !== row.plan_digest ||
      current.policy_revision !== profile?.revision
    )
      throw conflict();
    const decision = evaluatePlatformRequest(
      request,
      profile,
      await allocated(db, workspace, row.id),
    );
    if (decision.outcome === "requires-approval") {
      if (
        current.approval_digest !== current.plan_digest ||
        (current.approval_expires ?? 0) <= Date.now() ||
        !current.approval_actor ||
        current.approval_actor === current.actor_id ||
        (await membership(db, workspace, current.approval_actor)) !== "owner"
      )
        throw new StackError(
          "FORBIDDEN",
          "Approval is missing, expired, revoked or does not match this plan.",
          403,
        );
    } else if (decision.outcome !== "allowed")
      throw new StackError("FORBIDDEN", decision.reasons.join(" "), 403);
    if (current.stack_id) {
      const stack = await readStack(db, workspace, current.stack_id);
      if (
        JSON.stringify(stack.draft) !== current.expected_stack_json ||
        stack.revision !== current.expected_stack_revision ||
        stack.status === "archived"
      )
        throw new StackError(
          "CONFLICT",
          "The candidate changed outside this request. Preserve it and inspect the exact plan before resuming.",
          409,
        );
    }
    return current;
  };
  try {
    await guard();
    if (!row.stack_id) {
      const plan = JSON.parse(row.plan_json) as ReturnType<typeof platformPlan>;
      const doc = normaliseStack({
        version: 1,
        name: plan.request.name,
        description: "Fictional team demonstration. No sensitive records.",
        theme: "midnight",
        instances: [
          {
            id: row.id,
            app: "guestbook",
            label: plan.request.name,
            caption: "",
            visible: true,
            binding: { mode: "own", shareOf: null },
            config: plan.spec.appSettings.guestbook,
          },
        ],
      });
      const slug = "team-" + row.id;
      const condition =
        "EXISTS(SELECT 1 FROM creator_platform_requests WHERE id=? AND workspace_id=? AND lease_token=? AND stack_id IS NULL)";
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO creator_stacks(id,workspace_id,slug,name,draft_json) SELECT ?,?,?,?,? WHERE ${condition} AND ${authority} RETURNING id`,
          )
          .bind(
            row.id,
            workspace,
            slug,
            doc.name,
            JSON.stringify(doc),
            row.id,
            workspace,
            token,
            workspace,
            user.id,
          ),
        db
          .prepare(
            `UPDATE creator_platform_requests SET stack_id=?,expected_stack_revision=1,expected_stack_json=? WHERE id=? AND workspace_id=? AND lease_token=? AND EXISTS(SELECT 1 FROM creator_stacks WHERE id=? AND workspace_id=?) RETURNING *`,
          )
          .bind(
            row.id,
            JSON.stringify(doc),
            row.id,
            workspace,
            token,
            row.id,
            workspace,
          ),
      ]);
      if (!results[0]?.results?.length) throw conflict();
      row = await rowFor(db, workspace, row.id);
    }
    await guard();
    const currentCandidate = await readStack(db, workspace, row.stack_id!);
    const selectedPlan = JSON.parse(row.plan_json) as ReturnType<
      typeof platformPlan
    >;
    const desired = normaliseStack({
      ...currentCandidate.draft,
      name: selectedPlan.request.name,
      instances: currentCandidate.draft.instances.map((instance) => ({
        ...instance,
        label: selectedPlan.request.name,
        config: selectedPlan.spec.appSettings.guestbook,
      })),
    });
    if (JSON.stringify(desired) !== JSON.stringify(currentCandidate.draft)) {
      // A supported configuration update retains app/resource identity. Both the
      // draft CAS and request receipt change in the same D1 transaction.
      const nonce = crypto.randomUUID();
      const changed = await db.batch([
        db
          .prepare(
            `UPDATE creator_stacks SET draft_json=?,name=?,revision=revision+1,resource_mutation=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND workspace_id=? AND revision=? AND draft_json=? AND status!='archived' AND ${authority}
          AND EXISTS(SELECT 1 FROM creator_platform_requests WHERE id=? AND lease_token=? AND policy_revision=(SELECT revision FROM creator_platform_profiles WHERE workspace_id=?)) RETURNING revision`,
          )
          .bind(
            JSON.stringify(desired),
            desired.name,
            nonce,
            currentCandidate.id,
            workspace,
            currentCandidate.revision,
            JSON.stringify(currentCandidate.draft),
            workspace,
            user.id,
            row.id,
            token,
            workspace,
          ),
        db
          .prepare(
            `UPDATE creator_platform_requests SET expected_stack_revision=?,expected_stack_json=? WHERE id=? AND lease_token=? AND EXISTS(SELECT 1 FROM creator_stacks WHERE id=? AND resource_mutation=?) RETURNING id`,
          )
          .bind(
            currentCandidate.revision + 1,
            JSON.stringify(desired),
            row.id,
            token,
            currentCandidate.id,
            nonce,
          ),
      ]);
      if (!changed[0]?.results?.length || !changed[1]?.results?.length)
        throw conflict();
      row = await rowFor(db, workspace, row.id);
    }
    await guard();
    const service = runtime.GUESTBOOK!;
    // Reuse the existing adapter and credentials, checking current grants and
    // exact candidate again on EACH effect after source/network waits.
    let advancing = false;
    const scopedRuntime: PlatformRuntime = {
      ...runtime,
      GUESTBOOK: {
        async fetch(request) {
          if (!advancing) await guard();
          else {
            // Resource journal writes advance only stack revision. Its own adapter
            // guards the exact draft and membership; refresh our expected revision.
            const current = await readStack(db, workspace, row.stack_id!);
            if (JSON.stringify(current.draft) !== row.expected_stack_json)
              throw conflict();
            await db
              .prepare(
                "UPDATE creator_platform_requests SET expected_stack_revision=? WHERE id=? AND lease_token=?",
              )
              .bind(current.revision, row.id, token)
              .run();
            await guard();
          }
          return service.fetch(request);
        },
      },
    };
    const current = await readStack(db, workspace, row.stack_id!);
    advancing = true;
    const applied = await applyStackResources(
      db,
      user.id,
      workspace,
      current.id,
      current.revision,
      scopedRuntime,
    );
    advancing = false;
    await db
      .prepare(
        "UPDATE creator_platform_requests SET expected_stack_revision=?,status=? WHERE id=? AND lease_token=?",
      )
      .bind(applied.stack.revision, "verifying", row.id, token)
      .run();
    if (!["applied", "unchanged"].includes(applied.outcome))
      throw new StackError(
        "UNAVAILABLE",
        "The app operation is " +
          applied.outcome +
          ". Its existing journal must be reconciled before further effects.",
      );
    await guard();
    const publishedDocument = await resourcePublication(
      db,
      workspace,
      current.id,
      applied.stack.draft,
      scopedRuntime,
    );
    await guard();
    const published = await publishStack(
      db,
      workspace,
      current.id,
      applied.stack.revision,
      publishedDocument,
      trustedPlatformActor(user.id, row.id, token),
    );
    await db
      .prepare(
        "UPDATE creator_platform_requests SET expected_stack_revision=? WHERE id=? AND lease_token=?",
      )
      .bind(published.revision, row.id, token)
      .run();
    await guard();
    const resources = await listStackResources(db, workspace, published.id);
    const publicPath = resources[0]?.configuration?.path;
    if (!publicPath) throw Error("No confirmed public application path.");
    // Independent unauthenticated user-facing read, with no owner credential.
    const publicRequest = runtime.PLATFORM_PUBLIC_FETCH ?? fetch;
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    async function publicHTML(path: string, markers: string[]) {
      const response = await publicRequest(
        new Request(origin + path, {
          redirect: "manual",
          headers: { "X-Composer-Verification": "1" },
          signal: AbortSignal.timeout(8000),
        }),
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("text/html")
      )
        throw Error(
          "The public application journey is not independently verified.",
        );
      const reader = response.body?.getReader();
      if (!reader) throw Error("The public response is empty.");
      let bytes = 0,
        html = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.length;
          if (bytes > 500000)
            throw Error("Public verification response exceeds its bound.");
          html += decoder.decode(part.value, { stream: true });
        }
        html += decoder.decode();
      } finally {
        await reader.cancel();
      }
      if (!markers.every((marker) => html.includes(marker)))
        throw Error(
          "The public response does not match the exact app and publication.",
        );
    }
    await publicHTML(publicPath, [
      'data-app="guestbook"',
      "<h1>" + escape(published.name) + "</h1>",
      'rel="canonical" href="' + origin + publicPath + '"',
    ]);
    await guard();
    await publicHTML("/s/" + published.slug, [
      "<title>" +
        (published.name.includes("App Composer")
          ? escape(published.name)
          : escape(published.name) + " · App Composer") +
        "</title>",
      'href="' + publicPath + '"',
      'data-outcome-publication="' + published.publishedRevision + '"',
    ]);
    await guard();
    const result = await db
      .prepare(
        "UPDATE creator_platform_requests SET status='complete',reason=NULL,lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND lease_token=? RETURNING *",
      )
      .bind(row.id, workspace, token)
      .first<RequestRow>();
    if (!result) throw conflict();
    await audit(db, result, user.id, "verified:existing-resource");
    return result;
  } catch (cause) {
    // Preserve all existing resource/journal identities. No cleanup or blind retry.
    const stack = row.stack_id
      ? await readStack(db, workspace, row.stack_id)
      : null;
    const reason =
      cause instanceof StackError
        ? cause.message
        : "The operation needs attention. Inspect its retained resource journal and public verification before resuming.";
    await db
      .prepare(
        "UPDATE creator_platform_requests SET status='needs-attention',reason=?,expected_stack_revision=?,lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND lease_token=?",
      )
      .bind(reason, stack?.revision ?? null, row.id, workspace, token)
      .run();
    const result = await rowFor(db, workspace, row.id);
    await audit(db, result, user.id, "needs-attention");
    return result;
  }
}
// Read-only provider reconciliation remains possible after policy/approval drift.
// It observes the existing journal; it can never dispatch a new app command.
async function reconcilePlatformRequest(
  db: D1Database,
  user: User,
  workspace: string,
  requestId: string,
  expected: number,
  runtime: PlatformRuntime,
) {
  let row = await rowFor(db, workspace, requestId);
  requireCapability(await membership(db, workspace, user.id), "save");
  if (
    !row.stack_id ||
    row.revision !== expected ||
    (row.lease_until ?? 0) > Date.now()
  )
    throw conflict();
  const token = crypto.randomUUID();
  const claimed = await db
    .prepare(
      "UPDATE creator_platform_requests SET lease_token=?,lease_until=?,status='verifying',revision=revision+1 WHERE id=? AND workspace_id=? AND revision=? AND (lease_until IS NULL OR lease_until<=?) RETURNING *",
    )
    .bind(token, Date.now() + 120000, row.id, workspace, expected, Date.now())
    .first<RequestRow>();
  if (!claimed) throw conflict();
  row = claimed;
  try {
    const stack = await readStack(db, workspace, row.stack_id!);
    const service = runtime.GUESTBOOK;
    if (!service)
      throw new StackError(
        "UNAVAILABLE",
        "The app connection is unavailable; the existing journal remains unconfirmed.",
      );
    const scoped = {
      ...runtime,
      GUESTBOOK: {
        async fetch(request: Request) {
          requireCapability(await membership(db, workspace, user.id), "save");
          const current = await rowFor(db, workspace, row.id);
          if (
            current.lease_token !== token ||
            (current.lease_until ?? 0) <= Date.now()
          )
            throw conflict();
          if (request.method !== "GET")
            throw new StackError(
              "FORBIDDEN",
              "Reconciliation cannot send an app mutation.",
              403,
            );
          return service.fetch(request);
        },
      },
    };
    const result = await reconcileStackResources(
      db,
      user.id,
      workspace,
      stack.id,
      stack.revision,
      scoped,
    );
    const observed = !result.problems.length;
    await db
      .prepare(
        "UPDATE creator_platform_requests SET status='needs-attention',reason=?,expected_stack_revision=?,lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND lease_token=?",
      )
      .bind(
        observed
          ? "The existing app journal is reconciled without resubmitting. Revise this request against the current policy before continuing."
          : "The app journal remains unconfirmed. Keep its identities and check again when the app connection is available.",
        result.stack.revision,
        row.id,
        workspace,
        token,
      )
      .run();
  } catch {
    await db
      .prepare(
        "UPDATE creator_platform_requests SET status='needs-attention',reason=?,lease_token=NULL,lease_until=NULL,revision=revision+1 WHERE id=? AND workspace_id=? AND lease_token=?",
      )
      .bind(
        "The existing app journal could not be reconciled. No app mutation was sent; retain its original identity.",
        row.id,
        workspace,
        token,
      )
      .run();
  }
  await audit(
    db,
    await rowFor(db, workspace, row.id),
    user.id,
    "journal:observed",
  );
}

export async function managePlatform(
  ctx: { user?: User; request: Request; input: unknown },
  runtime: PlatformRuntime,
) {
  const fail = (code: string, message: string) => ({
    ok: false as const,
    code,
    message,
  });
  if (!ctx.user || !isCreatorRole(ctx.user.role))
    return fail(
      "FORBIDDEN",
      "A signed-in Composer creator is required. Application users do not gain platform authority.",
    );
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    return fail(
      "UNAVAILABLE",
      "Platform requests are disconnected in this environment.",
    );
  const reading = ctx.request.method === "GET";
  const requestOrigin = ctx.request.headers.get("Origin");
  if (
    (requestOrigin && requestOrigin !== origin) ||
    (!reading &&
      (requestOrigin !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this action from Composer administration.");
  try {
    const db = runtime.DB;
    if (reading) {
      const input = z
        .object({ action: z.literal("list"), workspace: id.optional() })
        .strict()
        .parse(ctx.input);
      return await platformSnapshot(
        db,
        ctx.user,
        input.workspace ?? null,
        runtime,
      );
    }
    if (ctx.request.method !== "POST")
      return fail("INVALID", "Choose a supported platform action.");
    const command = commands.parse(ctx.input);
    await resolveWorkspace(db, ctx.user, command.workspace);
    let row: RequestRow | undefined;
    if (command.action === "configure")
      await configure(db, ctx.user, command, Date.now());
    if (command.action === "submit")
      row = await submit(db, ctx.user, command, runtime);
    if (command.action === "revise" || command.action === "update")
      row = await revise(db, ctx.user, command, runtime);
    if (command.action === "review")
      row = await review(db, ctx.user, command, Date.now());
    if (command.action === "reconcile")
      await reconcilePlatformRequest(
        db,
        ctx.user,
        command.workspace,
        command.id,
        command.expectedRevision,
        runtime,
      );
    if (command.action === "run")
      row = await runPlatformRequest(
        db,
        ctx.user,
        command.workspace,
        command.id,
        command.expectedRevision,
        runtime,
      );
    if (
      row?.status === "waiting" &&
      ((JSON.parse(row.decision_json) as PolicyDecision).outcome ===
        "allowed" ||
        (command.action === "review" && command.decision === "accept")) &&
      command.action !== "run"
    )
      await runPlatformRequest(
        db,
        ctx.user,
        command.workspace,
        row.id,
        row.revision,
        runtime,
      );
    return await platformSnapshot(db, ctx.user, command.workspace, runtime);
  } catch (cause) {
    return cause instanceof StackError
      ? fail(cause.code, cause.message)
      : cause instanceof z.ZodError
        ? fail(
            "INVALID",
            "Choose a supported platform request. Imported fields and account/resource identifiers cannot grant authority.",
          )
        : fail(
            "UNAVAILABLE",
            "The current operation could not be confirmed. Keep its submission identity and refresh before trying again.",
          );
  }
}
