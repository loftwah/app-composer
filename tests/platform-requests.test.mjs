import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser, readStack, saveStack } from "../src/lib/stacks.mjs";
import {
  managePlatform,
  runPlatformRequest,
} from "../src/lib/platform-admin.ts";
import {
  platformRequest,
  platformPlan,
  platformDigest,
} from "../src/lib/platform-contract.ts";

const profile = {
  enabled: true,
  reviewRequired: false,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
};
const request = (patch = {}) => ({
  version: 1,
  name: "Fictional Atlas",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
  ...patch,
});
function setup() {
  const f = fixture();
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  if (
    !f.sqlite
      .prepare(
        "SELECT name FROM sqlite_schema WHERE name='creator_platform_profiles'",
      )
      .get()
  )
    f.sqlite.exec(
      readFileSync("migrations/0011_platform_requests.sql", "utf8"),
    );
  const service = f.runtime.GUESTBOOK;
  f.runtime.GUESTBOOK = {
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (/^\/guestbook\/r\/[a-z0-9-]+\/c\/\d+\/$/.test(path))
        return Promise.resolve(
          new Response(
            "<!doctype html><title>Fictional team guestbook</title>",
            { headers: { "Content-Type": "text/html" } },
          ),
        );
      return service.fetch(req);
    },
  };
  const call = (input, actor = user, reading = false, headers = {}) =>
    managePlatform(
      {
        user: actor,
        input,
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/platform" +
            (reading ? "Read" : "Write"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
          },
        ),
      },
      f.runtime,
    );
  return { ...f, call };
}
async function enabled(f, actor = user, patch = {}) {
  const w = await workspaceForUser(f.db, actor);
  const r = await f.call(
    {
      action: "configure",
      workspace: w.id,
      expectedRevision: 0,
      profile: { ...profile, ...patch },
    },
    actor,
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  return w;
}

test("platform plan uses the existing v2 validator and complete settings; grants and shell are excluded", async () => {
  const r = platformRequest.parse(request()),
    p = platformPlan(r, null, {
      account: "fixture-account",
      environment: "production",
      url: origin + "/guestbook",
    });
  assert.equal(p.spec.version, 2);
  assert.equal(p.spec.appSettings.guestbook.guestAccess, "closed");
  assert.equal(
    await platformDigest(p),
    await platformDigest(structuredClone(p)),
  );
  assert.throws(() =>
    platformRequest.parse({ ...r, owner: user.id, command: "rm -rf /" }),
  );
});
test("standing policy makes one service automatically, duplicate submissions preserve all operation/resource identities", async () => {
  const f = setup();
  try {
    const w = await enabled(f),
      key = crypto.randomUUID();
    const r = await f.call({
      action: "submit",
      workspace: w.id,
      key,
      request: request(),
    });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(
      r.requests[0].status,
      "complete",
      JSON.stringify(r.requests[0]),
    );
    assert.equal(r.requests[0].decision.outcome, "allowed");
    assert.match(r.requests[0].url, /^\/s\/team-/);
    const n = f.app.writes.length;
    const repeat = await f.call({
      action: "submit",
      workspace: w.id,
      key,
      request: request(),
    });
    assert.equal(repeat.requests[0].id, r.requests[0].id);
    assert.equal(f.app.resources.size, 1);
    assert.equal(f.app.writes.length, n);
    assert.equal(
      (
        await f.call({
          action: "submit",
          workspace: w.id,
          key,
          request: request({ name: "Changed bytes" }),
        })
      ).code,
      "CONFLICT",
    );
  } finally {
    f.close();
  }
});
test("unsupported residency and forbidden data class make no service effects; quota reserves atomically", async () => {
  const f = setup();
  try {
    const w = await enabled(f, user, { maxApplications: 1 });
    const unsupported = await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request({ location: "australia-only" }),
    });
    assert.equal(unsupported.requests[0].decision.outcome, "unsupported");
    assert.equal(f.app.writes.length, 0);
    const denied = await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request({ dataClass: "sensitive" }),
    });
    assert.ok(denied.requests.some((r) => r.decision.outcome === "denied"));
    assert.equal(f.app.writes.length, 0);
    await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request(),
    });
    const full = await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request({ name: "Over quota" }),
    });
    assert.ok(
      full.requests
        .find((r) => r.name === "Over quota")
        .decision.reasons.some((x) => x.includes("quota")),
    );
    assert.equal(f.app.resources.size, 1);
  } finally {
    f.close();
  }
});
test("two independently authorised workspaces deny cross-team requests and direct lifecycle bypass", async () => {
  const f = setup();
  try {
    const a = await enabled(f),
      other = { ...user, id: "fictional-other-team-0002" },
      b = await enabled(f, other);
    const ra = await f.call({
        action: "submit",
        workspace: a.id,
        key: crypto.randomUUID(),
        request: request(),
      }),
      rb = await f.call(
        {
          action: "submit",
          workspace: b.id,
          key: crypto.randomUUID(),
          request: request({ name: "Fictional Beacon" }),
        },
        other,
      );
    assert.equal(ra.requests[0].status, "complete");
    assert.equal(rb.requests[0].status, "complete");
    assert.notEqual(
      ra.requests[0].resources[0].resource,
      rb.requests[0].resources[0].resource,
    );
    assert.equal(
      (await f.call({ action: "list", workspace: a.id }, other, true)).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(
          {
            action: "run",
            workspace: b.id,
            id: ra.requests[0].id,
            expectedRevision: 1,
          },
          other,
        )
      ).code,
      "NOT_FOUND",
    );
    assert.equal(
      (await f.route({ action: "create", workspace: a.id, name: "Bypass" }))
        .code,
      "FORBIDDEN",
    );
    assert.equal(f.app.resources.size, 2);
  } finally {
    f.close();
  }
});
test("unavailable runner remains pending; a revoked requester and changed policy stop resumption", async () => {
  const f = setup();
  try {
    const w = await enabled(f),
      service = f.runtime.GUESTBOOK;
    delete f.runtime.GUESTBOOK;
    const r = await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request(),
    });
    assert.equal(r.requests[0].status, "waiting");
    assert.equal(r.runner.available, false);
    assert.equal(f.app.writes.length, 0);
    f.runtime.GUESTBOOK = service;
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(w.id, user.id);
    assert.equal(
      (
        await f.call({
          action: "run",
          workspace: w.id,
          id: r.requests[0].id,
          expectedRevision: r.requests[0].revision,
        })
      ).code,
      "FORBIDDEN",
    );
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='owner' WHERE workspace_id=? AND user_id=?",
      )
      .run(w.id, user.id);
    await f.call({
      action: "configure",
      workspace: w.id,
      expectedRevision: 1,
      profile: { ...profile, enabled: false },
    });
    const run = await f.call({
      action: "run",
      workspace: w.id,
      id: r.requests[0].id,
      expectedRevision: r.requests[0].revision,
    });
    assert.equal(run.requests[0].status, "needs-attention");
    assert.equal(f.app.writes.length, 0);
  } finally {
    f.close();
  }
});
test("review send-back produces revised digest; self-approval and stale approval never execute", async () => {
  const f = setup();
  try {
    const w = await enabled(f, user, { reviewRequired: true });
    const owner2 = { ...user, id: "fictional-reviewer-0002" };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
      )
      .run(w.id, owner2.id);
    const r = await f.call({
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request: request(),
      }),
      p = r.requests[0];
    assert.equal(p.status, "waiting");
    assert.equal(p.decision.outcome, "requires-approval");
    assert.equal(
      (
        await f.call({
          action: "review",
          workspace: w.id,
          id: p.id,
          expectedRevision: p.revision,
          decision: "accept",
          reason: "self",
        })
      ).code,
      "FORBIDDEN",
    );
    const sent = await f.call(
      {
        action: "review",
        workspace: w.id,
        id: p.id,
        expectedRevision: p.revision,
        decision: "send-back",
        reason: "Clarify name",
      },
      owner2,
    );
    const changed = await f.call({
      action: "revise",
      workspace: w.id,
      id: p.id,
      expectedRevision: sent.requests[0].revision,
      request: request({ name: "Revised Atlas" }),
    });
    assert.notEqual(changed.requests[0].planDigest, p.planDigest);
    const service = f.runtime.GUESTBOOK;
    delete f.runtime.GUESTBOOK;
    const accepted = await f.call(
      {
        action: "review",
        workspace: w.id,
        id: p.id,
        expectedRevision: changed.requests[0].revision,
        decision: "accept",
        reason: "Approved exact plan",
      },
      owner2,
    );
    f.sqlite
      .prepare(
        "UPDATE creator_platform_requests SET approval_expires=0 WHERE id=?",
      )
      .run(p.id);
    f.runtime.GUESTBOOK = service;
    const refused = await f.call({
      action: "run",
      workspace: w.id,
      id: p.id,
      expectedRevision: accepted.requests[0].revision,
    });
    assert.equal(refused.requests[0].status, "needs-attention");
    assert.equal(f.app.writes.length, 0);
  } finally {
    f.close();
  }
});
test("unknown acknowledgement resumes through existing journal without duplicate resource", async () => {
  const f = setup();
  try {
    const w = await enabled(f);
    let failed = false;
    f.app.afterWrite(({ command }) => {
      if (command.action === "activate" && !failed) {
        failed = true;
        throw Error("lost acknowledgement");
      }
    });
    const r = await f.call({
      action: "submit",
      workspace: w.id,
      key: crypto.randomUUID(),
      request: request(),
    });
    assert.equal(r.requests[0].status, "needs-attention");
    const before = f.app.writes.length;
    f.app.afterWrite(null);
    const done = await f.call({
      action: "run",
      workspace: w.id,
      id: r.requests[0].id,
      expectedRevision: r.requests[0].revision,
    });
    assert.equal(
      done.requests[0].status,
      "complete",
      JSON.stringify(done.requests[0]),
    );
    assert.equal(f.app.resources.size, 1);
    assert.equal(f.app.writes.length, before);
  } finally {
    f.close();
  }
});
test("request origin, native admission and imported grants fail closed", async () => {
  const f = setup();
  try {
    const w = await enabled(f);
    assert.equal(
      (
        await f.call(
          { action: "list", workspace: w.id },
          { ...user, role: 10 },
          true,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(
          {
            action: "submit",
            workspace: w.id,
            key: crypto.randomUUID(),
            request: request(),
          },
          user,
          false,
          { Origin: "https://evil.example" },
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call({
          action: "submit",
          workspace: w.id,
          key: crypto.randomUUID(),
          request: request(),
          owner: user.id,
        })
      ).code,
      "INVALID",
    );
    assert.equal(f.app.writes.length, 0);
  } finally {
    f.close();
  }
});

test("a meaningful supported update re-evaluates policy, retains resource identity and preserves publication history", async () => {
  const f = setup();
  try {
    const w = await enabled(f);
    const made = await f.call({
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request: request(),
      }),
      first = made.requests[0];
    const changed = await f.call({
      action: "update",
      workspace: w.id,
      id: first.id,
      expectedRevision: first.revision,
      request: request({ name: "Fictional Atlas updated" }),
    });
    assert.equal(changed.ok, true, JSON.stringify(changed));
    const updated = changed.requests[0];
    assert.equal(updated.status, "complete", updated.reason);
    assert.equal(updated.name, "Fictional Atlas updated");
    assert.equal(updated.stackId, first.stackId);
    assert.equal(updated.resources[0].resource, first.resources[0].resource);
    assert.equal(
      updated.resources[0].configuration.values.title,
      "Fictional Atlas updated",
    );
    assert.ok(updated.resources[0].version > first.resources[0].version);
    assert.equal(f.app.resources.size, 1);
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_stack_publications WHERE stack_id=?",
        )
        .get(first.stackId).n,
      2,
    );
    const writes = f.app.writes.length;
    const denied = await f.call({
      action: "update",
      workspace: w.id,
      id: first.id,
      expectedRevision: updated.revision,
      request: request({ dataClass: "sensitive" }),
    });
    assert.equal(denied.requests[0].decision.outcome, "denied");
    assert.equal(f.app.writes.length, writes);
    assert.equal(
      (await readStack(f.db, w.id, first.stackId)).published.instances[0].config
        .title,
      "Fictional Atlas updated",
    );
  } finally {
    f.close();
  }
});

