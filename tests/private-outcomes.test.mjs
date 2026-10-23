import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, saved, user, instance } from "./helpers/resource-fixture.mjs";
import {
  workspaceForUser,
  createStack,
  saveStack,
  publishStack,
  readStack,
  setArchived,
  deleteStack,
} from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import {
  collectStackAction,
  purgePrivateOutcomes,
  publicationActionKey,
} from "../src/lib/private-outcome-events.ts";
import { recordModerationOutcome } from "../src/lib/private-outcome-proof.ts";
import { decodeOutcomeReply } from "../src/plugins/outcomes/protocol.ts";
const origin = "https://composer.loftwah.com";
function setup() {
  const f = fixture();
  for (const file of ["0008_workspace_access.sql", "0009_private_outcomes.sql"])
    f.sqlite.exec(readFileSync("migrations/" + file, "utf8"));
  return f;
}
async function page(f, name = "Fictional action page", actor = user) {
  const workspace = await workspaceForUser(f.db, actor);
  const created = await createStack(f.db, workspace.id, name);
  const draft = await saveStack(
    f.db,
    workspace.id,
    created.id,
    {
      version: 1,
      name,
      description: "Fictional only",
      theme: "midnight",
      instances: [
        { id: "fictional-hello-instance", app: "hello", label: "Hello" },
        { id: "fictional-link-instance", app: "linkcheck", label: "Inspect" },
        {
          id: "fictional-hidden-instance",
          app: "hello",
          label: "Hidden",
          visible: false,
          binding: { mode: "shared", shareOf: "fictional-hello-instance" },
        },
      ],
    },
    created.revision,
  );
  const published = await publishStack(
    f.db,
    workspace.id,
    draft.id,
    draft.revision,
  );
  return { workspace, stack: published };
}
async function request(
  stack,
  patch = {},
  headers = {},
  target = "fictional-hello-instance",
) {
  return new Request(
    origin + "/api/creator-actions/" + stack.slug + "/" + target,
    {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
        ...headers,
      },
      body: JSON.stringify({
        contract: 1,
        publication: stack.publishedRevision,
        publicationKey: await publicationActionKey(
          stack.id,
          stack.publishedRevision,
        ),
        token: crypto.randomUUID(),
        interaction: "keyboard",
        disposition: "same_tab",
        ...patch,
      }),
    },
  );
}
const runtime = (f) => ({
  DB: f.db,
  PUBLIC_ORIGIN: origin,
  USAGE_LIMIT: {
    async limit() {
      return { success: true };
    },
  },
});
const total = (f) =>
  f.sqlite
    .prepare("SELECT COALESCE(SUM(n),0) AS n FROM creator_outcome_daily")
    .get().n;
async function book(f) {
  const space = await workspaceForUser(f.db, user);
  const draft = await saved(f, space.id, "Fictional measured book", [
    instance("fictional-book-instance", "Book"),
  ]);
  const applied = await applyStackResources(
    f.db,
    user.id,
    space.id,
    draft.id,
    draft.revision,
    f.runtime,
  );
  const item = {
    id: crypto.randomUUID(),
    resource: applied.resources[0].resource,
    caption: "Never copy this private caption",
    author: "Never copy this author",
    status: "pending",
    revision: 1,
    synthetic: 0,
    created_at: "2026-10-18 10:00:00",
    png: "",
  };
  f.app.items.set(item.id, item);
  return {
    space,
    stack: applied.stack,
    item,
    selection: {
      workspace: space.id,
      stack: draft.id,
      instance: "fictional-book-instance",
      expectedRevision: applied.stack.revision,
    },
  };
}
async function moderate(f, b, status = "approved", extra = {}) {
  const resource = f.app.resources.get(b.item.resource);
  const result = await f.route({
    action: "moderateResource",
    ...b.selection,
    change: {
      command: "moderate",
      resource: b.item.resource,
      operationId: crypto.randomUUID(),
      expectedVersion: resource.version,
      item: b.item.id,
      itemRevision: b.item.revision,
      status,
      ...extra,
    },
  });
  if (result.stack) b.selection.expectedRevision = result.stack.revision;
  return result;
}

