// An opt-in local availability exercise, not a general responder or cloud runner.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { appendFile, readFile, realpath, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { createIntegrationAdapter } from "../../lib/platform/integration-adapter.mjs";
import { nativeCall, nativeData } from "./native-auth.mjs";

const origin = "https://composer.loftwah.com";
const stacks = "/_emdash/api/plugins/composer-stacks/";
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const id = /^[a-z0-9-]{6,64}$/;
const escaped = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const check = (value, message) => {
  if (!value) throw Error(message);
};

// Host-owned files and fixed service bindings establish admission. Public alias
// names alone are insufficient: these aliases also exist outside the local lab.
export async function assertOwnedAvailabilityLab(lab, ownedRoot) {
  const root = await realpath(ownedRoot),
    inner = await realpath(lab.root);
  check(
    inner.startsWith(root + sep),
    "Availability faults require the one owned local root.",
  );
  const config = JSON.parse(
    await readFile(join(inner, "composer/wrangler.local.jsonc"), "utf8"),
  );
  check(
    config.name === "composer-invited-composer" &&
      config.main === "./lab-entry.ts" &&
      config.workers_dev === false &&
      config.preview_urls === false &&
      Array.isArray(config.routes) &&
      config.routes.length === 0 &&
      config.vars.RESOURCE_ENVIRONMENT === "local" &&
      config.vars.RESOURCE_ACCOUNT_ID === "00000000000000000000000000000001" &&
      lab.origins.composer === origin,
    "Availability faults cannot select a production deployment.",
  );
  const expected = [
    { binding: "GUESTBOOK", service: "composer-invited-guestbook" },
    {
      binding: "GUESTBOOK_MEMBERS",
      service: "composer-invited-guestbook",
      entrypoint: "GuestbookMemberService",
    },
    { binding: "SHOWCASE", service: "composer-invited-showcase" },
    { binding: "PLATFORM_PUBLIC_PAGES", service: "composer-invited-composer" },
  ];
  check(
    JSON.stringify(config.services) === JSON.stringify(expected),
    "Availability faults require exact local service bindings.",
  );
  for (const name of ["composer", "guestbook", "showcase"]) {
    const filename = await realpath(join(inner, name, "wrangler.local.jsonc"));
    check(
      filename.startsWith(inner + sep),
      "A local configuration escaped its owned root.",
    );
    const selected = JSON.parse(await readFile(filename, "utf8"));
    check(
      selected.name === "composer-invited-" + name &&
        selected.routes.length === 0 &&
        selected.workers_dev === false &&
        selected.preview_urls === false,
      "An app configuration escaped the isolated lifecycle.",
    );
    for (const binding of [
      ...(selected.d1_databases ?? []),
      ...(selected.r2_buckets ?? []),
      ...(selected.kv_namespaces ?? []),
      ...(selected.services ?? []),
    ])
      check(
        binding.remote !== true,
        "Remote bindings cannot be used by the availability fixture.",
      );
    if (name === "guestbook")
      check(
        selected.vars.RESOURCE_ENVIRONMENT === "local" &&
          selected.vars.RESOURCE_ACCOUNT_ID ===
            config.vars.RESOURCE_ACCOUNT_ID &&
          selected.main === "./local-entry.ts",
        "The independent Guestbook target is not local.",
      );
  }
  for (const name of ["composer", "guestbook", "showcase"])
    check(
      /^[a-f0-9]{40}$/.test(lab.sources?.[name]?.head),
      "Select exact local source identities.",
    );
  return {
    account: config.vars.RESOURCE_ACCOUNT_ID,
    environment: "local",
    target: origin + "/guestbook",
  };
}