test("changed candidate and revoked role during source wait stop further resource effects", async () => {
  for (const change of ["candidate", "role"]) {
    const f = setup();
    try {
      const w = await enabled(f),
        service = f.runtime.GUESTBOOK;
      let changed = false;
      f.runtime.GUESTBOOK = {
        async fetch(req) {
          const reply = await service.fetch(req);
          if (!changed && new URL(req.url).pathname.endsWith("/build.json")) {
            changed = true;
            if (change === "role")
              f.sqlite
                .prepare(
                  "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
                )
                .run(w.id, user.id);
            else {
              const row = f.sqlite
                .prepare("SELECT * FROM creator_stacks WHERE workspace_id=?")
                .get(w.id);
              const draft = JSON.parse(row.draft_json);
              draft.instances[0].config.title = "Changed outside the plan";
              await saveStack(f.db, w.id, row.id, draft, row.revision, user.id);
            }
          }
          return reply;
        },
      };
      await f.call({
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request: request(),
      });
      assert.equal(
        f.app.writes.length,
        0,
        change + " must stop before provider effect",
      );
      assert.equal(
        f.sqlite.prepare("SELECT status FROM creator_platform_requests").get()
          .status,
        "needs-attention",
      );
    } finally {
      f.close();
    }
  }
});

test("reviewed service updates can be sent back, revised and accepted without a new resource", async () => {
  const f = setup();
  try {
    const w = await enabled(f),
      created = (
        await f.call({
          action: "submit",
          workspace: w.id,
          key: crypto.randomUUID(),
          request: request(),
        })
      ).requests[0];
    await f.call({
      action: "configure",
      workspace: w.id,
      expectedRevision: 1,
      profile: { ...profile, reviewRequired: true },
    });
    const reviewer = { ...user, id: "fictional-reviewer-0002" };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
      )
      .run(w.id, reviewer.id);
    const pending = (
      await f.call({
        action: "update",
        workspace: w.id,
        id: created.id,
        expectedRevision: created.revision,
        request: request({ name: "Reviewed update" }),
      })
    ).requests[0];
    assert.equal(pending.status, "waiting");
    const sent = await f.call(
      {
        action: "review",
        workspace: w.id,
        id: pending.id,
        expectedRevision: pending.revision,
        decision: "send-back",
        reason: "Clarify release",
      },
      reviewer,
    );
    assert.equal(sent.ok, true, JSON.stringify(sent));
    assert.equal(sent.requests[0].status, "sent-back");
    const revised = await f.call({
      action: "revise",
      workspace: w.id,
      id: pending.id,
      expectedRevision: sent.requests[0].revision,
      request: request({ name: "Revised update" }),
    });
    assert.equal(revised.ok, true, JSON.stringify(revised));
    const accepted = await f.call(
      {
        action: "review",
        workspace: w.id,
        id: pending.id,
        expectedRevision: revised.requests[0].revision,
        decision: "accept",
        reason: "Exact revised plan accepted",
      },
      reviewer,
    );
    assert.equal(
      accepted.requests[0].status,
      "complete",
      JSON.stringify(accepted),
    );
    assert.equal(
      accepted.requests[0].resources[0].resource,
      created.resources[0].resource,
    );
    assert.equal(f.app.resources.size, 1);
  } finally {
    f.close();
  }
});

