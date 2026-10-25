// One explicitly invoked local recovery action. No shell, deployment or provider API.
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { z } from "zod";
import {
  showAgentProposal,
  verifyAgentProposal,
} from "../../src/lib/agent-proposals.ts";
import { checkSource } from "./agent-source.mjs";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const captionRecovery = z
  .object({
    version: z.literal("composer.caption-recovery/1"),
    team: z.literal("fictional-team-a"),
    expectedRevision: z.number().int().positive(),
    expectedCaption: z.null(),
    caption: z.string().trim().min(1).max(200),
  })
  .strict();
const targetSchema = z
  .object({
    version: z.literal("composer.incident-execution-target/1"),
    account: z.literal("fictional-local-account"),
    environment: z.string().min(6),
    workspace: z.string().min(6),
    app: z.string().min(3),
    database: z.string().min(1),
    sourceRoot: z.string().min(1),
    origin: z.string().url(),
    baseline: sha,
    control: sha,
  })
  .strict();
const digest = (text) => createHash("sha256").update(text).digest("hex");
function requireThat(ok, code) {
  if (!ok) throw Object.assign(Error(code), { code });
}
function owned(root, name) {
  requireThat(!name.split(/[\\/]/).includes(".."), "PATH_ESCAPE");
  const path = join(root, name);
  let cursor = root;
  for (const part of relative(root, path).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    requireThat(!lstatSync(cursor).isSymbolicLink(), "SYMLINK_REFUSED");
  }
  const actual = realpathSync(path);
  requireThat(actual === root || actual.startsWith(root + sep), "PATH_ESCAPE");
  return actual;
}
function d1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
  });
  return { prepare: statement };
}
async function sample(origin, path) {
  const response = await fetch(origin + "/incident-lab-canary/" + path, {
    redirect: "error",
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
  });
  const reader = response.body.getReader();
  let size = 0;
  const parts = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      requireThat(size <= 65536, "RESPONSE_TOO_LARGE");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return {
    path,
    status: response.status,
    sha256: digest(Buffer.concat(parts)),
    at: new Date().toISOString(),
  };
}