test("forward 0008/0009 migration preserves existing private stack, publication, resource and confirmed journal bytes", async () => {
  const f = fixture();
  try {
    const b = await book(f);
    await moderate(f, b);
    await publishStack(
      f.db,
      b.space.id,
      b.stack.id,
      b.selection.expectedRevision,
    );
    const tables = [
      "creator_stacks",
      "creator_stack_publications",
      "creator_app_resources",
      "creator_stack_resource_bindings",
      "creator_resource_operations",
    ];
    const before = Object.fromEntries(
      tables.map((table) => [
        table,
        f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
      ]),
    );
    const members = f.sqlite
      .prepare(
        "SELECT workspace_id,user_id,role FROM creator_members ORDER BY workspace_id,user_id",
      )
      .all();
    for (const file of [
      "0008_workspace_access.sql",
      "0009_private_outcomes.sql",
    ])
      f.sqlite.exec(readFileSync("migrations/" + file, "utf8"));
    for (const table of tables)
      assert.deepEqual(
        f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
        before[table],
      );
    assert.deepEqual(
      f.sqlite
        .prepare(
          "SELECT workspace_id,user_id,role FROM creator_members ORDER BY workspace_id,user_id",
        )
        .all(),
      members,
    );
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) n FROM creator_outcome_daily").get().n,
      0,
      "Old journals cannot invent previous-state proof",
    );
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

test("current publication derives every private dimension; duplicate activation tokens count once and reject body authority", async () => {
  const f = setup();
  try {
    const a = await page(f);
    const token = crypto.randomUUID();
    for (let i = 0; i < 3; i++)
      assert.equal(
        (
          await collectStackAction(
            await request(a.stack, { token }),
            runtime(f),
            a.stack.slug,
            "fictional-hello-instance",
          )
        ).status,
        204,
      );
    assert.equal(total(f), 1);
    await collectStackAction(
      await request(a.stack, { token }, {}, "fictional-link-instance"),
      runtime(f),
      a.stack.slug,
      "fictional-link-instance",
    );
    assert.equal(total(f), 1, "same delivery cannot select another target");
    assert.equal(
      (
        await collectStackAction(
          await request(a.stack, { workspace: "spoofed-workspace" }),
          runtime(f),
          a.stack.slug,
          "fictional-hello-instance",
        )
      ).status,
      400,
    );
    for (const target of ["fictional-hidden-instance", "not-existing-instance"])
      await collectStackAction(
        await request(a.stack, {}, {}, target),
        runtime(f),
        a.stack.slug,
        target,
      );
    await collectStackAction(
      await request(a.stack, { publication: 1 }),
      runtime(f),
      a.stack.slug,
      "fictional-hello-instance",
    );
    assert.equal(total(f), 1);
    const b = await page(f, "Other fictional page", {
      id: "another-private-creator",
      name: "Another creator",
    });
    await collectStackAction(
      await request(b.stack, {}, {}, "fictional-link-instance"),
      runtime(f),
      b.stack.slug,
      "fictional-link-instance",
    );
    const rows = f.sqlite
      .prepare(
        "SELECT workspace_id,stack_id,instance_id,n FROM creator_outcome_daily ORDER BY stack_id",
      )
      .all();
    assert.equal(rows.length, 2);
    assert(
      rows.some(
        (r) =>
          r.workspace_id === a.workspace.id &&
          r.stack_id === a.stack.id &&
          r.instance_id === "fictional-hello-instance",
      ),
    );
    assert(
      rows.some(
        (r) =>
          r.workspace_id === b.workspace.id &&
          r.stack_id === b.stack.id &&
          r.instance_id === "fictional-link-instance",
      ),
    );
    const archived = await setArchived(
      f.db,
      a.workspace.id,
      a.stack.id,
      true,
      a.stack.revision,
    );
    await collectStackAction(
      await request(archived),
      runtime(f),
      a.stack.slug,
      "fictional-hello-instance",
    );
    assert.equal(total(f), 2);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

test("an old public page cannot attribute its Open to a recreated slug in another workspace", async () => {
  const f = setup();
  try {
    const a = await page(f),
      old = await request(a.stack);
    await deleteStack(
      f.db,
      a.workspace.id,
      a.stack.id,
      a.stack.revision,
      user.id,
    );
    const b = await page(f, "Fictional action page", {
      ...user,
      id: "fictional-recreated-owner",
    });
    assert.equal(b.stack.slug, a.stack.slug);
    assert.equal(b.stack.publishedRevision, a.stack.publishedRevision);
    await collectStackAction(
      old,
      runtime(f),
      a.stack.slug,
      "fictional-hello-instance",
    );
    assert.equal(
      total(f),
      0,
      "A publication revision is not globally unique across recreated stacks",
    );
  } finally {
    f.close();
  }
});

test("owner-recorded demo mode is captured only on future receipts; limits/outage/probes never authorize navigation", async () => {
  const f = setup();
  try {
    const p = await page(f);
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    f.sqlite
      .prepare(
        "INSERT INTO creator_outcome_settings(stack_id,workspace_id,traffic_mode) VALUES(?,?,'demo')",
      )
      .run(p.stack.id, p.workspace.id);
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT traffic,n FROM creator_outcome_daily ORDER BY traffic")
        .all()
        .map((r) => [r.traffic, r.n]),
      [
        ["demo", 1],
        ["unclassified", 1],
      ],
    );
    for (const headers of [
      { "X-Composer-Verification": "1" },
      { "User-Agent": "Googlebot" },
      { "User-Agent": "Mozilla/5.0", Referer: origin + "/s/fictional?analytics=off" },
      { "User-Agent": "Mozilla/5.0", Referer: origin + "/s/fictional?qa=1" },
    ])
      await collectStackAction(
        await request(p.stack, {}, headers),
        runtime(f),
        p.stack.slug,
        "fictional-hello-instance",
      );
    assert.equal(
      (
        await collectStackAction(
          await request(p.stack, {}, { Origin: "https://outside.test" }),
          runtime(f),
          p.stack.slug,
          "fictional-hello-instance",
        )
      ).status,
      403,
    );
    await collectStackAction(
      await request(p.stack),
      {
        ...runtime(f),
        USAGE_LIMIT: {
          async limit() {
            return { success: false };
          },
        },
      },
      p.stack.slug,
      "fictional-hello-instance",
    );
    assert.equal(
      (
        await collectStackAction(
          await request(p.stack),
          {
            ...runtime(f),
            DB: {
              prepare() {
                throw Error("fictional outage");
              },
            },
          },
          p.stack.slug,
          "fictional-hello-instance",
        )
      ).status,
      204,
    );
    assert.equal(total(f), 2);
    f.sqlite
      .prepare("UPDATE creator_outcome_daily SET n=998 WHERE traffic='demo'")
      .run();
    await Promise.all(
      [1, 2, 3].map(async () =>
        collectStackAction(
          await request(p.stack),
          runtime(f),
          p.stack.slug,
          "fictional-hello-instance",
        ),
      ),
    );
    assert.equal(total(f), 1000);
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_outcome_receipts")
        .get().n,
      3,
    );
  } finally {
    f.close();
  }
});

test("only verified changes of moderation state count; already-approved commands and refused writes do not inflate outcomes", async () => {
  const f = setup();
  try {
    const b = await book(f);
    let result = await moderate(f, b);
    assert.equal(result.outcome, "applied");
    assert.equal(total(f), 1);
    result = await moderate(f, b);
    assert.equal(
      result.outcome,
      "applied",
      "the existing app commits a repeated approved command",
    );
    assert.equal(total(f), 1, "a command is not a transition");
    result = await moderate(f, b, "hidden");
    assert.equal(result.outcome, "applied");
    result = await moderate(f, b, "approved");
    assert.equal(result.outcome, "applied");
    assert.deepEqual(
      f.sqlite
        .prepare(
          "SELECT event,SUM(n) AS n FROM creator_outcome_daily GROUP BY event ORDER BY event",
        )
        .all()
        .map((r) => [r.event, r.n]),
      [
        ["postcard_approved", 2],
        ["postcard_hidden", 1],
      ],
    );
    result = await moderate(f, b, "deleted", { itemRevision: 99 });
    assert.equal(result.outcome, "refused");
    assert.equal(total(f), 3);
    const stored = JSON.stringify(
      f.sqlite.prepare("SELECT * FROM creator_outcome_receipts").all(),
    );
    assert(
      !stored.includes(b.item.caption) &&
        !stored.includes(b.item.author) &&
        !stored.includes(b.item.id),
    );
  } finally {
    f.close();
  }
});

test("lost commit acknowledgement is counted once on verified reconciliation, using the original operation proof", async () => {
  const f = setup();
  try {
    const b = await book(f);
    let lose = true;
    f.app.afterWrite(({ command }) => {
      if (lose && command.action === "moderate") {
        lose = false;
        throw Error("Committed but lost ACK");
      }
    });
    const result = await moderate(f, b);
    assert.equal(result.outcome, "unknown");
    assert.equal(total(f), 0);
    assert.equal(b.item.status, "approved");
    const writes = f.app.writes.length;
    const reconciled = await f.route({
      action: "reconcileResourceContent",
      ...b.selection,
    });
    assert.equal(reconciled.outcome, "applied");
    assert.equal(total(f), 1);
    assert.equal(f.app.writes.length, writes);
    const operation = f.sqlite
      .prepare(
        "SELECT id FROM creator_resource_operations WHERE action='moderate'",
      )
      .get().id;
    await recordModerationOutcome(f.db, b.space.id, b.stack.id, operation);
    assert.equal(total(f), 1);
    assert.equal(
      (
        await f.route({
          action: "reconcileResourceContent",
          ...b.selection,
          expectedRevision: reconciled.stack.revision,
        })
      ).outcome,
      "unchanged",
    );
    assert.equal(total(f), 1);
  } finally {
    f.close();
  }
});

test("missing, synthetic, expired or late proof never invents a transition; analytics failure preserves committed app behavior", async () => {
  for (const mode of ["synthetic", "missing-table", "expired-proof"]) {
    const f = setup();
    try {
      const b = await book(f);
      if (mode === "synthetic") b.item.synthetic = 1;
      if (mode === "missing-table")
        f.sqlite.exec("DROP TABLE creator_outcome_intents");
      let lose = mode === "expired-proof";
      f.app.afterWrite(({ command }) => {
        if (lose && command.action === "moderate") {
          lose = false;
          throw Error("Committed but lost ACK");
        }
      });
      let result = await moderate(f, b);
      assert.equal(b.item.status, "approved");
      if (mode === "expired-proof") {
        assert.equal(result.outcome, "unknown");
        f.sqlite
          .prepare(
            "UPDATE creator_outcome_intents SET created_at='2020-01-01 00:00:00'",
          )
          .run();
        result = await f.route({
          action: "reconcileResourceContent",
          ...b.selection,
        });
      }
      assert.equal(result.outcome, "applied");
      assert.equal(total(f), 0, mode);
      assert.equal(b.item.revision, 2);
    } finally {
      f.close();
    }
  }
});

test("35-day retention removes only analytics rows and leaves app journals, publication and membership intact", async () => {
  const f = setup();
  try {
    const p = await page(f);
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    const before = f.sqlite
      .prepare("SELECT * FROM creator_stack_publications")
      .all();
    const members = f.sqlite.prepare("SELECT * FROM creator_members").all();
    f.sqlite.prepare("UPDATE creator_outcome_daily SET day='2020-01-01'").run();
    f.sqlite
      .prepare("UPDATE creator_outcome_receipts SET day='2020-01-01'")
      .run();
    await purgePrivateOutcomes(f.db);
    assert.equal(total(f), 0);
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_outcome_receipts")
        .get().n,
      0,
    );
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stack_publications").all(),
      before,
    );
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_members").all(),
      members,
    );
    assert.equal(
      (await readStack(f.db, p.workspace.id, p.stack.id)).revision,
      p.stack.revision,
    );
  } finally {
    f.close();
  }
});

