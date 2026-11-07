// Owner-only record and read surface for delivery-run receipts.
//
// A recorded receipt is bounded evidence that a caller produced. Recording it
// never approves a release, changes a deployment, contacts a provider or turns
// a failed step green. Independent live verification stays a separate re-read.
import { PluginRouteError } from "emdash";
import type { D1Database } from "@cloudflare/workers-types";
import {
  deliveryReceipt,
  maximumReceiptBytes,
  maximumStoredRuns,
  type DeliveryRun,
  type DeliveryReceipt,
} from "./delivery-runs-contract.ts";

const origin = "https://composer.loftwah.com";
const limits = [
  "Recording a receipt is not release approval, a deployment or a live verification.",
  "The stored receipt is the bounded summary a runner printed; command output and logs are not uploaded.",
  "Only the owner session can record or read these runs; no public page shows them.",
  "The live-source comparison re-reads /build.json in the owner's browser at read time.",
  "An unchanged receipt recorded again keeps one row.",
  "Local checks and a candidate build never prove production.",
];

interface Context {
  user?: { id: string; name?: string | null; role: number };
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
}

interface Row {
  id: string;
  runner: string;
  mode: string;
  state: string;
  run_id: string | null;
  run_url: string | null;
  repository: string | null;
  branch: string | null;
  commit_sha: string | null;
  worker: string | null;
  account: string | null;
  environment: string | null;
  origin: string | null;
  artefact_digest: string | null;
  artefact_files: number | null;
  candidate_digest: string | null;
  release_performed: number;
  verification_performed: number;
  generated_at: string;
  recorded_at: string;
  recorded_by: string;
  receipt_json: string;
}

function receiptId(receipt: DeliveryReceipt) {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(JSON.stringify(receipt)))
    .then(bytes =>
      `delivery-${[...new Uint8Array(bytes)]
        .slice(0, 16)
        .map(value => value.toString(16).padStart(2, "0"))
        .join("")}`,
    );
}

function optional(value: string | null | undefined) {
  return value && value.trim() ? value : null;
}

export function storedRun(row: Row): DeliveryRun {
  return {
    id: row.id,
    runner: row.runner as DeliveryRun["runner"],
    mode: row.mode as DeliveryRun["mode"],
    state: row.state as DeliveryRun["state"],
    runId: row.run_id,
    runUrl: row.run_url,
    repository: row.repository,
    branch: row.branch,
    commit: row.commit_sha as DeliveryRun["commit"],
    worker: row.worker,
    account: row.account,
    environment: row.environment,
    origin: row.origin,
    artefactDigest: row.artefact_digest,
    artefactFiles: row.artefact_files,
    candidateDigest: row.candidate_digest,
    releasePerformed: row.release_performed === 1,
    verificationPerformed: row.verification_performed === 1,
    generatedAt: row.generated_at,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    receipt: deliveryReceipt.parse(JSON.parse(row.receipt_json)),
  };
}

async function listRuns(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id,runner,mode,state,run_id,run_url,repository,branch,commit_sha,worker,account,environment,
        origin,artefact_digest,artefact_files,candidate_digest,release_performed,verification_performed,
        generated_at,recorded_at,recorded_by,receipt_json
       FROM composer_delivery_runs ORDER BY recorded_at DESC, id DESC LIMIT ?`,
    )
    .bind(maximumStoredRuns)
    .all<Row>();
  if (!result.success || !Array.isArray(result.results))
    throw new PluginRouteError(
      "UNAVAILABLE",
      "Recorded delivery runs are unavailable in this environment.",
      503,
    );
  return result.results.map(storedRun);
}

async function recordRun(db: D1Database, receipt: DeliveryReceipt, actor: string) {
  const id = await receiptId(receipt);
  const generatedAt = receipt.generatedAt;
  const recordedAt = new Date().toISOString();
  const existing = await db
    .prepare("SELECT id FROM composer_delivery_runs WHERE id=?")
    .bind(id)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare(
        "UPDATE composer_delivery_runs SET recorded_at=?, recorded_by=? WHERE id=?",
      )
      .bind(recordedAt, actor, id)
      .run();
    return { id, created: false };
  }
  await db
    .prepare(
      `INSERT INTO composer_delivery_runs
        (id,runner,mode,state,run_id,run_url,repository,branch,commit_sha,worker,account,environment,origin,
         artefact_digest,artefact_files,candidate_digest,release_performed,verification_performed,
         generated_at,recorded_at,recorded_by,receipt_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      receipt.runner.kind,
      receipt.mode,
      receipt.state,
      optional(receipt.runner.runId),
      optional(receipt.runner.runUrl),
      optional(receipt.source?.repository),
      optional(receipt.source?.branch),
      receipt.source?.commit ?? null,
      optional(receipt.target?.worker),
      optional(receipt.target?.account),
      optional(receipt.target?.environment),
      optional(receipt.target?.origin),
      optional(receipt.artefact?.digest),
      receipt.artefact?.files ?? null,
      optional(receipt.candidate?.digest),
      receipt.release.performed ? 1 : 0,
      receipt.verification.performed ? 1 : 0,
      generatedAt,
      recordedAt,
      actor,
      JSON.stringify(receipt),
    )
    .run();
  // Bounded retention: the newest receipts stay; older rows are removed. This
  // is the admin evidence list, not a release history replacement (#11 owns it).
  await db
    .prepare(
      `DELETE FROM composer_delivery_runs WHERE id NOT IN (
         SELECT id FROM composer_delivery_runs ORDER BY recorded_at DESC, id DESC LIMIT ?
       )`,
    )
    .bind(maximumStoredRuns)
    .run();
  return { id, created: true };
}