export async function executeCaptionRecovery({
  root,
  workspace,
  proposal,
  expectedDigest,
  actor,
  confirmOwner = false,
  mode = "plan",
}) {
  requireThat(["plan", "execute"].includes(mode), "MODE_REFUSED");
  requireThat(
    mode === "plan" || confirmOwner === true,
    "OWNER_CONFIRMATION_REQUIRED",
  );
  root = realpathSync(root);
  const target = targetSchema.parse(
    JSON.parse(readFileSync(owned(root, "incident-target.json"), "utf8")),
  );
  const url = new URL(target.origin);
  requireThat(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.port &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    "LOCAL_TARGET_REQUIRED",
  );
  requireThat(workspace === target.workspace, "SCOPE_MISMATCH");
  const database = owned(root, target.database),
    sourceRoot = owned(root, target.sourceRoot);
  const sqlite = new DatabaseSync(database);
  let transaction = false;
  try {
    sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000");
    // One transaction pins proposal/grant/current action and target revision across dispatch.
    sqlite.exec("BEGIN IMMEDIATE");
    transaction = true;
    const db = d1(sqlite);
    const view = await showAgentProposal(db, { workspace, proposal });
    requireThat(
      view.environment.kind === "local" &&
        view.environment.id === target.environment &&
        view.environment.account === target.account &&
        view.app === target.app,
      "SCOPE_MISMATCH",
    );
    requireThat(
      view.grant.owner.id === actor && view.proposer.id !== actor,
      "OWNER_REQUIRED",
    );
    requireThat(
      view.state === "accepted" &&
        view.digest === expectedDigest &&
        view.handoff?.artifact?.digest === expectedDigest,
      "EXACT_APPROVAL_REQUIRED",
    );
    requireThat(view.source.kind === "local-path", "LOCAL_SOURCE_REQUIRED");
    owned(sourceRoot, view.source.path);
    const sourceCheck = checkSource(
      view.source,
      sourceRoot,
      new Date().toISOString(),
    );
    const verification = await verifyAgentProposal(
      db,
      { workspace, proposal },
      { sourceCheck },
    );
    requireThat(
      verification.ok && verification.acceptedMatchesCurrent,
      "STALE_PROPOSAL",
    );
    requireThat(
      view.change.incident?.mode === "isolated-lab" &&
        view.change.kind === "actions" &&
        view.change.actions.length === 1,
      "ACTION_REFUSED",
    );
    const action = view.change.actions[0];
    requireThat(
      action.op === "configure" && action.target === "incident-canary.caption",
      "ACTION_REFUSED",
    );
    const command = captionRecovery.parse(JSON.parse(action.detail));
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS incident_execution_receipts (digest TEXT PRIMARY KEY, proposal TEXT NOT NULL, version INTEGER NOT NULL, actor TEXT NOT NULL, state TEXT NOT NULL, receipt_json TEXT NOT NULL)`,
    );
    const prior = sqlite
      .prepare(
        "SELECT receipt_json FROM incident_execution_receipts WHERE digest=?",
      )
      .get(expectedDigest);
    if (prior) {
      sqlite.exec("ROLLBACK");
      transaction = false;
      return { ...JSON.parse(prior.receipt_json), duplicate: true };
    }
    const row = sqlite
      .prepare("SELECT caption,revision FROM incident_lab_canary WHERE team=?")
      .get(command.team);
    requireThat(
      row?.revision === command.expectedRevision && row.caption === null,
      "TARGET_CHANGED",
    );
    const result = {
      version: "composer.incident-execution/1",
      id: randomUUID(),
      proposal,
      proposalVersion: view.version,
      digest: expectedDigest,
      actor,
      target: {
        account: target.account,
        environment: target.environment,
        workspace,
        app: target.app,
      },
      action: "restore-local-caption",
      beforeRevision: row.revision,
      afterRevision: row.revision + 1,
      state: mode === "plan" ? "ready" : "applied-unverified",
      at: new Date().toISOString(),
      observations: [],
    };
    if (mode === "plan") {
      sqlite.exec("ROLLBACK");
      transaction = false;
      return result;
    }
    const changed = sqlite
      .prepare(
        "UPDATE incident_lab_canary SET caption=?,revision=revision+1 WHERE team=? AND revision=? AND caption IS NULL",
      )
      .run(command.caption, command.team, command.expectedRevision);
    requireThat(Number(changed.changes) === 1, "TARGET_CHANGED");
    sqlite
      .prepare("INSERT INTO incident_execution_receipts VALUES(?,?,?,?,?,?)")
      .run(
        expectedDigest,
        proposal,
        view.version,
        actor,
        result.state,
        JSON.stringify(result),
      );
    sqlite.exec("COMMIT");
    transaction = false;
    // An action receipt cannot declare recovery: three independent HTTP samples and control must match.
    try {
      for (let i = 0; i < 3; i++) {
        const observation = await sample(target.origin, "page");
        result.observations.push(observation);
        requireThat(
          observation.status === 200 && observation.sha256 === target.baseline,
          "RECOVERY_UNVERIFIED",
        );
        if (i < 2) await new Promise((yes) => setTimeout(yes, 100));
      }
      const control = await sample(target.origin, "control");
      result.observations.push(control);
      requireThat(
        control.status === 200 && control.sha256 === target.control,
        "CONTROL_CHANGED",
      );
      result.state = "recovered";
    } catch (error) {
      result.failure = error.code ?? "VERIFICATION_FAILED";
    }
    sqlite
      .prepare(
        "UPDATE incident_execution_receipts SET state=?,receipt_json=? WHERE digest=?",
      )
      .run(result.state, JSON.stringify(result), expectedDigest);
    return result;
  } finally {
    if (transaction) sqlite.exec("ROLLBACK");
    sqlite.close();
  }
}
