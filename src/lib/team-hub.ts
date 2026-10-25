import type { D1Database } from "@cloudflare/workers-types";
import { pluginResponse } from "emdash";
import {
  teamHubCommand,
  teamHubRequest,
  type TeamHubRequest,
} from "./team-hub-contract.ts";
const issuer = "https://composer.loftwah.com";
export interface TeamHubRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ACCOUNT_ID?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
  TEAM_HUB_AUTH_PROFILE?: unknown;
  TEAM_HUB_SERVICE?: { fetch(request: Request): Promise<Response> };
}
export interface TeamHubContext {
  request: Request;
  input: unknown;
  user?: { id: string; role: number; disabled?: boolean };
}
interface Principal {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}
interface Space {
  scope: string;
  revision: number;
  operation_id: string;
}
interface Grant {
  id: string;
  user_id: string;
  action: string;
  revision: number;
  status: string;
}
interface RequestRow {
  id: string;
  revision: number;
  title: string;
  body: string;
  assignee_id: string | null;
  status: TeamHubRequest["status"];
  attachment_json: string | null;
  updated_at: string;
}
class HubError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function teamHubProfile(runtime: TeamHubRuntime): boolean {
  try {
    const origin = new URL(String(runtime.PUBLIC_ORIGIN));
    return (
      runtime.TEAM_HUB_AUTH_PROFILE === "native-local" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    );
  } catch {
    return false;
  }
}
function base(ctx: TeamHubContext, runtime: TeamHubRuntime) {
  if (!teamHubProfile(runtime))
    throw new HubError(
      "UNQUALIFIED",
      "Team Hub is closed until the selected passwordless and mandatory-MFA identity policy is independently qualified. The local native-passkey profile proves application behaviour only.",
    );
  if (
    !runtime.DB ||
    new URL(ctx.request.url).origin !== runtime.PUBLIC_ORIGIN ||
    typeof runtime.RESOURCE_ACCOUNT_ID !== "string" ||
    !/^[A-Za-z0-9-]{1,80}$/.test(runtime.RESOURCE_ACCOUNT_ID) ||
    !["production", "preview"].includes(String(runtime.RESOURCE_ENVIRONMENT))
  )
    throw new HubError(
      "UNAVAILABLE",
      "This Team Hub account and environment are not configured.",
    );
  if (!ctx.user || ctx.user.disabled)
    throw new HubError(
      "FORBIDDEN",
      "Sign in with your invited account to open this team application.",
    );
  return {
    db: runtime.DB,
    user: ctx.user,
    account: runtime.RESOURCE_ACCOUNT_ID,
    environment: String(runtime.RESOURCE_ENVIRONMENT),
  };
}
const resource = (environment: string) => "team-hub-" + environment;
const scoped = (account: string, environment: string, workspace: string) =>
  `${account}:${environment}:${workspace}`;