test("stack deletion removes its private measurements without orphaning or changing another workspace's retained data", async () => {
  const f = setup();
  try {
    const a = await page(f),
      b = await page(f, "Fictional other workspace", {
        ...user,
        id: "fictional-other-creator",
      });
    for (const p of [a, b])
      await collectStackAction(
        await request(p.stack),
        runtime(f),
        p.stack.slug,
        "fictional-hello-instance",
      );
    const before = f.sqlite
      .prepare("SELECT * FROM creator_outcome_daily WHERE workspace_id=?")
      .all(b.workspace.id);
    await deleteStack(
      f.db,
      a.workspace.id,
      a.stack.id,
      a.stack.revision,
      user.id,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) n FROM creator_outcome_daily WHERE workspace_id=?",
        )
        .get(a.workspace.id).n,
      0,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) n FROM creator_outcome_receipts WHERE stack_id=?",
        )
        .get(a.stack.id).n,
      0,
    );
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT * FROM creator_outcome_daily WHERE workspace_id=?")
        .all(b.workspace.id),
      before,
    );
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

// The private report reuses native role/membership, not a parallel analytics user.
const privateModule = await import("../src/lib/private-outcomes.ts");
test("a previous 30-day action window cannot present five retained days as a complete previous total", async () => {
  const f = setup();
  try {
    const p = await page(f);
    for (const [day, n] of [
      ["2026-09-14", 3],
      ["2026-09-16", 4],
      ["2026-10-05", 2],
    ])
      f.sqlite
        .prepare("INSERT INTO creator_outcome_daily VALUES(?,?,?,?,?,?,?,?,?)")
        .run(
          day,
          p.workspace.id,
          p.stack.id,
          "fictional-hello-instance",
          "app_open_action",
          "keyboard",
          "same_tab",
          "unclassified",
          n,
        );
    const report = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report", days: "30" },
      new Date("2026-10-18T12:00:00Z"),
    );
    const metric = report.metrics.find(
      (value) => value.key === "app_open_action",
    );
    assert.equal(metric.value, 2);
    assert.equal(metric.previous, null);
    assert.equal(metric.delta, null);
    assert.equal(metric.percent, null);
    assert.equal(
      report.metrics.find((value) => value.key === "retained_snapshots")
        .previous,
      0,
      "Retained publication history has its own lifetime, independent of action retention",
    );
  } finally {
    f.close();
  }
});
test("one report snapshot cannot turn a concurrently arriving first action into zero while its target row says one", async () => {
  const f = setup();
  try {
    const p = await page(f);
    let inserted = false;
    const arrive = () => {
      if (inserted) return;
      inserted = true;
      f.sqlite
        .prepare("INSERT INTO creator_outcome_daily VALUES(?,?,?,?,?,?,?,?,?)")
        .run(
          new Date().toISOString().slice(0, 10),
          p.workspace.id,
          p.stack.id,
          "fictional-hello-instance",
          "app_open_action",
          "keyboard",
          "same_tab",
          "unclassified",
          1,
        );
    };
    const statement = (sql, params = []) => ({
      sql,
      params,
      bind(...values) {
        return statement(sql, values);
      },
      async all() {
        const result = await f.db
          .prepare(sql)
          .bind(...params)
          .all();
        if (sql.includes("SELECT day,event,SUM")) arrive();
        return result;
      },
    });
    const racing = {
      prepare: statement,
      async batch(statements) {
        const result = await f.db.batch(statements);
        arrive();
        return result;
      },
    };
    const report = await privateModule.privateOutcomeReport(
      racing,
      p.workspace.id,
      { action: "report" },
    );
    assert.equal(
      report.metrics.find((metric) => metric.key === "app_open_action").value,
      null,
      "The snapshot predates the first retained action",
    );
    assert.deepEqual(
      report.targets,
      [],
      "Coverage, metrics and targets must describe the same read snapshot",
    );
    const current = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report" },
    );
    assert.equal(
      current.metrics.find((metric) => metric.key === "app_open_action").value,
      1,
    );
    assert.equal(current.targets[0].n, 1);
  } finally {
    f.close();
  }
});
const native = (f, actor, input, reading = true, headers = {}) =>
  privateModule.managePrivateOutcomes(
    {
      user: actor,
      input,
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/outcomes" +
          (reading ? "Read?" + new URLSearchParams(input) : "Write"),
        {
          method: reading ? "GET" : "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
        },
      ),
    },
    f.runtime,
  );

