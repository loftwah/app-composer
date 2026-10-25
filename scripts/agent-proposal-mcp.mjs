#!/usr/bin/env node
// Proposal-only MCP endpoint for one owner-issued agent grant.
//
//   COMPOSER_AGENT_TOKEN=<shown once> \
//     node scripts/agent-proposal-mcp.mjs --db <file> --grant <grant> \
//       [--workspace <id>] [--repo-root <path>]
//
// This is the scoped local endpoint from issue #311. It speaks MCP over stdio,
// so an installed Codex/OpenCode-style client can use it without any hosted
// service. It exposes exactly three operations: read the granted scope, read
// (and derive) the scoped briefing, and submit a versioned proposal. There is
// no approve, handoff, deploy, merge, spend, secret-read or access operation in
// this process, and the credential cannot authenticate to EmDash.
//
// The credential is read from the environment, never from a tool argument, so
// a model never has to handle it. Redacted refusals are written to stderr.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import {
  serveStdio,
  StdioServerTransport,
} from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { openLocalDatabase } from "./lib/agent-proposal-local-db.mjs";
import { inspectSource, SourceError } from "./lib/agent-source.mjs";
import {
  createAgentBriefing,
  readAgentBriefing,
  readAgentGrantScope,
  submitAgentProposalViaConnection,
} from "../src/lib/agent-proposals.ts";
import { AgentProposalError } from "../src/lib/agent-proposal-contract.ts";
import { StackError } from "../src/lib/stacks.mjs";

const tokenName = "COMPOSER_AGENT_TOKEN";
const allowed = ["--db", "--grant", "--workspace", "--repo-root", "--now"];

function parse(argv) {
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.includes(flag))
      throw Error(
        `Unsupported argument ${flag}. Credentials belong in ${tokenName}, never in launch arguments.`,
      );
    const value = argv[index + 1];
    if (typeof value !== "string" || !value || value.startsWith("--"))
      throw Error(`--${flag.slice(2)} needs a value.`);
    if (flags.has(flag)) throw Error(`${flag} was supplied twice.`);
    flags.set(flag, value);
    index += 1;
  }
  for (const required of ["--db", "--grant"])
    if (!flags.has(required)) throw Error(`${required} is required.`);
  return flags;
}

