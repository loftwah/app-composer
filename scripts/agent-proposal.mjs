#!/usr/bin/env node
// Local-first agent proposal intake for App Composer.
//
//   node scripts/agent-proposal.mjs grant ...
//   node scripts/agent-proposal.mjs brief --grant ... --evidence ... --as-of ...
//   node scripts/agent-proposal.mjs submit --grant ... --briefing ... --source-path ...
//   node scripts/agent-proposal.mjs list --workspace ...
//   node scripts/agent-proposal.mjs show --proposal ...
//   node scripts/agent-proposal.mjs review --proposal ... --decision accept ...
//   node scripts/agent-proposal.mjs verify --proposal ...
//   node scripts/agent-proposal.mjs handoff --proposal ...
//
// The CLI stores rows in one explicitly selected SQLite file. It does not
// deploy, merge, spend, send, invite, rotate credentials or change access.
// Accepting records a decision; a separate handoff is prepared for the
// existing release flow. Identities are asserted locally; this is not a
// connected authentication claim.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openLocalDatabase,
  ensureWorkspace,
} from "./lib/agent-proposal-local-db.mjs";
import {
  inspectSource,
  checkSource,
  SourceError,
} from "./lib/agent-source.mjs";
import {
  createAgentBriefing,
  listAgentProposals,
  prepareAgentHandoff,
  provisionAgentGrant,
  revokeAgentGrant,
  reviewAgentProposal,
  showAgentProposal,
  submitAgentProposal,
  verifyAgentProposal,
} from "../src/lib/agent-proposals.ts";
import { AgentProposalError } from "../src/lib/agent-proposal-contract.ts";
import { StackError } from "../src/lib/stacks.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parse(argv) {
  const options = { command: "help", flags: new Map() };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("-")) options.command = rest.shift();
  while (rest.length) {
    const arg = rest.shift();
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const name = arg.slice(2);
    if (["json", "help", "confirm-owner"].includes(name)) {
      options.flags.set(name, true);
      continue;
    }
    const value = rest.shift();
    if (value === undefined) throw new Error(`--${name} needs a value.`);
    if (options.flags.has(name))
      throw new Error(`--${name} was supplied twice.`);
    options.flags.set(name, value);
  }
  return options;
}

function flag(options, name, required = false) {
  const value = options.flags.get(name);
  if (required && (typeof value !== "string" || !value.trim()))
    throw new Error(`--${name} is required.`);
  return typeof value === "string" ? value.trim() : undefined;
}

function requireConfirmation(options) {
  if (options.flags.get("confirm-owner") !== true)
    throw new Error(
      "Owner commands need --confirm-owner. This CLI is a local lab, not an authentication provider.",
    );
}

function now(options) {
  return flag(options, "now") ?? new Date().toISOString();
}

function readJson(path, label) {
  let raw;
  try {
    raw = readFileSync(resolve(repository, path), "utf8");
  } catch {
    throw new Error(`Cannot read ${label} at ${path}.`);
  }
  if (raw.length > 2_000_000)
    throw new Error(
      `${label} exceeds 2 MB. Keep the reviewable input bounded.`,
    );
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `${label} is not valid JSON. A parse failure is not an empty input.`,
    );
  }
}

function writeOut(path, text) {
  const absolute = resolve(repository, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text);
  return absolute;
}

function evidenceList(path) {
  const parsed = readJson(path, "Evidence file");
  const evidence = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.evidence)
      ? parsed.evidence
      : null;
  if (!evidence)
    throw new Error("Evidence file must be an array or {evidence:[...]}.");
  return evidence;
}

