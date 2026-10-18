import type { D1Database } from "@cloudflare/workers-types";
import type { resourceConnection } from "./resource-client.ts";
import {
  appendOutcome,
  OUTCOME_RETENTION_DAYS,
  type OutcomeEvent,
} from "./private-outcome-events.ts";

interface Operation {
  id: string;
  resource_id: string;
  action: string;
  request_json: string;
}
interface Scope {
  db: D1Database;
  user: string;
  workspace: string;
  stack: string;
  instance: string;
}
const transition: Record<string, OutcomeEvent> = {
  approved: "postcard_approved",
  hidden: "postcard_hidden",
  deleted: "postcard_deleted",
};
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
const cutoff = (now: Date) => {
  const date = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - OUTCOME_RETENTION_DAYS + 1);
  return date.toISOString().slice(0, 10) + " 00:00:00";
};

// Optional measurement, never an authorization gate. The caller absorbs failure
// and continues the already-authorized app operation without fabricated proof.
export async function prepareModerationOutcome(
  scope: Scope,
  operation: Operation,
  connection: ReturnType<typeof resourceConnection>,
  guard: () => Promise<void>,
) {
  if (operation.action !== "moderate") return;
  const command = JSON.parse(operation.request_json);
  const event = transition[command.status];
  if (
    !event ||
    command.action !== "moderate" ||
    command.operationId !== operation.id ||
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion < 0 ||
    !Number.isSafeInteger(command.itemRevision) ||
    command.itemRevision < 1
  )
    return;
  const { actual, items } = await connection.content(operation.resource_id);
  await guard();
  if (
    actual.resource.id !== operation.resource_id ||
    actual.resource.workspace !== scope.workspace ||
    actual.resource.version !== command.expectedVersion
  )
    return;
  const item = items.find((value) => value.id === command.item);
  if (
    !item ||
    item.synthetic ||
    item.revision !== command.itemRevision ||
    item.status === command.status ||
    item.status === "deleted"
  )
    return;
  await scope.db
    .prepare(
      `INSERT OR IGNORE INTO creator_outcome_intents
    (operation_id,workspace_id,stack_id,instance_id,event,expected_version,request_digest)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM creator_resource_operations
      WHERE id=? AND resource_id=? AND stack_id=? AND instance_id=? AND action='moderate' AND state='pending' AND request_json=?)
    AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor'))`,
    )
    .bind(
      operation.id,
      scope.workspace,
      scope.stack,
      scope.instance,
      event,
      command.expectedVersion,
      await digest(operation.request_json),
      operation.id,
      operation.resource_id,
      scope.stack,
      scope.instance,
      operation.request_json,
      scope.workspace,
      scope.user,
    )
    .run();
}

// Success is taken from the committed journal, including a later verified
// reconciliation. A later item's current state cannot substitute for the proof.
export async function recordModerationOutcome(
  db: D1Database,
  workspace: string,
  stack: string,
  operation: string,
  now = new Date(),
) {
  const proof = await db
    .prepare(
      `SELECT i.*,o.resource_id,o.request_json,o.result_json FROM creator_outcome_intents i
    JOIN creator_resource_operations o ON o.id=i.operation_id JOIN creator_stacks s ON s.id=i.stack_id
    JOIN creator_app_resources r ON r.id=o.resource_id
    WHERE i.operation_id=? AND i.workspace_id=? AND i.stack_id=? AND s.workspace_id=? AND r.workspace_id=?
    AND o.stack_id=i.stack_id AND o.instance_id=i.instance_id AND o.action='moderate' AND o.state='confirmed'
    AND i.created_at>=?`,
    )
    .bind(operation, workspace, stack, workspace, workspace, cutoff(now))
    .first<{
      operation_id: string;
      instance_id: string;
      event: OutcomeEvent;
      expected_version: number;
      request_digest: string;
      resource_id: string;
      request_json: string;
      result_json: string;
    }>();
  if (!proof || (await digest(proof.request_json)) !== proof.request_digest)
    return;
  const request = JSON.parse(proof.request_json),
    result = JSON.parse(proof.result_json);
  if (
    request.action !== "moderate" ||
    request.operationId !== operation ||
    request.expectedVersion !== proof.expected_version ||
    transition[request.status] !== proof.event ||
    result?.contract !== 1 ||
    result?.outcome !== "applied" ||
    result.resource?.id !== proof.resource_id ||
    result.resource?.workspace !== workspace ||
    result.resource?.version !== proof.expected_version + 1
  )
    return;
  await appendOutcome(
    db,
    {
      id: "moderation:" + operation,
      workspace,
      stack,
      instance: proof.instance_id,
      event: proof.event,
      interaction: "server",
      disposition: "none",
      publication: null,
    },
    `EXISTS(SELECT 1 FROM creator_outcome_intents i JOIN creator_resource_operations o ON o.id=i.operation_id
      WHERE i.operation_id=? AND i.workspace_id=? AND i.stack_id=? AND i.request_digest=?
      AND o.state='confirmed' AND o.request_json=? AND o.result_json=?)`,
    [
      operation,
      workspace,
      stack,
      proof.request_digest,
      proof.request_json,
      proof.result_json,
    ],
    now,
  );
}