test("native decoder refuses partial series, spoofed scope and malformed or nonadvancing classification acknowledgements", async () => {
  const f = setup();
  try {
    const p = await page(f),
      fields = {
        action: "report",
        workspace: p.workspace.id,
        stack: p.stack.id,
        days: "7",
        traffic: "unclassified",
      };
    const result = await native(f, user, fields);
    assert.equal(
      decodeOutcomeReply("report", result, fields).report.scope.stack,
      p.stack.id,
    );
    for (const corrupt of [
      (value) => {
        delete value.report.metrics;
      },
      (value) => {
        value.report.scope.workspace = "another-workspace";
      },
      (value) => {
        value.report.metrics[0].daily.pop();
      },
      (value) => {
        value.report.metrics[0].daily[0].value = -1;
      },
      (value) => {
        value.setting.stack = "another-stack";
      },
    ]) {
      const broken = structuredClone(result);
      corrupt(broken);
      assert.throws(() => decodeOutcomeReply("report", broken, fields));
    }
    const write = {
      workspace: p.workspace.id,
      stack: p.stack.id,
      expectedRevision: 0,
      traffic: "demo",
    };
    const reply = await native(
      f,
      user,
      { action: "setTraffic", ...write },
      false,
    );
    assert.equal(
      decodeOutcomeReply("setTraffic", reply, write).setting.revision,
      1,
    );
    for (const revision of [0, -1, 2, 1.5, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() =>
        decodeOutcomeReply(
          "setTraffic",
          { ...reply, setting: { ...reply.setting, revision } },
          write,
        ),
      );
  } finally {
    f.close();
  }
});

test("private reporting/export match scoped totals and reject another workspace, unbounded filters, raw properties and lower global roles", async () => {
  const f = setup();
  try {
    const p = await page(f);
    const actor = { ...user, role: 20, email: "fictional-owner@example.test" };
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    const args = {
      workspace: p.workspace.id,
      stack: p.stack.id,
      days: "7",
      traffic: "unclassified",
    };
    const shown = await native(f, actor, { action: "report", ...args });
    assert.equal(shown.ok, true, JSON.stringify(shown));
    assert.equal(
      shown.report.metrics.find((m) => m.key === "app_open_action").value,
      1,
    );
    assert.equal(
      shown.report.metrics.find((m) => m.key === "postcard_approved").value,
      null,
    );
    const exported = await native(f, actor, { action: "export", ...args });
    assert.deepEqual(exported.export.metrics, shown.report.metrics);
    assert.deepEqual(exported.export.scope, shown.report.scope);
    assert(!JSON.stringify(exported.export).includes("Fictional action page"));
    assert(!JSON.stringify(exported.export).includes(actor.email));
    assert.equal(
      (
        await native(
          f,
          { id: "fictional-other-reader", name: "Another", role: 20 },
          { action: "report", ...args },
        )
      ).code,
      "FORBIDDEN",
    );
    for (const patch of [
      { days: "99999" },
      { from: "2020-01-01" },
      { url: "https://private.invalid/token" },
      { actor: user.id },
      { instance: "outside-instance" },
    ])
      assert.equal(
        (await native(f, actor, { action: "report", ...args, ...patch })).ok,
        false,
      );
    assert.equal(
      (await native(f, { ...actor, role: 10 }, { action: "report", ...args }))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await native(f, actor, { action: "report", ...args }, true, {
          Origin: "https://outside.invalid",
        })
      ).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});

test("only a current workspace owner declares future demonstration mode, with exact revision guards and no historical rewrite", async () => {
  const f = setup();
  try {
    const p = await page(f);
    const actor = { ...user, role: 20 };
    const args = {
      action: "setTraffic",
      workspace: p.workspace.id,
      stack: p.stack.id,
      expectedRevision: 0,
      traffic: "demo",
    };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
      )
      .run(p.workspace.id, "fictional-mode-editor");
    assert.equal(
      (
        await native(
          f,
          { id: "fictional-mode-editor", name: "Editor", role: 20 },
          args,
          false,
        )
      ).code,
      "FORBIDDEN",
    );
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    const first = await native(f, actor, args, false);
    assert.equal(first.setting.revision, 1);
    assert.equal(first.setting.traffic, "demo");
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      "fictional-hello-instance",
    );
    assert.equal((await native(f, actor, args, false)).code, "CONFLICT");
    const second = await native(
      f,
      actor,
      { ...args, expectedRevision: 1, traffic: "unclassified" },
      false,
    );
    assert.equal(second.setting.revision, 2);
    assert.equal(second.setting.traffic, "unclassified");
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT traffic,n FROM creator_outcome_daily ORDER BY traffic")
        .all()
        .map((r) => [r.traffic, r.n]),
      [
        ["demo", 1],
        ["unclassified", 1],
      ],
    );
    assert.equal(
      (
        await native(f, actor, { ...args, expectedRevision: 2 }, false, {
          "X-EmDash-Request": "",
        })
      ).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});

test("UTC comparisons distinguish missing coverage, first partial day, in-progress days and zero denominators", async () => {
  const f = setup();
  try {
    const p = await page(f);
    const insert = f.sqlite.prepare(
      "INSERT INTO creator_outcome_daily VALUES(?,?,?,?,?,?,?,?,?)",
    );
    for (const [day, n] of [
      ["2026-10-15", 2],
      ["2026-10-27", 4],
    ])
      insert.run(
        day,
        p.workspace.id,
        p.stack.id,
        "fictional-hello-instance",
        "app_open_action",
        "keyboard",
        "same_tab",
        "unclassified",
        n,
      );
    const now = new Date("2026-11-01T12:00:00Z");
    const complete = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report", days: "7", end: "yesterday" },
      now,
    );
    const m = complete.metrics[0];
    assert.equal(m.value, 4);
    assert.equal(m.previous, 0);
    assert.equal(m.delta, 4);
    assert.equal(m.percent, null, "zero denominator is not infinite growth");
    assert.equal(m.quality, "bounded");
    const current = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report", days: "7", end: "today" },
      now,
    );
    assert.equal(current.metrics[0].quality, "partial");
    assert.equal(current.metrics[0].delta, null);
    const long = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report", days: "30", end: "yesterday" },
      now,
    );
    assert.equal(long.metrics[0].previous, null);
    assert.equal(long.metrics[0].delta, null);
    assert(
      long.metrics[0].daily
        .filter((d) => d.date < "2026-10-15")
        .every((d) => d.value === null),
    );
    assert(
      long.metrics[0].daily.some((d) => d.date > "2026-10-15" && d.value === 0),
    );
    assert(long.unavailable.some((m) => m.key === "linkarooie_card_actions"));
  } finally {
    f.close();
  }
});