// Three separate samples, with no retry/reset loop that could conceal flapping.
export async function stableAvailability(sample, { intervalMs = 1000 } = {}) {
  check(
    Number.isInteger(intervalMs) && intervalMs >= 1 && intervalMs <= 2000,
    "Choose a bounded stability interval.",
  );
  const started = performance.now(),
    observations = [];
  for (let index = 0; index < 3; index++) {
    const observation = await sample();
    check(
      observation.healthy === true,
      "Independent availability verification failed or flapped; incident stays active.",
    );
    observations.push(observation);
    if (index < 2)
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return {
    count: observations.length,
    intervalMs,
    spanMs: performance.now() - started,
    observations,
  };
}

// The reviewed app emits a fresh 16-byte CSP nonce per HTML response. Preserve
// every other byte for the control comparison; never erase arbitrary content.
export function controlHTMLDigest(text) {
  check(
    typeof text === "string" && text.length <= 500000,
    "Expected bounded control HTML.",
  );
  const values = [];
  const canonical = text.replace(
    /(<script\b[^>]*\bnonce=")([A-Za-z0-9+/]{22}==)(")/g,
    (_match, before, value, after) => {
      values.push(value);
      return before + "[generated-csp-nonce]" + after;
    },
  );
  check(
    values.length >= 3 && values.length <= 16 && new Set(values).size === 1,
    "The reviewed control HTML nonce contract changed.",
  );
  return hash(canonical);
}

async function receiver(ownedRoot) {
  const token = randomUUID(),
    log = join(ownedRoot, "availability-receiver.ndjson");
  let received = 0;
  const server = createServer(async (request, response) => {
    try {
      check(++received <= 3, "The local receiver event budget was exceeded.");
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 8192)
          throw Error("Bounded local receiver payload exceeded.");
        chunks.push(chunk);
      }
      check(
        request.method === "POST" &&
          ["/v2/change/enqueue", "/v2/enqueue"].includes(request.url),
        "Unsupported local event endpoint.",
      );
      const { routing_key, ...body } = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      check(routing_key === token, "Wrong local receiver key.");
      await appendFile(
        log,
        JSON.stringify({ endpoint: request.url, ...body }) + "\n",
        { mode: 0o600 },
      );
      response.writeHead(202, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          status: "success",
          ...(body.dedup_key
            ? { dedup_key: body.dedup_key }
            : { id: "local-availability-change" }),
        }),
      );
    } catch {
      response.writeHead(400);
      response.end();
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.timeout = 5000;
  const close = async () => {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  };
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    return {
      adapter: createIntegrationAdapter({
        allowLoopbackFixture: true,
        destinations: {
          change: { url: base + "/v2/change/enqueue", token },
          incident: { url: base + "/v2/enqueue", token },
        },
      }),
      records: async () => {
        try {
          return (await readFile(log, "utf8"))
            .trim()
            .split("\n")
            .filter(Boolean)
            .map(JSON.parse);
        } catch (error) {
          if (error.code === "ENOENT") return [];
          throw error;
        }
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runLocalAvailabilityExercise({
  owner,
  publicPage,
  lab,
  ownedRoot,
  output,
  teamA,
  teamB,
  expectedMediaSha,
  readPublic,
  capture,
}) {
  const target = await assertOwnedAvailabilityLab(lab, ownedRoot);
  check(
    teamA.workspace !== teamB.workspace &&
      teamA.stack !== teamB.stack &&
      teamA.resource !== teamB.resource,
    "Select two distinct local services.",
  );
  for (const scope of [teamA, teamB])
    for (const key of ["workspace", "stack", "request", "resource", "instance"])
      check(
        id.test(scope[key]),
        "Select exact retained local service identities.",
      );
  check(
    /^[a-f0-9]{64}$/.test(expectedMediaSha),
    "Select the existing independently checked PNG digest.",
  );
  const runId = randomUUID(),
    started = performance.now();
  const report = {
    schema: "composer.local-availability/1",
    classification: "local-workerd-fixture",
    runId,
    startedAt: new Date().toISOString(),
    status: "not-run",
    incidentSync: "not-sent",
    sources: Object.fromEntries(
      Object.entries(lab.sources).map(([name, source]) => [name, source.head]),
    ),
    target,
    actions: [],
    timeline: [],
    events: {},
    limits: [
      "Deliberate resource visibility fault and deterministic control recovery only; no agent diagnosis, code rollback, data restoration or full #215 completion.",
      "PagerDuty-shaped local receiver only; no vendor account, incident, escalation or notification.",
      "Three local samples establish only the declared short observation window; no continuous monitoring or enterprise reliability claim.",
    ],
  };
  const note = (event) =>
    report.timeline.push({
      event,
      at: new Date().toISOString(),
      elapsedMs: performance.now() - started,
    });
  const call = async (path, body) =>
    nativeData(await nativeCall(owner.page, path, body));
  const read = (action, query) =>
    call(stacks + action + "?" + new URLSearchParams(query));
  async function state(scope) {
    const listed = await read("platformRead", {
      action: "list",
      workspace: scope.workspace,
    });
    const request = listed.requests.find((entry) => entry.id === scope.request);
    check(
      listed.workspace.role === "owner" &&
        listed.profile?.enabled &&
        request?.status === "complete" &&
        request.stackId === scope.stack,
      "Current owner, enabled policy and completed request are required.",
    );
    const stack = (
      await read("read", {
        action: "open",
        workspace: scope.workspace,
        stack: scope.stack,
      })
    ).stack;
    const resources = (
      await read("read", {
        action: "resources",
        workspace: scope.workspace,
        stack: scope.stack,
      })
    ).resources;
    const resource = resources.find(
      (entry) => entry.instance === scope.instance,
    );
    check(
      resource?.resource === scope.resource &&
        resource.state === "ready" &&
        !resource.shared &&
        resource.configuration &&
        stack.status === "published",
      "Select a ready, exclusively owned published resource.",
    );
    const book = (
      await read("read", {
        action: "resourceContent",
        workspace: scope.workspace,
        stack: scope.stack,
        instance: scope.instance,
        expectedRevision: String(stack.revision),
      })
    ).book;
    check(
      book.resource === scope.resource &&
        book.instance === scope.instance &&
        !book.shared &&
        /^Fictional /.test(stack.name),
      "The actual local resource selection changed.",
    );
    check(
      request.plan.target.account === target.account &&
        request.plan.target.environment === target.environment &&
        request.plan.target.url === target.target &&
        request.plan.source.commit === lab.sources.guestbook.head,
      "The current request targets another runtime or source.",
    );
    return { scope, request, policy: listed.profile, stack, resource, book };
  }
  const invariant = (current) => ({
    scope: current.scope,
    request: current.request.id,
    planDigest: current.request.planDigest,
    policyRevision: current.policy.revision,
    planPolicyRevision: current.request.plan.policyRevision,
    publishedRevision: current.stack.publishedRevision,
    draft: hash(current.stack.draft),
    publication: hash(current.stack.published),
    configuration: current.resource.configuration,
    items: hash(current.book.items),
  });
  let sink;
  try {
    const actor = await call("/_emdash/api/auth/me");
    check(
      actor.id === owner.user.id && actor.role === 50,
      "The local fixture requires its actual native operator session.",
    );
    const baseline = await state(teamA),
      control = await state(teamB);
    check(
      baseline.book.visible &&
        !baseline.book.paused &&
        !baseline.book.pending &&
        !control.book.pending,
      "Record a public, unpaused baseline with no unfinished operations.",
    );
    check(
      /^[a-f0-9]{64}$/.test(baseline.request.planDigest) &&
        baseline.request.plan.policyRevision === baseline.policy.revision &&
        baseline.resource.configuration.source === lab.sources.guestbook.head,
      "A fresh exact plan, policy and configuration source are required.",
    );
    const retained = invariant(baseline),
      controlDigest = hash(control);
    const approved = baseline.book.items.find(
      (item) => item.status === "approved" && item.synthetic === true,
    );
    check(
      approved,
      "The existing native synthetic contribution must be approved before this exercise.",
    );
    const privateItems = baseline.book.items
      .filter((item) => item.status !== "approved")
      .slice(0, 8);
    report.correlation = {
      workspace: teamA.workspace,
      request: teamA.request,
      stack: teamA.stack,
      instance: teamA.instance,
      resource: teamA.resource,
      planDigest: baseline.request.planDigest,
      policyRevision: baseline.policy.revision,
      configurationDigest: baseline.resource.configuration.digest,
      configurationRevision: baseline.resource.configuration.revision,
      appSource: baseline.resource.configuration.source,
      publication: `${teamA.stack}:${baseline.stack.publishedRevision}`,
      item: approved.id,
      privateItemsChecked: privateItems.length,
    };
    const localRead = async (path, limit = 500000) => {
      const value = await readPublic(publicPage, path, limit);
      check(
        value.localBridge === true,
        "Availability verification did not reach the owned local TLS bridge.",
      );
      return value;
    };
    const identityHealth = async () => {
      const health = await localRead("/guestbook/healthz", 32768);
      const body = JSON.parse(health.text);
      check(
        health.status === 200 &&
          body.app === "guestbook" &&
          body.revision === lab.sources.guestbook.head &&
          body.check === "liveness",
        "The shallow health source is not the selected local app.",
      );
      return { status: health.status, sha256: health.sha256 };
    };
    const mediaDigest = expectedMediaSha;
    async function observation(publicStatus = 200) {
      const health = await identityHealth();
      const path = baseline.resource.configuration.path;
      check(
        path ===
          `/guestbook/r/${teamA.resource}/c/${baseline.resource.configuration.revision}/`,
        "The public route is outside the selected resource.",
      );
      const html = await localRead(path),
        media = await localRead(
          `/guestbook/r/${teamA.resource}/media/${approved.id}`,
          150000,
        );
      let healthy =
        html.status === publicStatus && media.status === publicStatus;
      if (publicStatus === 200) {
        healthy &&=
          html.contentType?.includes("text/html") &&
          html.text?.includes('data-app="guestbook"') &&
          html.text?.includes(
            "<h1>" + escaped(baseline.stack.name) + "</h1>",
          ) &&
          html.text?.includes('rel="canonical" href="' + origin + path + '"') &&
          media.contentType?.startsWith("image/png");
        healthy &&= media.sha256 === mediaDigest;
      }
      return {
        healthy: Boolean(healthy),
        health,
        html: { status: html.status, sha256: html.sha256 },
        media: { status: media.status, sha256: media.sha256 },
        observedAt: new Date().toISOString(),
      };
    }
    const before = await observation();
    check(before.healthy, "The baseline user journey is not healthy.");
    report.baseline = before;
    const controlPublic = await localRead(control.resource.configuration.path);
    check(
      controlPublic.status === 200 &&
        controlPublic.contentType?.includes("text/html") &&
        controlPublic.text?.includes(
          "<h1>" + escaped(control.stack.name) + "</h1>",
        ),
      "The independent control team is not publicly available.",
    );
    report.controlBaseline = {
      status: controlPublic.status,
      sha256: controlPublic.sha256,
      semanticSha256: controlHTMLDigest(controlPublic.text),
    };
    note("baseline-verified");
    sink = await receiver(ownedRoot);
    const incidentId = "availability-" + runId;
    const payload = (operationId, outcome, summary) => ({
      operationId,
      appId: teamA.resource,
      teamId: teamA.workspace,
      environment: target.environment,
      sourceSha: lab.sources.guestbook.head,
      releaseId: report.correlation.publication,
      planDigest: retained.planDigest,
      policyRevision: String(retained.policyRevision),
      outcome,
      summary,
    });
    async function fresh() {
      const current = await state(teamA);
      assert.deepEqual(
        invariant(current),
        retained,
        "The current policy, source, configuration, publication or content changed; recovery is blocked.",
      );
      assert.equal(
        hash(await state(teamB)),
        controlDigest,
        "The control team changed; recovery is blocked.",
      );
      return current;
    }
    async function change(visible, current, phase) {
      check(
        !current.book.pending,
        "Reconcile the existing operation before another control mutation.",
      );
      const operationId = randomUUID();
      const selection = {
        workspace: teamA.workspace,
        stack: teamA.stack,
        instance: teamA.instance,
        expectedRevision: current.stack.revision,
      };
      const action = {
        phase,
        operationId,
        beforeVersion: current.book.version,
        outcome: "dispatching",
      };
      report.actions.push(action);
      note(phase + ":dispatch");
      let response = await call(stacks + "write", {
        action: "moderateResource",
        ...selection,
        change: {
          command: "control",
          operationId,
          resource: teamA.resource,
          expectedVersion: current.book.version,
          visible,
          paused: baseline.book.paused,
        },
      });
      action.outcome = response.outcome;
      if (response.outcome === "unknown") {
        note(phase + ":unknown-reconcile-read");
        const stack = (
          await read("read", {
            action: "open",
            workspace: teamA.workspace,
            stack: teamA.stack,
          })
        ).stack;
        response = await call(stacks + "write", {
          action: "reconcileResourceContent",
          ...selection,
          expectedRevision: stack.revision,
        });
        action.reconciled = response.outcome;
      }
      check(
        response.outcome === "applied" || response.outcome === "unchanged",
        "The control outcome is unconfirmed; no automatic retry or replacement operation is permitted.",
      );
      const actual = await fresh();
      check(
        actual.book.version === current.book.version + 1 &&
          actual.book.visible === visible &&
          actual.book.paused === baseline.book.paused &&
          !actual.book.pending,
        "The control operation did not confirm the exact compatible transition.",
      );
      action.outcome = "confirmed";
      action.afterVersion = actual.book.version;
      note(phase + ":confirmed");
      return actual;
    }
    const fault = await change(false, await fresh(), "fault");
    report.events.change = await sink.adapter.deliverChange(
      payload(
        report.actions[0].operationId,
        "control-changed",
        "Fictional isolated resource visibility changed; no code deployment.",
      ),
    );
    const failed = await observation(404);
    check(
      failed.healthy,
      "The actual resource journey did not fail while shallow health stayed 200.",
    );
    report.failure = failed;
    note("journey-failure-detected");
    report.events.trigger = await sink.adapter.deliverIncident({
      ...payload(
        report.actions[0].operationId,
        "failed",
        "Fictional isolated public visitor book is unavailable; shallow health remains 200.",
      ),
      incidentId,
      action: "trigger",
    });
    await publicPage.goto(origin + baseline.resource.configuration.path);
    await capture(publicPage, "availability-team-a-failed");
    const beforeRecovery = await fresh();
    check(
      beforeRecovery.book.visible === false &&
        beforeRecovery.book.version === fault.book.version,
      "Another actor changed the fault state; do not restore stale controls.",
    );
    await change(baseline.book.visible, beforeRecovery, "recovery");
    report.stability = await stableAvailability(() => observation());
    const admission = await localRead(
      `/guestbook/r/${teamA.resource}/api/invitation`,
      32768,
    );
    check(
      admission.status === 200 &&
        JSON.parse(admission.text).invitation.accepts === false,
      "Recovery opened public contributions.",
    );
    const privateAPI = await localRead(
      `/guestbook/api/resources/${teamA.resource}`,
      32768,
    );
    check(
      [401, 403].includes(privateAPI.status),
      "Recovery exposed the owner API to an anonymous visitor.",
    );
    const crossTeamMedia = await localRead(
      `/guestbook/r/${teamB.resource}/media/${approved.id}`,
      150000,
    );
    check(
      crossTeamMedia.status === 404,
      "Recovery exposed another team's media.",
    );
    for (const item of privateItems)
      check(
        (
          await localRead(
            `/guestbook/r/${teamA.resource}/media/${item.id}`,
            150000,
          )
        ).status === 404,
        "Recovery revived private media.",
      );
    await fresh();
    const controlAfter = await localRead(control.resource.configuration.path);
    check(
      controlAfter.status === 200 &&
        controlHTMLDigest(controlAfter.text) ===
          report.controlBaseline.semanticSha256,
      "The independent control team's public response changed.",
    );
    report.privacy = {
      publicContributionsClosed: true,
      ownerAPI: privateAPI.status,
      crossTeamMedia: 404,
      retainedPrivateItemsChecked: privateItems.length,
    };
    report.teamBUnchanged = true;
    report.controlAfter = {
      status: controlAfter.status,
      sha256: controlAfter.sha256,
      semanticSha256: controlHTMLDigest(controlAfter.text),
    };
    note("recovery-independently-verified");
    await publicPage.goto(origin + baseline.resource.configuration.path);
    await capture(publicPage, "availability-team-a-recovered");
    report.status = "recovered";
    if (report.events.trigger.status === "accepted") {
      report.events.resolve = await sink.adapter.deliverIncident({
        ...payload(
          report.actions[1].operationId,
          "recovered",
          "Fictional isolated journey passed three independent samples and privacy/control checks.",
        ),
        incidentId,
        action: "resolve",
      });
      report.incidentSync =
        report.events.resolve.status === "accepted"
          ? "local-receiver-accepted"
          : "unknown";
    } else report.incidentSync = "trigger-unconfirmed-resolve-not-sent";
    note("exercise-finished");
  } catch (error) {
    for (const action of report.actions)
      if (action.outcome === "dispatching") action.outcome = "unknown";
    report.status = report.actions.some(
      (action) => action.outcome === "unknown",
    )
      ? "unknown-outcome"
      : "blocked";
    report.failureReason = String(error.message)
      .replace(/https?:\/\/[^\s]+/g, "[endpoint]")
      .slice(0, 1200);
    note("exercise-stopped-without-more-effects");
  } finally {
    try {
      if (sink) report.received = await sink.records();
    } catch {
      report.receiverEvidence = "read-failed";
      report.status = "evidence-incomplete";
    } finally {
      try {
        await sink?.close();
        report.receiverClosed = true;
      } catch {
        report.receiverClosed = false;
        report.status = "cleanup-incomplete";
      }
    }
    report.completedAt = new Date().toISOString();
    report.durationMs = performance.now() - started;
    const filename = `availability-${runId}.json`;
    report.receipt = filename;
    await writeFile(
      join(output, filename),
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  }
  return report;
}