export async function manageDeliveryRuns(ctx: Context, runtime: Runtime) {
  const reject = (code: string, message: string, status: number): never => {
    throw new PluginRouteError(code, message, status);
  };
  if (!ctx.user || ctx.user.role !== 50)
    return reject(
      "FORBIDDEN",
      "Delivery runs require a signed-in administrator.",
      403,
    );
  if (ctx.request.method !== "GET" && ctx.request.method !== "POST")
    return reject("METHOD_NOT_ALLOWED", "Unsupported request.", 405);
  const url = new URL(ctx.request.url);
  if (
    runtime.PUBLIC_ORIGIN !== origin ||
    runtime.RESOURCE_ENVIRONMENT !== "production" ||
    url.origin !== origin ||
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin)
  )
    return reject(
      "UNAVAILABLE",
      "Open this view in the selected Composer production administration.",
      403,
    );
  if (url.search)
    return reject(
      "INVALID",
      "This view accepts no filters or target overrides.",
      400,
    );
  if (!runtime.DB)
    return reject(
      "UNAVAILABLE",
      "Recorded delivery runs are unavailable in this environment.",
      503,
    );
  if (ctx.request.method === "POST") {
    const input = ctx.input;
    if (!input || typeof input !== "object" || Array.isArray(input))
      return reject("INVALID", "Select one supported action.", 400);
    const body = input as Record<string, unknown>;
    const keys = Object.keys(body).sort();
    if (body.action !== "record" || keys.length !== 2 || !("receipt" in body))
      return reject(
        "INVALID",
        "Only recording one receipt is supported.",
        400,
      );
    const raw = body.receipt;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return reject("INVALID", "Select one delivery receipt.", 400);
    if (JSON.stringify(raw).length > maximumReceiptBytes)
      return reject(
        "INVALID",
        "That receipt is larger than the supported bounded contract.",
        413,
      );
    let receipt: DeliveryReceipt;
    try {
      receipt = deliveryReceipt.parse(raw);
    } catch {
      return reject(
        "INVALID",
        "That is not a complete app-composer.delivery-receipt/1 receipt from the supported journey.",
        400,
      );
    }
    let recorded: { id: string; created: boolean };
    try {
      recorded = await recordRun(
        runtime.DB,
        receipt,
        ctx.user.name?.trim() || ctx.user.id,
      );
    } catch {
      return reject(
        "UNAVAILABLE",
        "That receipt could not be stored. Nothing was approved or deployed.",
        503,
      );
    }
    return Response.json({
      ok: true,
      id: recorded.id,
      created: recorded.created,
      runs: await listRuns(runtime.DB),
    });
  }
  if (ctx.input && Object.keys(ctx.input as object).length)
    return reject(
      "INVALID",
      "This view accepts no filters or target overrides.",
      400,
    );
  const runs = await listRuns(runtime.DB);
  return Response.json({
    ok: true,
    site: origin,
    environment: "production",
    checkedAt: new Date().toISOString(),
    runs,
    retention: { stored: runs.length, maximum: maximumStoredRuns },
    limits,
  });
}
