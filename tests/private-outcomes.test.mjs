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
} from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import {
  collectStackAction,
  purgePrivateOutcomes,
} from "../src/lib/private-outcome-events.ts";
import { recordModerationOutcome } from "../src/lib/private-outcome-proof.ts";
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
function request(
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

test("current publication derives every private dimension; duplicate activation tokens count once and reject body authority", async () => {
  const f = setup();
  try {
    const a = await page(f);
    const token = crypto.randomUUID();
    for (let i = 0; i < 3; i++)
      assert.equal(
        (
          await collectStackAction(
            request(a.stack, { token }),
            runtime(f),
            a.stack.slug,
            "fictional-hello-instance",
          )
        ).status,
        204,
      );
    assert.equal(total(f), 1);
    await collectStackAction(
      request(a.stack, { token }, {}, "fictional-link-instance"),
      runtime(f),
      a.stack.slug,
      "fictional-link-instance",
    );
    assert.equal(total(f), 1, "same delivery cannot select another target");
    assert.equal(
      (
        await collectStackAction(
          request(a.stack, { workspace: "spoofed-workspace" }),
          runtime(f),
          a.stack.slug,
          "fictional-hello-instance",
        )
      ).status,
      400,
    );
    for (const target of ["fictional-hidden-instance", "not-existing-instance"])
      await collectStackAction(
        request(a.stack, {}, {}, target),
        runtime(f),
        a.stack.slug,
        target,
      );
    await collectStackAction(
      request(a.stack, { publication: 1 }),
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
      request(b.stack, {}, {}, "fictional-link-instance"),
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
      request(archived),
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

test("owner-recorded demo mode is captured only on future receipts; limits/outage/probes never authorize navigation", async () => {
  const f = setup();
  try {
    const p = await page(f);
    await collectStackAction(
      request(p.stack),
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
      request(p.stack),
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
    ])
      await collectStackAction(
        request(p.stack, {}, headers),
        runtime(f),
        p.stack.slug,
        "fictional-hello-instance",
      );
    assert.equal(
      (
        await collectStackAction(
          request(p.stack, {}, { Origin: "https://outside.test" }),
          runtime(f),
          p.stack.slug,
          "fictional-hello-instance",
        )
      ).status,
      403,
    );
    await collectStackAction(
      request(p.stack),
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
          request(p.stack),
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
      [1, 2, 3].map(() =>
        collectStackAction(
          request(p.stack),
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
      request(p.stack),
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