test("retained publication snapshots keep their separate history/traffic definition instead of pretending to be new publication actions", async () => {
  const f = setup();
  try {
    const p = await page(f);
    f.sqlite
      .prepare(
        "UPDATE creator_stack_publications SET published_at='2026-10-28 13:00:00'",
      )
      .run();
    const report = await privateModule.privateOutcomeReport(
      f.db,
      p.workspace.id,
      { action: "report", days: "7", end: "yesterday", traffic: "demo" },
      new Date("2026-11-01T12:00:00Z"),
    );
    assert.equal(report.metrics[0].value, null);
    const snapshots = report.metrics.find(
      (m) => m.key === "retained_snapshots",
    );
    assert.equal(snapshots.value, 1);
    assert.equal(snapshots.quality, "retained");
    assert.match(snapshots.definition, /Not every republish/);
    assert(
      report.limits.notes.some((note) =>
        note.includes("traffic filter applies only"),
      ),
    );
    assert.equal(report.targets.length, 0);
  } finally {
    f.close();
  }
});

test("the original marked native ingress suppresses measurement without changing the confirmed moderation result", async () => {
  const f = setup();
  try {
    const b = await book(f);
    const { manageStacks } = await import("../src/lib/stacks-admin.mjs");
    const command = {
      action: "moderateResource",
      ...b.selection,
      change: {
        command: "moderate",
        resource: b.item.resource,
        operationId: crypto.randomUUID(),
        expectedVersion: 2,
        item: b.item.id,
        itemRevision: 1,
        status: "approved",
      },
    };
    const result = await manageStacks(
      {
        user,
        input: command,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/write",
          {
            method: "POST",
            headers: {
              Origin: origin,
              "X-EmDash-Request": "1",
              "X-Composer-Verification": "1",
            },
          },
        ),
      },
      f.runtime,
    );
    assert.equal(result.outcome, "applied");
    assert.equal(b.item.status, "approved");
    assert.equal(total(f), 0);
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_outcome_intents")
        .get().n,
      0,
    );
  } finally {
    f.close();
  }
});