async function principal(db: D1Database, workspace: string, user: string) {
  const row = await db
    .prepare(
      `SELECT u.id,u.name,m.role FROM users u JOIN creator_members m ON m.user_id=u.id WHERE u.id=? AND u.disabled=0 AND m.workspace_id=?`,
    )
    .bind(user, workspace)
    .first<Principal>();
  if (!row || !["owner", "editor", "viewer"].includes(row.role))
    throw new HubError(
      "FORBIDDEN",
      "This account has no current membership in the selected team.",
    );
  return row;
}
async function grants(
  db: D1Database,
  workspace: string,
  user: string,
  environment: string,
) {
  return (
    await db
      .prepare(
        `SELECT * FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app='team-hub' AND resource_id=? AND status='active'`,
      )
      .bind(issuer, workspace, user, resource(environment))
      .all<Grant>()
  ).results;
}
async function space(db: D1Database, scope: string) {
  return db
    .prepare("SELECT * FROM team_hub_spaces WHERE scope=?")
    .bind(scope)
    .first<Space>();
}
const authority = `EXISTS(SELECT 1 FROM creator_members m JOIN users u ON u.id=m.user_id JOIN creator_app_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND u.disabled=0 AND m.role IN ('owner','editor') AND g.issuer=? AND g.app='team-hub' AND g.resource_id=? AND g.action='contribute' AND g.status='active')`;
const ownerAuthority = `EXISTS(SELECT 1 FROM creator_members m JOIN users u ON u.id=m.user_id JOIN creator_app_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND u.disabled=0 AND m.role='owner' AND g.issuer=? AND g.app='team-hub' AND g.resource_id=? AND g.action='maintain' AND g.status='active')`;
function publicRequest(row: RequestRow) {
  const attachment = row.attachment_json
    ? (JSON.parse(row.attachment_json) as { name: string; text: string })
    : null;
  return {
    id: row.id,
    revision: row.revision,
    title: row.title,
    body: row.body,
    assignee: row.assignee_id,
    status: row.status,
    attachment: attachment
      ? {
          name: attachment.name,
          bytes: new TextEncoder().encode(attachment.text).length,
        }
      : null,
    updatedAt: row.updated_at,
  };
}
async function snapshot(
  db: D1Database,
  target: { workspace: string; account: string; environment: string },
  actor: Principal,
  manage: boolean,
) {
  const scope = scoped(target.account, target.environment, target.workspace),
    current = await space(db, scope);
  const requests = await db
    .prepare(
      "SELECT * FROM team_hub_requests WHERE scope=? ORDER BY updated_at DESC,id LIMIT 40",
    )
    .bind(scope)
    .all<RequestRow>();
  const people = await db
    .prepare(
      `SELECT m.user_id AS id,u.name,m.role,u.disabled,g.id AS grantId,g.action,g.status,g.revision FROM creator_members m JOIN users u ON u.id=m.user_id LEFT JOIN creator_app_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id AND g.app='team-hub' AND g.resource_id=? AND g.issuer=? WHERE m.workspace_id=? ORDER BY u.name,m.user_id,g.action LIMIT 128`,
    )
    .bind(resource(target.environment), issuer, target.workspace)
    .all();
  const activity = await db
    .prepare(
      "SELECT event,actor_id,request_id,member_id,created_at,hub_revision FROM team_hub_activity WHERE scope=? ORDER BY hub_revision DESC LIMIT 30",
    )
    .bind(scope)
    .all();
  return {
    ok: true as const,
    version: "composer.team-hub/1",
    target,
    actor: { id: actor.id, name: actor.name, role: actor.role, manage },
    enabled: !!current,
    revision: current?.revision ?? 0,
    requests: requests.results.map(publicRequest),
    people: people.results.filter(
      (row) =>
        manage ||
        (row.status === "active" &&
          row.action === "contribute" &&
          !row.disabled),
    ),
    activity: activity.results,
    authentication: {
      profile: "native-local",
      production: "unqualified",
      passwordlessMfa:
        "Real Access/IdP and physical factors have not been qualified.",
    },
  };
}
export async function manageTeamHub(
  ctx: TeamHubContext,
  runtime: TeamHubRuntime,
) {
  try {
    const { db, user, account, environment } = base(ctx, runtime),
      input = teamHubCommand.parse(ctx.input);
    if (
      !(await db
        .prepare("SELECT id FROM users WHERE id=? AND disabled=0")
        .bind(user.id)
        .first())
    )
      throw new HubError(
        "FORBIDDEN",
        "This local account is disabled or no longer available.",
      );
    if (
      [...new URL(ctx.request.url).searchParams.keys()].some(
        (key) => new URL(ctx.request.url).searchParams.getAll(key).length !== 1,
      )
    )
      throw new HubError("INVALID", "Choose the team and action once.");
    if (input.action === "scope") {
      if (ctx.request.method !== "GET")
        throw new HubError("INVALID", "Use the read-only team selector.");
      const rows = await db
        .prepare(
          `SELECT w.id,w.name,m.role FROM creator_members m JOIN creator_workspaces w ON w.id=m.workspace_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND u.disabled=0 ORDER BY w.name,w.id LIMIT 32`,
        )
        .bind(user.id)
        .all();
      return {
        ok: true,
        version: "composer.team-hub-scope/1",
        workspaces: rows.results,
        environment,
        account,
      };
    }
    const workspace = input.workspace,
      scope = scoped(account, environment, workspace),
      actor = await principal(db, workspace, user.id),
      target = { workspace, account, environment };
    let mine = await grants(db, workspace, user.id, environment),
      current = await space(db, scope);
    const manage =
      actor.role === "owner" &&
      mine.some((grant) => grant.action === "maintain");
    const admitted = mine.some((grant) => grant.action === "contribute");
    if (input.action === "read" && ctx.request.method === "GET") {
      if (!admitted && !(actor.role === "owner" && !current))
        throw new HubError(
          "FORBIDDEN",
          "Your workspace membership is accepted, but this application has not been shared with your account. Ask its owner for Team Hub access.",
        );
      return await snapshot(db, target, actor, manage);
    }
    const reading = ["history", "attachment", "connection"].includes(
      input.action,
    );
    if (reading) {
      if (ctx.request.method !== "GET" || !admitted)
        throw new HubError("FORBIDDEN", "Current Team Hub access is required.");
      if (input.action === "connection") {
        if (!runtime.TEAM_HUB_SERVICE)
          return {
            ok: true,
            state: "not-configured",
            message:
              "No private service binding has been approved for this app.",
          };
        try {
          const response = await runtime.TEAM_HUB_SERVICE.fetch(
            new Request("https://team-hub-private.invalid/status", {
              signal: AbortSignal.timeout(2000),
            }),
          );
          if (!response.ok) throw Error("offline");
          const reply = (await response.json()) as { state?: unknown };
          if (reply.state !== "available") throw Error("invalid");
          return {
            ok: true,
            state: "available",
            message:
              "The approved private service answered this app’s scoped check.",
          };
        } catch {
          return {
            ok: true,
            state: "unavailable",
            message:
              "The private service did not answer. App data is retained; ask its owner to check the binding.",
          };
        }
      }
      if (input.action !== "history" && input.action !== "attachment")
        throw new HubError("INVALID", "Choose a supported read.");
      const row = await db
        .prepare("SELECT * FROM team_hub_requests WHERE scope=? AND id=?")
        .bind(scope, input.id)
        .first<RequestRow>();
      if (!row)
        throw new HubError("FORBIDDEN", "This team cannot open that record.");
      if (input.action === "attachment") {
        if (!row.attachment_json)
          throw new HubError("INVALID", "This request has no attachment.");
        return { ok: true, attachment: JSON.parse(row.attachment_json) };
      }
      const history = await db
        .prepare(
          "SELECT revision,config_json,actor_id,created_at FROM team_hub_request_versions WHERE scope=? AND request_id=? ORDER BY revision DESC LIMIT 10",
        )
        .bind(scope, input.id)
        .all();
      return {
        ok: true,
        history: history.results.map((row) => ({
          revision: row.revision,
          request: publicRequest({
            ...JSON.parse(String(row.config_json)),
            id: input.id,
            revision: row.revision,
            updated_at: row.created_at,
          }),
          actor: row.actor_id,
          at: row.created_at,
        })),
      };
    }
    if (
      ctx.request.method !== "POST" ||
      ctx.request.headers.get("Origin") !== runtime.PUBLIC_ORIGIN ||
      ctx.request.headers.get("X-EmDash-Request") !== "1"
    )
      throw new HubError(
        "FORBIDDEN",
        "Use the signed-in team form to make a change.",
      );
    if (input.action === "enable") {
      if (actor.role !== "owner" || current)
        throw new HubError(
          "FORBIDDEN",
          "Only a current team owner can explicitly enable an absent Team Hub.",
        );
      const nonce = crypto.randomUUID();
      const owner = `EXISTS(SELECT 1 FROM creator_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND m.role='owner' AND u.disabled=0)`;
      const condition =
        "EXISTS(SELECT 1 FROM team_hub_spaces WHERE scope=? AND operation_id=?)";
      const statements = [
        db
          .prepare(
            `INSERT INTO team_hub_spaces(scope,workspace_id,account_id,environment,revision,operation_id) SELECT ?,?,?,?,1,? WHERE ${owner}`,
          )
          .bind(
            scope,
            workspace,
            account,
            environment,
            nonce,
            workspace,
            user.id,
          ),
      ];
      for (const action of ["contribute", "maintain"]) {
        statements.push(
          db
            .prepare(
              `INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,created_by) SELECT ?,?,?,?,'team-hub',?,?,? WHERE ${condition}`,
            )
            .bind(
              crypto.randomUUID(),
              issuer,
              workspace,
              user.id,
              resource(environment),
              action,
              user.id,
              scope,
              nonce,
            ),
        );
        statements.push(
          db
            .prepare(
              `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,issuer,workspace_id,?,user_id,app,resource_id,action,'grant',revision FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app='team-hub' AND resource_id=? AND action=? AND ${condition}`,
            )
            .bind(
              crypto.randomUUID(),
              user.id,
              issuer,
              workspace,
              user.id,
              resource(environment),
              action,
              scope,
              nonce,
            ),
        );
      }
      statements.push(
        db
          .prepare(
            `INSERT INTO team_hub_activity(id,scope,hub_revision,event,actor_id) SELECT ?,scope,revision,'enable',? FROM team_hub_spaces WHERE scope=? AND operation_id=?`,
          )
          .bind(crypto.randomUUID(), user.id, scope, nonce),
      );
      await db.batch(statements);
      current = await space(db, scope);
      if (current?.operation_id !== nonce)
        throw new HubError(
          "CONFLICT",
          "Team access changed before activation. Reload the current team.",
        );
      return await snapshot(db, target, actor, true);
    }
    if (!admitted || !current)
      throw new HubError(
        "FORBIDDEN",
        "This application has not been shared with this account.",
      );
    if (
      !("expectedRevision" in input) ||
      input.expectedRevision !== current.revision
    )
      throw new HubError(
        "CONFLICT",
        "The team changed in another session. Reload before saving; your entries are retained.",
      );
    if (input.action === "save" && actor.role === "viewer")
      throw new HubError(
        "FORBIDDEN",
        "Viewers can read this app; an editor or owner must make the change.",
      );
    if ((input.action === "grant" || input.action === "revoke") && !manage)
      throw new HubError(
        "FORBIDDEN",
        "A team owner with explicit app-management access must change grants.",
      );
    const nonce = crypto.randomUUID(),
      condition =
        "EXISTS(SELECT 1 FROM team_hub_spaces WHERE scope=? AND operation_id=?)";
    let currentGuard = "",
      currentArgs: (string | number)[] = [];
    if (input.action === "save") {
      currentGuard +=
        " AND COALESCE((SELECT revision FROM team_hub_requests WHERE scope=? AND id=?),0)=?";
      currentArgs.push(scope, input.id, input.expectedRequestRevision);
      if (input.expectedRequestRevision === 0) {
        currentGuard +=
          " AND (SELECT COUNT(*) FROM team_hub_requests WHERE scope=?)<40";
        currentArgs.push(scope);
      }
      if (input.request.assignee) {
        currentGuard += ` AND EXISTS(SELECT 1 FROM creator_members m JOIN users u ON u.id=m.user_id JOIN creator_app_grants g ON g.workspace_id=m.workspace_id AND g.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND u.disabled=0 AND g.issuer=? AND g.app='team-hub' AND g.resource_id=? AND g.action='contribute' AND g.status='active')`;
        currentArgs.push(
          workspace,
          input.request.assignee,
          issuer,
          resource(environment),
        );
      }
    } else if (input.action === "grant") {
      currentGuard += ` AND EXISTS(SELECT 1 FROM creator_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND u.disabled=0 ${input.capability === "manage" ? "AND m.role='owner'" : ""})`;
      currentArgs.push(workspace, input.member);
    } else if (input.action === "revoke") {
      currentGuard += ` AND EXISTS(SELECT 1 FROM creator_app_grants WHERE id=? AND issuer=? AND workspace_id=? AND app='team-hub' AND resource_id=? AND status='active' AND revision=? AND user_id!=?)`;
      currentArgs.push(
        input.grant,
        issuer,
        workspace,
        resource(environment),
        input.expectedGrantRevision,
        user.id,
      );
    }
    const statements = [
      db
        .prepare(
          `UPDATE team_hub_spaces SET revision=revision+1,operation_id=? WHERE scope=? AND revision=? AND ${input.action === "save" ? authority : ownerAuthority + " AND " + authority}${currentGuard}`,
        )
        .bind(
          nonce,
          scope,
          current.revision,
          workspace,
          user.id,
          issuer,
          resource(environment),
          ...(input.action === "save"
            ? []
            : [workspace, user.id, issuer, resource(environment)]),
          ...currentArgs,
        ),
    ];
    let requestId: string | null = null,
      memberId: string | null = null;
    if (input.action === "save") {
      const data = teamHubRequest.parse(input.request);
      if (
        data.attachment &&
        new TextEncoder().encode(data.attachment.text).length > 16000
      )
        throw new HubError(
          "INVALID",
          "Attach a plain-text file smaller than 16 KB.",
        );
      if (data.assignee) {
        await principal(db, workspace, data.assignee);
        if (
          !(await grants(db, workspace, data.assignee, environment)).some(
            (grant) => grant.action === "contribute",
          )
        )
          throw new HubError(
            "FORBIDDEN",
            "Assign this action to a current app member.",
          );
      }
      const existing = await db
        .prepare(
          "SELECT revision FROM team_hub_requests WHERE scope=? AND id=?",
        )
        .bind(scope, input.id)
        .first<{ revision: number }>();
      if ((existing?.revision ?? 0) !== input.expectedRequestRevision)
        throw new HubError(
          "CONFLICT",
          "That request has changed. Reload its saved version before editing.",
        );
      const rev = input.expectedRequestRevision + 1,
        attachment = data.attachment ? JSON.stringify(data.attachment) : null;
      requestId = input.id;
      statements.push(
        db
          .prepare(
            `INSERT INTO team_hub_requests(scope,id,revision,title,body,assignee_id,status,attachment_json) SELECT ?,?,?,?,?,?,?,? WHERE ${condition}
        ON CONFLICT(scope,id) DO UPDATE SET revision=excluded.revision,title=excluded.title,body=excluded.body,assignee_id=excluded.assignee_id,status=excluded.status,attachment_json=excluded.attachment_json,updated_at=CURRENT_TIMESTAMP WHERE team_hub_requests.revision=?`,
          )
          .bind(
            scope,
            input.id,
            rev,
            data.title,
            data.body,
            data.assignee,
            data.status,
            attachment,
            scope,
            nonce,
            input.expectedRequestRevision,
          ),
      );
      const saved = {
        title: data.title,
        body: data.body,
        assignee_id: data.assignee,
        status: data.status,
        attachment_json: attachment,
      };
      statements.push(
        db
          .prepare(
            `INSERT INTO team_hub_request_versions(scope,request_id,revision,config_json,actor_id) SELECT ?,?,?,?,? WHERE ${condition} AND EXISTS(SELECT 1 FROM team_hub_requests WHERE scope=? AND id=? AND revision=?)`,
          )
          .bind(
            scope,
            input.id,
            rev,
            JSON.stringify(saved),
            user.id,
            scope,
            nonce,
            scope,
            input.id,
            rev,
          ),
      );
    } else if (input.action === "grant") {
      const recipient = await principal(db, workspace, input.member);
      memberId = input.member;
      if (input.capability === "manage" && recipient.role !== "owner")
        throw new HubError(
          "INVALID",
          "App-management access requires current team-owner membership.",
        );
      const action = input.capability === "manage" ? "maintain" : "contribute";
      statements.push(
        db
          .prepare(
            `INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,created_by) SELECT ?,?,?,?,'team-hub',?,?,? WHERE ${condition}
        ON CONFLICT(issuer,workspace_id,user_id,app,resource_id,action) DO UPDATE SET status='active',revision=revision+1,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP`,
          )
          .bind(
            crypto.randomUUID(),
            issuer,
            workspace,
            input.member,
            resource(environment),
            action,
            user.id,
            scope,
            nonce,
          ),
      );
      statements.push(
        db
          .prepare(
            `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,issuer,workspace_id,?,user_id,app,resource_id,action,'grant',revision FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app='team-hub' AND resource_id=? AND action=? AND ${condition}`,
          )
          .bind(
            crypto.randomUUID(),
            user.id,
            issuer,
            workspace,
            input.member,
            resource(environment),
            action,
            scope,
            nonce,
          ),
      );
    } else if (input.action === "revoke") {
      const grant = await db
        .prepare(
          `SELECT * FROM creator_app_grants WHERE id=? AND workspace_id=? AND app='team-hub' AND resource_id=? AND issuer=? AND status='active' AND revision=?`,
        )
        .bind(
          input.grant,
          workspace,
          resource(environment),
          issuer,
          input.expectedGrantRevision,
        )
        .first<Grant>();
      if (!grant || grant.user_id === user.id)
        throw new HubError(
          "FORBIDDEN",
          "Choose another app member’s current grant. Ask another app owner to remove your own access.",
        );
      memberId = grant.user_id;
      statements.push(
        db
          .prepare(
            `UPDATE creator_app_grants SET status='revoked',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${condition}`,
          )
          .bind(grant.id, grant.revision, scope, nonce),
      );
      statements.push(
        db
          .prepare(
            `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,issuer,workspace_id,?,user_id,app,resource_id,action,'revoke',revision FROM creator_app_grants WHERE id=? AND ${condition}`,
          )
          .bind(crypto.randomUUID(), user.id, grant.id, scope, nonce),
      );
    } else throw new HubError("INVALID", "Choose a supported team action.");
    statements.push(
      db
        .prepare(
          `INSERT INTO team_hub_activity(id,scope,hub_revision,event,actor_id,request_id,member_id) SELECT ?,scope,revision,?,?,?,? FROM team_hub_spaces WHERE scope=? AND operation_id=?`,
        )
        .bind(
          crypto.randomUUID(),
          input.action === "save"
            ? input.expectedRequestRevision === 0
              ? "create"
              : "update"
            : input.action,
          user.id,
          requestId,
          memberId,
          scope,
          nonce,
        ),
    );
    await db.batch(statements);
    const after = await space(db, scope);
    if (after?.operation_id !== nonce)
      throw new HubError(
        "CONFLICT",
        "Your access or the team changed before saving. Reload and compare before retrying.",
      );
    return await snapshot(db, target, actor, manage);
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof HubError ? error.code : "INVALID",
      message:
        error instanceof HubError
          ? error.message
          : "This team request could not be validated. Current records have been retained.",
    };
  }
}