function ids(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function workspaceForProposal(sqlite, id) {
  const row = sqlite
    .prepare("SELECT workspace_id FROM creator_agent_proposals WHERE id=?")
    .get(id);
  if (!row) throw new Error(`No proposal ${id} is stored in this database.`);
  return row.workspace_id;
}

function grantFor(sqlite, id) {
  const row = sqlite
    .prepare("SELECT * FROM creator_agent_grants WHERE id=?")
    .get(id);
  if (!row) throw new Error(`No grant ${id} is stored in this database.`);
  return row;
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function shortDigest(value) {
  return value ? `${value.slice(0, 16)}…${value.slice(-8)}` : "—";
}

function describe(view) {
  const accepted = view.accepted
    ? `${view.accepted.digest.slice(0, 16)}… by ${view.accepted.by} at ${view.accepted.at}`
    : "none";
  const handoff = view.handoff
    ? `${view.handoff.id} · ${view.handoff.destination} · ${view.handoff.execution}`
    : "none";
  return [
    `Proposal ${view.id} · version ${view.version} · ${view.state}`,
    `Scope: workspace ${view.workspace} · app ${view.app} · ${view.environment.kind}/${view.environment.id} · account ${view.environment.account}`,
    `Role pack: ${view.rolePack} ${view.rolePackVersion}`,
    `Risk: ${view.risk}`,
    `Digest: ${view.digest}`,
    `Briefing: ${view.briefing.id} · ${view.briefing.digest} · as of ${view.briefing.asOf}`,
    `Proposer: ${view.proposer.name} (${view.proposer.id})`,
    `Grant: ${view.grant.id} · ${view.grant.state} · expires ${view.grant.expiresAt} · ${view.grant.mode}`,
    `Owner: ${view.grant.owner.name} · fallback ${view.grant.fallback.name}`,
    `Source: ${
      view.source.kind === "repo"
        ? `${view.source.repository}@${view.source.commit}${view.source.checkout ? ` (checkout ${view.source.checkout})` : ""}`
        : `${view.source.path} · ${view.source.contentHash}`
    }`,
    `Evidence: ${view.evidence.map((item) => item.id).join(", ")}`,
    `Change: ${view.change.kind} · ${view.change.summary}`,
    `Reviews: ${
      view.reviews.length
        ? view.reviews
            .map(
              (review) =>
                `${review.decision} v${review.version} by ${review.actor.name} at ${review.createdAt}: ${review.reason}`,
            )
            .join(" | ")
        : "none"
    }`,
    `Accepted: ${accepted}`,
    `Handoff: ${handoff}`,
    `Next action: ${view.nextAction}`,
    "Execution: not performed by this record.",
  ].join("\n");
}

function help() {
  return `App Composer agent proposals — local-first, proposal-only.

Usage
  node scripts/agent-proposal.mjs grant --db <file> --workspace <id> --workspace-name <name> \\
    --app <id> --environment <id> --environment-kind local|preview --account <id> \\
    --role <pack> --agent-id <id> --agent-name <name> --owner-id <id> --owner-name <name> \\
    --fallback-id <id> --fallback-name <name> --issued-by <name> --expires-at <ISO> --confirm-owner
  node scripts/agent-proposal.mjs revoke --db <file> --grant <id> --actor-id <id> --actor-name <name> --reason <text> --confirm-owner
  node scripts/agent-proposal.mjs brief --db <file> --grant <id> --evidence <json> --as-of <ISO> [--out <md>] [--json]
  node scripts/agent-proposal.mjs submit --db <file> --grant <id> --briefing <id> --evidence <ids> \\
    (--source-path <path> | --source-repo <name> --source-commit <sha> [--checkout <path>]) \\
    --change <json> --risk low|medium|high [--proposal <id>] [--json]
  node scripts/agent-proposal.mjs list --db <file> --workspace <id> [--state <state>] [--json]
  node scripts/agent-proposal.mjs show --db <file> --proposal <id> [--json]
  node scripts/agent-proposal.mjs review --db <file> --proposal <id> --decision accept|request-changes|reject \\
    --actor-id <id> --actor-name <name> --actor-kind human|agent --reason <text> \\
    --expected-digest <sha256> [--expected-version <n>] [--json]
  node scripts/agent-proposal.mjs verify --db <file> --proposal <id> [--expected-digest <sha256>] [--json]
  node scripts/agent-proposal.mjs handoff --db <file> --proposal <id> --actor-id <id> --actor-name <name> \\
    --expected-digest <sha256> [--destination existing-release-flow|existing-delivery-flow] [--json]

Roles
  ${["service-owner", "programmer", "architect", "devops", "security", "qa"].join(", ")}

Exit codes
  0  recorded or verified
  2  refused before any record changed
  3  stored but verification found a stale source, expired grant or changed digest

Boundaries
  A grant is proposal-only. It cannot approve, deploy, merge, spend, invite,
  delete, rotate a credential or change access. Accepting a digest executes
  nothing; a separate handoff artifact is prepared for the existing release
  flow. Identities and --now are asserted for the local lab and are not
  connected authentication.
`;
}

function run(options, local) {
  const { db, sqlite } = local;
  const command = options.command;
  if (command === "grant") {
    requireConfirmation(options);
    const workspace = flag(options, "workspace", true);
    const name = flag(options, "workspace-name", true);
    ensureWorkspace(sqlite, workspace, name);
    return provisionAgentGrant(
      db,
      {
        workspace,
        app: flag(options, "app", true),
        environment: {
          id: flag(options, "environment", true),
          kind: flag(options, "environment-kind", true),
          account: flag(options, "account", true),
        },
        rolePack: flag(options, "role", true),
        agent: {
          id: flag(options, "agent-id", true),
          name: flag(options, "agent-name", true),
        },
        owner: {
          id: flag(options, "owner-id", true),
          name: flag(options, "owner-name", true),
        },
        fallback: {
          id: flag(options, "fallback-id", true),
          name: flag(options, "fallback-name", true),
        },
        issuedBy: flag(options, "issued-by", true),
        expiresAt: flag(options, "expires-at", true),
      },
      { now: now(options) },
    ).then((grant) => {
      if (options.flags.get("json")) printJson(grant);
      else
        process.stdout.write(
          `Grant ${grant.id} · ${grant.state} · ${grant.mode}\nScope: ${grant.workspace}/${grant.app}/${grant.environment.kind}/${grant.environment.id} · ${grant.rolePack}\nAgent: ${grant.agent.name} (${grant.agent.id})\nOwner: ${grant.owner.name} · fallback ${grant.fallback.name}\nExpires: ${grant.expiresAt}\n`,
        );
      return 0;
    });
  }
  if (command === "revoke") {
    requireConfirmation(options);
    const grantId = flag(options, "grant", true);
    const grant = grantFor(sqlite, grantId);
    return revokeAgentGrant(
      db,
      {
        workspace: grant.workspace_id,
        grant: grantId,
        actor: {
          id: flag(options, "actor-id", true),
          name: flag(options, "actor-name", true),
        },
        reason: flag(options, "reason", true),
      },
      {
        now: now(options),
        actorKind: flag(options, "actor-kind") === "agent" ? "agent" : "human",
      },
    ).then((view) => {
      if (options.flags.get("json")) printJson(view);
      else
        process.stdout.write(
          `Grant ${view.id} · ${view.state} · revoked ${view.revokedAt ?? "—"}\n`,
        );
      return 0;
    });
  }
  if (command === "brief") {
    const grantId = flag(options, "grant", true);
    const grant = grantFor(sqlite, grantId);
    const asOf = flag(options, "as-of", true);
    return createAgentBriefing(
      db,
      {
        workspace: grant.workspace_id,
        grant: grantId,
        asOf,
        evidence: evidenceList(flag(options, "evidence", true)),
      },
      { now: asOf },
    ).then((briefing) => {
      if (options.flags.get("out")) {
        const absolute = writeOut(flag(options, "out"), briefing.markdown);
        process.stderr.write(`Briefing written: ${absolute}\n`);
      }
      if (options.flags.get("json"))
        printJson({
          id: briefing.id,
          digest: briefing.digest,
          created: briefing.created,
          markdown: briefing.markdown,
        });
      else if (!options.flags.get("out"))
        process.stdout.write(briefing.markdown);
      else
        process.stdout.write(
          `Briefing ${briefing.id}\nDigest: ${briefing.digest}\nCreated: ${briefing.created ? "yes" : "no — identical briefing reused"}\n`,
        );
      return 0;
    });
  }
  if (command === "submit") {
    const grantId = flag(options, "grant", true);
    const grant = grantFor(sqlite, grantId);
    const at = now(options);
    let source;
    if (flag(options, "source-path")) {
      source = inspectSource(
        { kind: "local-path", path: flag(options, "source-path") },
        flag(options, "repo-root") ?? process.cwd(),
        at,
      );
    } else {
      source = inspectSource(
        {
          kind: "repo",
          repository: flag(options, "source-repo", true),
          commit: flag(options, "source-commit", true),
          checkout: flag(options, "checkout"),
        },
        flag(options, "repo-root") ?? process.cwd(),
        at,
      );
    }
    const change = readJson(flag(options, "change", true), "Change file");
    const commandInput = {
      action: "submit",
      workspace: flag(options, "workspace") ?? grant.workspace_id,
      app: flag(options, "app") ?? grant.app,
      environment: {
        id: flag(options, "environment") ?? grant.environment_id,
        kind: flag(options, "environment-kind") ?? grant.environment_kind,
        account: flag(options, "account") ?? grant.account_id,
      },
      rolePack: flag(options, "role") ?? grant.role_pack,
      grant: grantId,
      briefing: flag(options, "briefing", true),
      proposal: flag(options, "proposal"),
      agent: { id: grant.agent_id, name: grant.agent_name },
      source:
        source.kind === "local-path"
          ? { kind: "local-path", path: source.path }
          : {
              kind: "repo",
              repository: source.repository,
              commit: source.commit,
              checkout: source.checkout ?? undefined,
            },
      evidence: ids(flag(options, "evidence", true)),
      risk: flag(options, "risk", true),
      change,
    };
    return submitAgentProposal(db, commandInput, {
      now: at,
      source,
    }).then((result) => {
      if (options.flags.get("json"))
        printJson({
          deduplicated: result.deduplicated,
          proposal: result.view,
        });
      else
        process.stdout.write(
          `${result.deduplicated ? "Existing proposal reused (same digest)" : "Proposal saved"}\n${describe(result.view)}\n`,
        );
      return 0;
    });
  }
  if (command === "list") {
    const workspace = flag(options, "workspace", true);
    return listAgentProposals(
      db,
      {
        workspace,
        state: flag(options, "state"),
      },
      { now: now(options) },
    ).then((proposals) => {
      if (options.flags.get("json")) {
        printJson({ workspace, proposals });
        return 0;
      }
      if (!proposals.length) {
        process.stdout.write(`No proposals in ${workspace}.\n`);
        return 0;
      }
      for (const view of proposals)
        process.stdout.write(
          `${view.id} · v${view.version} · ${view.state} · ${view.risk} · ${view.rolePack} · ${view.app}/${view.environment.id} · ${shortDigest(view.digest)}\n`,
        );
      return 0;
    });
  }
  if (command === "show") {
    const proposal = flag(options, "proposal", true);
    const workspace =
      flag(options, "workspace") ?? workspaceForProposal(sqlite, proposal);
    return showAgentProposal(
      db,
      { workspace, proposal },
      { now: now(options) },
    ).then((view) => {
      if (options.flags.get("json")) printJson(view);
      else process.stdout.write(describe(view) + "\n");
      return 0;
    });
  }
  if (command === "review") {
    const proposal = flag(options, "proposal", true);
    const workspace =
      flag(options, "workspace") ?? workspaceForProposal(sqlite, proposal);
    const at = now(options);
    return showAgentProposal(db, { workspace, proposal }, { now: at })
      .then((view) => {
        const sourceCheck = checkSource(
          view.source,
          flag(options, "repo-root") ?? process.cwd(),
          at,
        );
        return reviewAgentProposal(
          db,
          {
            action: "review",
            workspace,
            proposal,
            environment: flag(options, "environment") ?? view.environment.id,
            decision: flag(options, "decision", true),
            actor: {
              id: flag(options, "actor-id", true),
              name: flag(options, "actor-name", true),
            },
            reason: flag(options, "reason", true),
            expectedDigest: flag(options, "expected-digest", true),
            expectedVersion: Number(
              flag(options, "expected-version") ?? view.version,
            ),
          },
          {
            now: at,
            actorKind:
              flag(options, "actor-kind") === "agent" ? "agent" : "human",
            sourceCheck,
          },
        );
      })
      .then((result) => {
        if (options.flags.get("json"))
          printJson({ proposal: result.view, execution: result.execution });
        else
          process.stdout.write(
            `${result.view.state === "accepted" ? "Accepted" : result.view.state === "rejected" ? "Rejected" : "Changes requested"}\n${describe(result.view)}\n`,
          );
        return 0;
      });
  }
  if (command === "verify") {
    const proposal = flag(options, "proposal", true);
    const workspace =
      flag(options, "workspace") ?? workspaceForProposal(sqlite, proposal);
    const at = now(options);
    return showAgentProposal(db, { workspace, proposal }, { now: at })
      .then((view) => {
        const sourceCheck = checkSource(
          view.source,
          flag(options, "repo-root") ?? process.cwd(),
          at,
        );
        return verifyAgentProposal(
          db,
          { workspace, proposal },
          {
            now: at,
            sourceCheck,
          },
        );
      })
      .then((result) => {
        const expected = flag(options, "expected-digest");
        if (
          expected &&
          expected !== result.storedDigest &&
          expected !== result.acceptedDigest
        ) {
          process.stderr.write(
            `Refused (DIGEST_MISMATCH): expected ${expected}, stored ${result.storedDigest}, accepted ${result.acceptedDigest ?? "—"}.\n`,
          );
          return 3;
        }
        if (options.flags.get("json")) printJson(result);
        else {
          process.stdout.write(
            `Verify ${result.proposal} · ${result.state} · version ${result.versionNumber}\nStored digest: ${result.storedDigest}\nCurrent digest: ${result.currentDigest ?? "—"}\nAccepted digest: ${result.acceptedDigest ?? "—"}\nSource: ${result.source.state} — ${result.source.detail}\nGrant: ${result.grant.state} — ${result.grant.detail}\nHandoff: ${result.handoff.state}${result.handoff.state === "prepared" ? ` (digest matches: ${result.handoff.digestMatches ? "yes" : "no"})` : ""}\nExecution: ${result.execution}\n\n`,
          );
          for (const check of result.checks)
            process.stdout.write(
              `${check.ok ? "PASS" : "FAIL"} ${check.id} — ${check.detail}\n`,
            );
        }
        return result.ok ? 0 : 3;
      });
  }
  if (command === "handoff") {
    const proposal = flag(options, "proposal", true);
    const workspace =
      flag(options, "workspace") ?? workspaceForProposal(sqlite, proposal);
    const at = now(options);
    return showAgentProposal(db, { workspace, proposal }, { now: at })
      .then((view) => {
        const sourceCheck = checkSource(
          view.source,
          flag(options, "repo-root") ?? process.cwd(),
          at,
        );
        return prepareAgentHandoff(
          db,
          {
            action: "handoff",
            workspace,
            proposal,
            environment: flag(options, "environment") ?? view.environment.id,
            actor: {
              id: flag(options, "actor-id", true),
              name: flag(options, "actor-name", true),
            },
            expectedDigest: flag(options, "expected-digest", true),
            destination:
              flag(options, "destination") ?? "existing-release-flow",
          },
          {
            now: at,
            actorKind:
              flag(options, "actor-kind") === "agent" ? "agent" : "human",
            sourceCheck,
          },
        );
      })
      .then((result) => {
        if (options.flags.get("json"))
          printJson({ proposal: result.view, artifact: result.artifact });
        else
          process.stdout.write(
            `Handoff prepared — execution NOT performed.\n${describe(result.view)}\n\nArtifact\n${JSON.stringify(result.artifact, null, 2)}\n`,
          );
        return 0;
      });
  }
  if (["execute", "deploy", "approve", "merge"].includes(command))
    throw new StackError(
      "NOT_SUPPORTED",
      "This CLI has no execute, deploy, approve or merge command. Acceptance is a decision; execution belongs to the existing authorised release flow.",
      403,
    );
  process.stdout.write(help());
  return 2;
}

try {
  const options = parse(process.argv.slice(2));
  if (options.command === "help" || options.flags.get("help")) {
    process.stdout.write(help());
    process.exitCode = 0;
  } else {
    const dbPath = flag(options, "db", true);
    const local = openLocalDatabase(resolve(repository, dbPath));
    try {
      process.exitCode = await run(options, local);
    } finally {
      local.close();
    }
  }
} catch (error) {
  if (error instanceof StackError) {
    process.stderr.write(`Refused (${error.code}): ${error.message}\n`);
    const action =
      error.code === "SELF_APPROVAL"
        ? "Route the decision to a separate accountable human."
        : error.code === "SOURCE_STALE"
          ? "Regenerate the briefing and proposal from the current source."
          : error.code === "GRANT_REVOKED" || error.code === "GRANT_EXPIRED"
            ? "Ask the accountable owner for a new grant."
            : "Correct the input; no record was changed.";
    process.stderr.write(`Human action: ${action}\n`);
    process.exitCode = 2;
  } else if (error instanceof SourceError) {
    process.stderr.write(
      `Refused (${error.code}): ${error.message}\nHuman action: ${error.humanAction}\n`,
    );
    process.exitCode = 2;
  } else if (error instanceof AgentProposalError) {
    process.stderr.write(
      `Refused (${error.code}): ${error.message}\nHuman action: ${error.humanAction}\n`,
    );
    process.exitCode = 2;
  } else {
    process.stderr.write(
      `Refused: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 2;
  }
}