test("one demo Open action reconciles through owner report and explicitly permitted frozen aggregate", async () => {
  const f = setup();
  f.sqlite.exec(readFileSync("migrations/0010_public_reports.sql", "utf8"));
  try {
    const p = await page(f, "Private workspace label must never leave");
    const fields = {
      workspace: p.workspace.id,
      stack: p.stack.id,
      instance: "fictional-hello-instance",
      days: "7",
      end: "today",
      traffic: "demo",
    };
    const absent = await native(f, user, { action: "previewPublicReport", ...fields }, false);
    assert.equal(absent.ok, false);
    assert.equal(absent.code, "INVALID");
    assert.match(absent.message, /No retained Open action/);
    assert.doesNotMatch(absent.message, /query could not complete/);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM composer_reports").get().n, 0);
    await native(
      f,
      user,
      {
        action: "setTraffic",
        workspace: p.workspace.id,
        stack: p.stack.id,
        expectedRevision: 0,
        traffic: "demo",
      },
      false,
    );
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      fields.instance,
    );
    const nativeReport = await native(f, user, { action: "report", ...fields });
    assert.equal(
      nativeReport.report.metrics.find(
        (metric) => metric.key === "app_open_action",
      ).value,
      1,
    );
    const preview = await native(
      f,
      user,
      { action: "previewPublicReport", ...fields },
      false,
    );
    assert.equal(preview.ok, true, JSON.stringify(preview));
    assert.equal(preview.publicReport.value, 1);
    assert.equal(
      preview.publicReport.app,
      null,
      "historic instance actions must not inherit the current app identity",
    );
    assert.doesNotMatch(preview.publicReport.headline, /Hello World/);
    assert.equal(preview.publicReport.origin.traffic, "demo");
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM composer_reports").get().n,
      0,
    );
    assert.equal(
      (
        await native(
          f,
          user,
          {
            action: "publishPublicReport",
            ...fields,
            expectedReport: preview.publicReport.id,
          },
          false,
        )
      ).code,
      "CONFLICT",
    );
    const published = await native(
      f,
      user,
      {
        action: "publishPublicReport",
        ...fields,
        expectedReport: preview.publicReport.id,
        consent: true,
      },
      false,
    );
    assert.equal(published.ok, true, JSON.stringify(published));
    const saved = JSON.parse(
      f.sqlite
        .prepare("SELECT payload_json FROM composer_reports WHERE id=?")
        .get(preview.publicReport.id).payload_json,
    );
    assert.equal(
      saved.value,
      nativeReport.report.metrics.find(
        (metric) => metric.key === "app_open_action",
      ).value,
    );
    const { reportCaption } = await import("../src/lib/public-report.ts");
    const { reportShareSvg } = await import("../src/lib/report-share-svg.ts");
    for (const output of [
      JSON.stringify(saved),
      reportCaption(saved),
      ...["landscape", "square", "portrait"].map((format) =>
        reportShareSvg(
          saved,
          format,
          (text, size) => text.length * size * 0.5,
          "data:image/png;base64,AA==",
        ),
      ),
    ]) {
      for (const secret of [
        p.workspace.id,
        p.stack.id,
        fields.instance,
        p.stack.name,
        user.id,
      ])
        assert.ok(!output.includes(secret), secret);
      assert.doesNotMatch(
        output,
        /all connected versions|requests, not people/,
      );
      assert.match(output.toLowerCase(), /demo/);
    }
    // A later action invalidates the old preview rather than consenting to a new total.
    await collectStackAction(
      await request(p.stack),
      runtime(f),
      p.stack.slug,
      fields.instance,
    );
    assert.equal(
      (
        await native(
          f,
          user,
          {
            action: "publishPublicReport",
            ...fields,
            expectedReport: preview.publicReport.id,
            consent: true,
          },
          false,
        )
      ).code,
      "CONFLICT",
    );
    assert.equal(saved.value, 1, "stored snapshot remains frozen");
    for (const patch of [
      { metric: "private_record_body" },
      { traffic: "organic" },
      { stack: "foreign-stack" },
      { instance: "foreign-instance" },
    ]) {
      assert.equal(
        (
          await native(
            f,
            user,
            { action: "previewPublicReport", ...fields, ...patch },
            false,
          )
        ).ok,
        false,
      );
    }
    assert.equal(
      (
        await native(
          f,
          null,
          { action: "previewPublicReport", ...fields },
          false,
        )
      ).code,
      "FORBIDDEN",
    );
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
      )
      .run(p.workspace.id, "fictional-public-editor");
    assert.equal(
      (
        await native(
          f,
          { id: "fictional-public-editor", role: 20 },
          { action: "previewPublicReport", ...fields },
          false,
        )
      ).code,
      "FORBIDDEN",
    );
    // Even a previously permitted ID must still pass final current-owner SQL guard.
    const { storeOwnerReport } =
      await import("../src/lib/owner-public-report.ts");
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(p.workspace.id, user.id);
    await assert.rejects(
      () =>
        storeOwnerReport(f.db, saved, {
          user: user.id,
          workspace: p.workspace.id,
          stack: p.stack.id,
          instance: fields.instance,
          app: "hello",
        }),
      /Ownership/,
    );
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM composer_reports").get().n,
      1,
    );
  } finally {
    f.close();
  }
});