export async function teamHubPageGate(
  context: {
    request: Request;
    url: URL;
    locals: { user?: TeamHubContext["user"] };
  },
  runtime: TeamHubRuntime,
) {
  if (
    context.url.pathname !== "/team-hub" &&
    context.url.pathname !== "/team-hub/"
  )
    return null;
  const reply = await manageTeamHub(
    {
      request: context.request,
      user: context.locals.user,
      input: context.url.searchParams.has("workspace")
        ? {
            action: "read",
            workspace: context.url.searchParams.get("workspace"),
          }
        : { action: "scope" },
    },
    runtime,
  );
  if (reply.ok) return null;
  return new Response("Team Hub\n\n" + reply.message, {
    status: reply.code === "UNQUALIFIED" ? 503 : 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function teamHubPluginReply(
  ctx: TeamHubContext,
  runtime: TeamHubRuntime,
) {
  const result = await manageTeamHub(ctx, runtime),
    status = result.ok
      ? 200
      : result.code === "FORBIDDEN"
        ? 403
        : result.code === "CONFLICT"
          ? 409
          : result.code === "UNQUALIFIED" || result.code === "UNAVAILABLE"
            ? 503
            : 400;
  return pluginResponse({
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
    body: {
      kind: "text",
      value: JSON.stringify(
        result.ok
          ? { success: true, data: result }
          : {
              success: false,
              error: { code: result.code, message: result.message },
            },
      ),
    },
  });
}