const flags = (() => {
  try {
    return parse(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Agent endpoint did not start: ${error.message}\n`);
    process.exit(2);
  }
})();

const token = process.env[tokenName]?.trim();
if (!token) {
  process.stderr.write(
    `Agent endpoint did not start: ${tokenName} is not set. Ask the accountable owner for a grant connection; the value is shown once.\n`,
  );
  process.exit(2);
}

const local = openLocalDatabase(flags.get("--db"));
const grant = flags.get("--grant");
const rows = local.sqlite
  .prepare("SELECT workspace_id FROM creator_agent_grants WHERE id=?")
  .get(grant);
const workspace = flags.get("--workspace") ?? rows?.workspace_id;
if (!rows || !workspace) {
  process.stderr.write(
    "Agent endpoint did not start: that grant is not in this database. No scope, credential or proposal authority was established.\n",
  );
  process.exit(2);
}
if (rows.workspace_id !== workspace) {
  process.stderr.write(
    "Agent endpoint did not start: the selected workspace does not own that grant. No scope was established.\n",
  );
  process.exit(2);
}
const repository = resolve(flags.get("--repo-root") ?? process.cwd());
const clock = flags.get("--now");

const stamp = () => {
  if (clock && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(clock))
    throw Error("Use --now only as a whole-second UTC evidence clock.");
  return clock ?? new Date().toISOString();
};

const auth = () => ({ workspace, grant, token });

function refusal(error, fallback) {
  const code =
    error instanceof AgentProposalError
      ? error.code
      : error instanceof SourceError
        ? error.code
        : error instanceof StackError
          ? error.code
          : "";
  const message =
    error instanceof Error && typeof error.message === "string"
      ? error.message
      : fallback;
  const text = `${code ? `${code}: ` : ""}${message}`.slice(0, 600);
  return { content: [{ type: "text", text }], isError: true };
}

const value = (payload) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  structuredContent: payload,
});

const evidenceInput = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]{1,39}$/)
    .describe("Stable evidence id referenced again when submitting."),
  kind: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe("test, reproduction, observation, log, gate, diff or similar."),
  source: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe("Where a human can re-read this observation."),
  environment: z
    .string()
    .regex(/^[a-z0-9-]{6,64}$/)
    .describe("Must be the granted environment id."),
  observedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    .describe("Whole-second UTC observation time, never invented."),
  summary: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Plain factual summary with no credentials or personal data."),
});

const scope = await readAgentGrantScope(local.db, auth(), {
  now: stamp(),
}).catch((error) => {
  const code =
    error instanceof AgentProposalError || error instanceof StackError
      ? `${error.code}: `
      : "";
  const message =
    error instanceof Error ? error.message : "The grant could not be read.";
  process.stderr.write(
    `Agent endpoint did not start: ${code}${message.slice(0, 400)}\n`,
  );
  process.exit(2);
});
const server = new McpServer(
  { name: "composer-agent-proposal", version: "1.0.0" },
  {
    instructions:
      "Proposal-only connection. Call agent_capabilities first, then agent_brief, then agent_submit. Nothing here approves, deploys, merges, spends or changes access; a human reviews the proposal separately. Never invent evidence and never include credentials.",
  },
);

server.registerTool(
  "agent_capabilities",
  {
    title: "Read the granted scope",
    description:
      "Return the one workspace, app, environment, role pack, agent identity, owner, fallback, expiry and the exact permitted capabilities for this connection, plus the actions reserved for humans. Read-only. No arguments.",
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const fresh = await readAgentGrantScope(local.db, auth(), {
        now: stamp(),
      });
      return value(fresh);
    } catch (error) {
      return refusal(error, "The granted scope could not be read.");
    }
  },
);

server.registerTool(
  "agent_brief",
  {
    title: "Derive or re-read the scoped briefing",
    description:
      "Store and return the deterministic, read-only briefing for this grant: role-pack inputs, permitted evidence, output schema, stop rules and prohibitions. Identical evidence returns the same briefing and digest. Pass an existing briefing id to resume later without guessing. Briefing is not approval.",
    inputSchema: z.union([
      z.object({ evidence: z.array(evidenceInput).min(1).max(20) }).strict(),
      z.object({ briefing: z.string().regex(/^[a-z0-9-]{6,64}$/) }).strict(),
    ]),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    try {
      await readAgentGrantScope(local.db, auth(), { now: stamp() });
      if ("briefing" in input) {
        const stored = await readAgentBriefing(
          local.db,
          { workspace, grant, token, briefing: input.briefing },
          { now: stamp() },
        );
        return value({
          briefing: {
            id: stored.id,
            digest: stored.digest,
            created: false,
            asOf: stored.content.asOf,
            environment: stored.content.scope.environment,
            permittedEvidence: stored.content.permittedEvidence.map(
              (item) => item.id,
            ),
          },
          markdown: stored.markdown.slice(0, 12000),
          execution: "not-performed",
        });
      }
      const at = stamp();
      const briefing = await createAgentBriefing(
        local.db,
        { workspace, grant, asOf: at, evidence: input.evidence },
        { now: at },
      );
      return value({
        briefing: {
          id: briefing.id,
          digest: briefing.digest,
          created: briefing.created,
          asOf: briefing.content.asOf,
          environment: briefing.content.scope.environment,
          permittedEvidence: briefing.content.permittedEvidence.map(
            (item) => item.id,
          ),
        },
        markdown: briefing.markdown.slice(0, 12000),
        execution: "not-performed",
      });
    } catch (error) {
      return refusal(error, "The briefing could not be derived.");
    }
  },
);

server.registerTool(
  "agent_submit",
  {
    title: "Submit a versioned proposal",
    description:
      "Submit one reviewable proposal version for this grant. The endpoint hashes the proposed source itself: a local path inside the selected checkout, or a repository plus commit. The proposal appears in the Composer review queue and performs no execution.",
    inputSchema: z
      .object({
        briefing: z
          .string()
          .regex(/^[a-z0-9-]{6,64}$/)
          .describe("Briefing id returned by agent_brief."),
        proposal: z
          .string()
          .regex(/^[a-z0-9-]{6,64}$/)
          .optional()
          .describe(
            "Existing proposal id, only when answering a change request.",
          ),
        source: z
          .union([
            z
              .object({
                kind: z.literal("local-path"),
                path: z.string().min(1).max(300),
              })
              .strict(),
            z
              .object({
                kind: z.literal("repo"),
                repository: z.string().min(2).max(200),
                commit: z.string().regex(/^[a-f0-9]{7,40}$/),
                checkout: z.string().min(1).max(300).optional(),
              })
              .strict(),
          ])
          .describe(
            "Reviewable source identity. The endpoint recomputes the hash.",
          ),
        evidence: z
          .array(z.string().regex(/^[a-z0-9][a-z0-9._-]{1,39}$/))
          .min(1)
          .max(20)
          .describe("Evidence ids already permitted by this briefing."),
        risk: z.enum(["low", "medium", "high"]),
        change: z
          .union([
            z
              .object({
                kind: z.literal("diff"),
                summary: z.string().trim().min(1).max(400),
                patch: z.string().trim().min(1).max(120000),
              })
              .strict(),
            z
              .object({
                kind: z.literal("actions"),
                summary: z.string().trim().min(1).max(400),
                actions: z
                  .array(
                    z
                      .object({
                        op: z.enum([
                          "edit",
                          "create",
                          "delete",
                          "configure",
                          "investigate",
                          "verify",
                        ]),
                        target: z.string().trim().min(1).max(200),
                        detail: z.string().trim().min(1).max(600),
                      })
                      .strict(),
                  )
                  .min(1)
                  .max(20),
              })
              .strict(),
          ])
          .describe("A bounded diff or 1-20 structured actions."),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    try {
      const at = stamp();
      await readAgentGrantScope(local.db, auth(), { now: at });
      const source = inspectSource(input.source, repository, at);
      const result = await submitAgentProposalViaConnection(
        local.db,
        {
          workspace,
          grant,
          token,
          briefing: input.briefing,
          ...(input.proposal ? { proposal: input.proposal } : {}),
          source: input.source,
          evidence: input.evidence,
          risk: input.risk,
          change: input.change,
        },
        { now: at, source },
      );
      return value({
        proposal: {
          id: result.view.id,
          version: result.view.version,
          state: result.view.state,
          digest: result.view.digest,
          risk: result.view.risk,
          app: result.view.app,
          environment: result.view.environment,
          rolePack: result.view.rolePack,
          submittedAt: result.view.submittedAt,
          nextAction: result.view.nextAction,
          execution: result.view.execution,
        },
        deduplicated: result.deduplicated,
      });
    } catch (error) {
      return refusal(error, "The proposal was refused before any change.");
    }
  },
);

process.stderr.write(
  `Composer agent endpoint ready: grant ${scope.grant} · ${scope.app} · ${scope.environment.kind}/${scope.environment.id} · ${scope.rolePack} · expires ${scope.expiresAt}. Proposal-only; no approval or execution capability.\n`,
);

serveStdio(() => server, {
  transport: new StdioServerTransport(process.stdin, process.stdout, {
    maxBufferSize: 262144,
  }),
  onerror: () =>
    process.stderr.write(
      "Composer agent endpoint transport failed. No approval or execution was attempted.\n",
    ),
  maxSubscriptions: 0,
});
