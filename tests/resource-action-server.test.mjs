import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  collectResourceAction,
  resourceActionSummary,
  purgeResourceActions,
} from "../src/lib/resource-actions.ts";

const origin = "https://composer.test";
const now = new Date("2026-10-24T10:00:00Z");
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0002_usage.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0003_postcard_receipts.sql", "utf8"));
  sqlite.exec(
    "INSERT INTO composer_usage VALUES('2026-10-24','guestbook','postcard_received','standalone',7)",
  );
  sqlite.exec(readFileSync("migrations/0015_resource_actions.sql", "utf8"));
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              sqlite.prepare(sql).run(...values);
              return { success: true };
            },
            async all() {
              return {
                success: true,
                results: sqlite.prepare(sql).all(...values),
              };
            },
          };
        },
      };
    },
  };
  return {
    sqlite,
    db,
    runtime: {
      DB: db,
      PUBLIC_ORIGIN: origin,
      USAGE_LIMIT: {
        async limit() {
          return { success: true };
        },
      },
    },
    close() {
      sqlite.close();
    },
  };
}
function request(
  body = { contract: 1, resource: "change", action: "download" },
  headers = {},
  query = "",
) {
  return new Request(origin + "/api/resource-actions" + query, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const summary = (f, suffix = "") =>
  resourceActionSummary(
    new Request(origin + "/api/resource-summary" + suffix),
    f.runtime,
    now,
  );
const rows = (f) =>
  f.sqlite.prepare("SELECT * FROM composer_resource_usage").all();

test("additive resource counters preserve legacy rows and cap atomic writes without identities", async () => {
  const f = fixture();
  try {
    for (const resource of ["change", "incident", "pipeline", "hook", "kit"]) {
      for (const action of ["choice", "copy", "download", "example_open"]) {
        assert.equal(
          (
            await collectResourceAction(
              request({ contract: 1, resource, action }),
              f.runtime,
              now,
            )
          ).status,
          204,
        );
      }
    }
    assert.equal(rows(f).length, 20);
    assert.deepEqual(Object.keys(rows(f)[0]).sort(), [
      "action",
      "day",
      "n",
      "resource",
    ]);
    f.sqlite.exec(
      "UPDATE composer_resource_usage SET n=999 WHERE resource='change' AND action='download'",
    );
    await Promise.all(
      [1, 2, 3].map(() => collectResourceAction(request(), f.runtime, now)),
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT n FROM composer_resource_usage WHERE resource='change' AND action='download'",
        )
        .get().n,
      1000,
    );
    assert.equal(f.sqlite.prepare("SELECT n FROM composer_usage").get().n, 7);
    assert.throws(() =>
      f.sqlite.exec(
        "INSERT INTO composer_resource_usage VALUES('2026-10-24','private','download',1)",
      ),
    );
  } finally {
    f.close();
  }
});

test("strict same-origin small JSON denies extra/private fields, malformed input and forged scope before writes", async () => {
  const f = fixture();
  try {
    const payload = { contract: 1, resource: "hook", action: "choice" };
    for (const input of [
      { ...payload, private: "canary" },
      { ...payload, contract: 2 },
      { ...payload, resource: "__proto__" },
      { ...payload, action: "operation_completed" },
      [],
      null,
      "{bad",
      " ".repeat(129),
    ]) {
      assert.equal(
        (await collectResourceAction(request(input), f.runtime, now)).status,
        400,
      );
    }
    for (const headers of [
      { Origin: "https://foreign.test" },
      { Origin: "" },
      { "Sec-Fetch-Site": "cross-site" },
    ]) {
      assert.equal(
        (await collectResourceAction(request(payload, headers), f.runtime, now))
          .status,
        403,
      );
    }
    assert.equal(
      (
        await collectResourceAction(
          request(payload, { "Content-Type": "text/plain" }),
          f.runtime,
          now,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await collectResourceAction(
          request(payload, {}, "?private=canary"),
          f.runtime,
          now,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await collectResourceAction(
          new Request(origin + "/api/resource-actions"),
          f.runtime,
          now,
        )
      ).status,
      405,
    );
    assert.equal(rows(f).length, 0);
  } finally {
    f.close();
  }
});

test("verification header, current QA and inherited same-origin QA skip rate limits and DB entirely", async () => {
  const runtime = {
    PUBLIC_ORIGIN: origin,
    DB: {
      prepare() {
        throw Error("must not query");
      },
    },
    USAGE_LIMIT: {
      async limit() {
        throw Error("must not query");
      },
    },
  };
  for (const [headers, query] of [
    [{ "X-Composer-Verification": "1" }, ""],
    [{}, "?analytics=on&analytics=off"],
    [{}, "?qa=0&qa=1"],
    [{ Referer: origin + "/resources?analytics=off" }, ""],
    [{ Referer: origin + "/resources?qa=1" }, ""],
  ])
    assert.equal(
      (
        await collectResourceAction(
          request(undefined, headers, query),
          runtime,
          now,
        )
      ).status,
      204,
    );
  // A foreign URL cannot opt an ordinary first-party event out of recording.
  const f = fixture();
  try {
    assert.equal(
      (
        await collectResourceAction(
          request(undefined, { Referer: "https://foreign.test/?qa=1" }),
          f.runtime,
          now,
        )
      ).status,
      204,
    );
    assert.equal(rows(f).length, 1);
  } finally {
    f.close();
  }
});

test("rate limits and storage outages fail closed, and read-only summaries never manufacture zero", async () => {
  const f = fixture();
  try {
    assert.equal(
      (
        await collectResourceAction(
          request(),
          {
            ...f.runtime,
            USAGE_LIMIT: {
              async limit() {
                return { success: false };
              },
            },
          },
          now,
        )
      ).status,
      429,
    );
    assert.equal(rows(f).length, 0);
    const empty = await (await summary(f)).json();
    assert.equal(empty.state, "no_retained_actions");
    assert.equal(empty.total, null);
    assert.deepEqual(empty.rows, []);
    await collectResourceAction(request(), f.runtime, now);
    const observed = await (await summary(f)).json();
    assert.equal(observed.state, "observed");
    assert.equal(observed.total, 1);
    assert.equal(observed.rows.length, 1);
    assert.match(
      observed.measure,
      /not completed downloads, operations or people/,
    );
    for (const suffix of ["?days=999", "?days=7&days=30", "?private=canary"])
      assert.equal((await summary(f, suffix)).status, 400);
    for (const runtime of [
      {},
      {
        ...f.runtime,
        DB: {
          prepare() {
            throw Error("canary DB password");
          },
        },
      },
    ]) {
      const response = await resourceActionSummary(
        new Request(origin + "/api/resource-summary"),
        runtime,
        now,
      );
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.total, null);
      assert.ok(!JSON.stringify(body).includes("canary"));
    }
    assert.equal(
      (await collectResourceAction(request(), { PUBLIC_ORIGIN: origin }, now))
        .status,
      503,
    );
  } finally {
    f.close();
  }
});

test("retention removes only resource rows older than the retained 35 UTC dates", async () => {
  const f = fixture();
  try {
    f.sqlite.exec(
      "INSERT INTO composer_resource_usage VALUES('2026-09-19','change','choice',1),('2026-09-20','change','choice',1),('2026-10-24','change','choice',1)",
    );
    await purgeResourceActions(f.db, now);
    assert.deepEqual(
      rows(f).map((row) => row.day),
      ["2026-09-20", "2026-10-24"],
    );
    assert.equal(f.sqlite.prepare("SELECT n FROM composer_usage").get().n, 7);
  } finally {
    f.close();
  }
});
