import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import {
  isPrivateBenchmarkOwner,
  listPrivateBenchmarkWorkspaces,
} from "../../../lib/benchmark-private-runs.ts";
import {
  deletePrivateBenchmarkSuite,
  MAX_PRIVATE_BENCHMARK_SUITE_BYTES,
  getPrivateBenchmarkSuite,
  isPrivateBenchmarkSuiteProject,
  listPrivateBenchmarkSuiteProjects,
  listPrivateBenchmarkSuites,
  savePrivateBenchmarkSuite,
  type PrivateBenchmarkSuiteScope,
  type PrivateBenchmarkSuiteDefinition,
} from "../../../lib/benchmark-private-suites.ts";
import { benchmarkSuiteCatalogue } from "../../../lib/benchmark-suite-catalogue.ts";
import { validateBenchmarkSuite } from "../../../lib/benchmark-suite.mjs";
import { readBoundedJsonBody } from "../../../lib/benchmark-body.ts";

export const prerender = false;

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
const fail = (status: number, error: string) => reply({ ok: false, error }, status);

const workspacePattern = /^[a-z0-9-]{6,64}$/;
const projectPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const suitePattern = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
const MAX_SUITE_CHECKS = 100;
const MAX_SUITE_ID = 32;

const handle: APIRoute = async ({ request, locals }) => {
  const ownerId = locals.user?.id;
  if (!ownerId) return fail(401, "Sign in to open your private benchmark suites.");

  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return fail(503, "Private benchmark suites are unavailable.");

  const url = new URL(request.url);
  const { searchParams } = url;
  const workspace = searchParams.get("workspace");
  const project = searchParams.get("project");
  const id = searchParams.get("id");

  // Reject unknown, repeated or malformed scope before touching the database.
  if (Array.from(searchParams.keys()).some(key =>
    (key !== "workspace" && key !== "project" && key !== "id") || searchParams.getAll(key).length !== 1
  )) return fail(400, "Choose one valid workspace, project and suite.");
  if ((workspace !== null && !workspacePattern.test(workspace)) ||
      (project !== null && !projectPattern.test(project)) ||
      (id !== null && (!suitePattern.test(id) || id.length > MAX_SUITE_ID))) {
    return fail(400, "Choose one valid workspace, project and suite.");
  }
  // A scope is a prefix chain: a project needs a workspace, a suite needs both.
  if (project !== null && workspace === null) return fail(400, "Choose an owned workspace first.");
  if (id !== null && project === null) return fail(400, "Choose a project before a suite.");

  const reading = request.method === "GET";
  if (!reading && request.headers.get("Origin") !== url.origin)
    return fail(403, "Open this action from App Composer.");
  if (!reading && workspace === null) return fail(400, "Choose an owned workspace.");
  if (!reading && project === null) return fail(400, "Choose an active project.");
  if (request.method === "DELETE" && id === null) return fail(400, "Choose a suite to delete.");
  if (request.method === "POST" && id !== null)
    return fail(400, "Upload a suite without a suite identifier.");

  try {
    if (!workspace) return reply({ ok: true, workspaces: await listPrivateBenchmarkWorkspaces(db, ownerId) });
    if (!(await isPrivateBenchmarkOwner(db, ownerId, workspace)))
      return fail(403, "Choose a workspace you currently own.");

    if (!project)
      return reply({ ok: true, projects: await listPrivateBenchmarkSuiteProjects(db, ownerId, workspace) });

    const scope: PrivateBenchmarkSuiteScope = { workspaceId: workspace, projectId: project, ownerId };
    if (!(await isPrivateBenchmarkSuiteProject(db, scope)))
      return fail(403, "Choose an active project in that workspace.");

    if (reading && !id) return reply({ ok: true, suites: await listPrivateBenchmarkSuites(db, scope) });
    if (reading && id) {
      const suite = await getPrivateBenchmarkSuite(db, scope, id);
      return suite ? reply({ ok: true, suite }) : fail(404, "Saved suite not found.");
    }
    if (request.method === "DELETE") {
      return (await deletePrivateBenchmarkSuite(db, scope, id as string))
        ? reply({ ok: true }) : fail(404, "Saved suite not found.");
    }

    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return fail(415, "Upload a native benchmark suite JSON definition.");
    const input = await readBoundedJsonBody(request, MAX_PRIVATE_BENCHMARK_SUITE_BYTES, {
      tooLarge: "That suite definition is too large.",
      missing: "Send one JSON object.",
      unreadable: "The suite definition could not be read.",
      invalid: "Send one valid JSON suite definition.",
    });
    if (!input.ok) return fail(input.status, input.error);

    const { ok, summary } = validateBenchmarkSuite(input.value);
    if (!ok || !summary) return fail(400, "Choose a valid native benchmark suite definition.");

    const checks = summary.checks as { module: string; id: string }[];
    if (checks.length === 0 || checks.length > MAX_SUITE_CHECKS)
      return fail(400, "Choose between one and 100 supported checks.");
    const known = new Set<string>();
    for (const entry of benchmarkSuiteCatalogue()) {
      for (const check of entry.summary.checks) known.add(`${check.module}::${check.id}`);
    }
    if (checks.some((check) => !known.has(`${check.module}::${check.id}`)))
      return fail(400, "That suite uses a check outside the supported catalogue.");

    const suite = await savePrivateBenchmarkSuite(db, scope, input.value as PrivateBenchmarkSuiteDefinition);
    return suite
      ? reply({ ok: true, suite })
      : fail(409, "Choose an unused suite ID, or remove a saved definition if this project already has 20.");
  } catch (error) {
    if (error instanceof RangeError && request.method === "POST")
      return fail(413, "That suite definition is too large.");
    return fail(503, "Private benchmark suites are unavailable.");
  }
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