test("expired pre-effect approval can be replanned and approved again without holding quota forever", async () => {
  const f = setup();
  try {
    const w = await enabled(f, user, { reviewRequired: true }),
      reviewer = { ...user, id: "fictional-reviewer-0002" };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
      )
      .run(w.id, reviewer.id);
    const pending = (
      await f.call({
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request: request(),
      })
    ).requests[0];
    const service = f.runtime.GUESTBOOK;
    delete f.runtime.GUESTBOOK;
    const accepted = (
      await f.call(
        {
          action: "review",
          workspace: w.id,
          id: pending.id,
          expectedRevision: pending.revision,
          decision: "accept",
          reason: "Exact plan",
        },
        reviewer,
      )
    ).requests[0];
    f.sqlite
      .prepare(
        "UPDATE creator_platform_requests SET approval_expires=0 WHERE id=?",
      )
      .run(pending.id);
    f.runtime.GUESTBOOK = service;
    const expired = (
      await f.call({
        action: "run",
        workspace: w.id,
        id: pending.id,
        expectedRevision: accepted.revision,
      })
    ).requests[0];
    assert.equal(expired.status, "needs-attention");
    assert.equal(f.app.writes.length, 0);
    const revised = await f.call({
      action: "revise",
      workspace: w.id,
      id: pending.id,
      expectedRevision: expired.revision,
      request: request(),
    });
    assert.equal(revised.ok, true, JSON.stringify(revised));
    assert.equal(revised.requests[0].status, "waiting");
    const done = await f.call(
      {
        action: "review",
        workspace: w.id,
        id: pending.id,
        expectedRevision: revised.requests[0].revision,
        decision: "accept",
        reason: "Revalidated current plan",
      },
      reviewer,
    );
    assert.equal(done.requests[0].status, "complete");
    assert.equal(f.app.resources.size, 1);
  } finally {
    f.close();
  }
});

