import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import {
  deletePrivateBenchmarkRun,
  getPrivateBenchmarkRun,
  isPrivateBenchmarkOwner,
  listPrivateBenchmarkRuns,
  listPrivateBenchmarkWorkspaces,
  savePrivateBenchmarkRun,
} from "../../../lib/benchmark-private-runs.ts";
import { parseLocalBenchmarkResult } from "../../../lib/benchmark-local-result.ts";
import { MAX_LOCAL_BENCHMARK_BYTES } from "../../../lib/benchmark-local-retention.ts";
import { readBoundedJsonBody } from "../../../lib/benchmark-body.ts";

export const prerender = false;

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
const fail = (status: number, error: string) => reply({ ok: false, error }, status);
const workspacePattern = /^[a-z0-9-]{6,64}$/;
const runPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

const handle: APIRoute = async ({ request, locals }) => {
  const ownerId = locals.user?.id;
  if (!ownerId) return fail(401, "Sign in to open your private benchmark runs.");

  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return fail(503, "Private benchmark runs are unavailable.");

  const url = new URL(request.url);
  const { searchParams } = url;
  const workspace = searchParams.get("workspace");
  const id = searchParams.get("id");
  if (Array.from(searchParams.keys()).some(key =>
    (key !== "workspace" && key !== "id") || searchParams.getAll(key).length !== 1
  ) || (workspace !== null && !workspacePattern.test(workspace)) || (id !== null && !runPattern.test(id))) {
    return fail(400, "Choose one valid workspace and saved run.");
  }
  const reading = request.method === "GET";
  if (!reading && request.headers.get("Origin") !== url.origin)
    return fail(403, "Open this action from App Composer.");
  if (!workspace && (!reading || id))
    return fail(400, "Choose an owned workspace.");

  try {
    if (!workspace) return reply({ ok: true, workspaces: await listPrivateBenchmarkWorkspaces(db, ownerId) });
    if (!(await isPrivateBenchmarkOwner(db, ownerId, workspace)))
      return fail(403, "Choose a workspace you currently own.");

    if (reading && !id) {
      return reply({ ok: true, runs: await listPrivateBenchmarkRuns(db, ownerId, workspace) });
    }
    if (reading && id) {
      const run = await getPrivateBenchmarkRun(db, ownerId, workspace, id);
      return run ? reply({ ok: true, run }) : fail(404, "Saved run not found.");
    }
    if (request.method === "DELETE") {
      if (!id) return fail(400, "Choose a saved run to delete.");
      return (await deletePrivateBenchmarkRun(db, ownerId, workspace, id))
        ? reply({ ok: true }) : fail(404, "Saved run not found.");
    }
    if (id) return fail(400, "Upload a native report without a run identifier.");
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return fail(415, "Upload a native benchmark JSON report.");

    const input = await readBoundedJsonBody(request, MAX_LOCAL_BENCHMARK_BYTES, {
      tooLarge: "That report is too large.",
      missing: "Send one JSON object.",
      unreadable: "The report could not be read.",
      invalid: "Send one valid JSON report.",
    });
    if (!input.ok) return fail(input.status, input.error);
    let parsed: ReturnType<typeof parseLocalBenchmarkResult>;
    try {
      parsed = parseLocalBenchmarkResult(input.value);
    } catch {
      return fail(400, "Choose a JSON report from the benchmark runner.");
    }
    const { source, generatedAt, suites, packId } = parsed;
    const run = await savePrivateBenchmarkRun(db, ownerId, workspace, {
      source, generatedAt, suites, ...(packId ? { pack: { id: packId } } : {}),
    });
    return run ? reply({ ok: true, run }) : fail(409, "This workspace could not keep another private run. Delete one if your history is full.");
  } catch (error) {
    if (error instanceof RangeError && request.method === "POST") return fail(413, "That report is too large.");
    return fail(503, "Private benchmark runs are unavailable.");
  }
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