test("policy drift preserves read-only reconciliation before fresh planning of an uncertain operation", async () => {
  const f = setup();
  try {
    const w = await enabled(f);
    let failed = false;
    f.app.afterWrite(({ command }) => {
      if (command.action === "activate" && !failed) {
        failed = true;
        throw Error("lost ack");
      }
    });
    const lost = (
      await f.call({
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request: request(),
      })
    ).requests[0];
    assert.equal(lost.status, "needs-attention");
    await f.call({
      action: "configure",
      workspace: w.id,
      expectedRevision: 1,
      profile: { ...profile, maxApplications: 3 },
    });
    f.app.afterWrite(null);
    const attempts = f.app.writes.length;
    const checked = await f.call({
      action: "reconcile",
      workspace: w.id,
      id: lost.id,
      expectedRevision: lost.revision,
    });
    assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.equal(f.app.writes.length, attempts);
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_resource_operations WHERE state IN ('pending','unknown')",
        )
        .get().n,
      0,
    );
    const revised = await f.call({
      action: "revise",
      workspace: w.id,
      id: lost.id,
      expectedRevision: checked.requests[0].revision,
      request: request(),
    });
    assert.equal(revised.ok, true, JSON.stringify(revised));
    assert.equal(
      revised.requests[0].status,
      "complete",
      JSON.stringify(revised),
    );
    assert.equal(f.app.resources.size, 1);
  } finally {
    f.close();
  }
});

test("manual reconciliation cannot downgrade a completed service without an uncertain operation", async () => {
  const f = setup();
  try {
    const w = await enabled(f),
      created = (
        await f.call({
          action: "submit",
          workspace: w.id,
          key: crypto.randomUUID(),
          request: request(),
        })
      ).requests[0];
    const response = await f.call({
      action: "reconcile",
      workspace: w.id,
      id: created.id,
      expectedRevision: created.revision,
    });
    assert.equal(response.code, "CONFLICT");
    const listed = await f.call(
      { action: "list", workspace: w.id },
      user,
      true,
    );
    assert.equal(listed.requests[0].status, "complete");
    assert.equal(listed.requests[0].revision, created.revision);
  } finally {
    f.close();
  }
});
