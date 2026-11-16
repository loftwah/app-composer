import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";

// Old share schema only: 0031 + 0032 + 0034 + 0035, with their stack/workspace
// parents from 0003. No account, provider, app, server or UI code is involved.
const schema = [
  "0003_stacks.sql",
  "0031_share_calendar.sql",
  "0032_share_calendar_packages.sql",
  "0034_share_approvals.sql",
  "0035_bluesky_deliveries.sql",
]
  .map(migration)
  .join("\n");
const migrate = migration("0037_portfolio_no_stack.sql");

// Every column that existed before 0037, in its original table order. The new
// asset_kind and bluesky_asset columns are deliberately excluded.
const ITEM_COLUMNS = [
  "id",
  "workspace_id",
  "stack_id",
  "stack_revision",
  "channel",
  "caption",
  "link",
  "scheduled_at",
  "state",
  "shared_at",
  "created_by",
  "updated_by",
  "revision",
  "created_at",
  "updated_at",
  "destination",
  "variants",
];
const APPROVAL_COLUMNS = [
  "item_id",
  "workspace_id",
  "channel",
  "state",
  "account_handle",
  "account_did",
  "draft_revision",
  "approval_revision",
  "text_hash",
  "media_hash",
  "media_revision",
  "link",
  "scheduled_at",
  "binding_hash",
  "approved_at",
  "expires_at",
  "cancelled_at",
  "revoked_at",
  "revocation_reason",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
];
const DELIVERY_COLUMNS = [
  "idempotency_key",
  "item_id",
  "workspace_id",
  "channel",
  "approval_revision",
  "account_handle",
  "account_did",
  "binding_hash",
  "text_hash",
  "rkey",
  "state",
  "attempt",
  "provider_uri",
  "provider_cid",
  "permalink",
  "error_code",
  "error_message",
  "claimed_at",
  "published_at",
  "created_at",
  "updated_at",
];

const workspaceId = "ws-portfolio-migration";
const stackId = "stack-portfolio-migration";
const itemId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "idem-portfolio-" + "d".repeat(40);
const handle = "loftwah";
const did = "did:plc:axc7n2yjep6ggdz7fuztluc4";
const textHash = "a".repeat(64);
const mediaHash = "b".repeat(64);
const bindingHash = "c".repeat(64);
const rkey = "3n2goytaw322y";
const providerUri =
  "at://did:plc:axc7n2yjep6ggdz7fuztluc4/app.bsky.feed.post/3n2goytaw322y";
const providerCid =
  "bafyreifciui6dfvc6zgfm7m6o5da4iuwma7qevoygrvginh4c57f67b6mm";
const permalink = "https://bsky.app/profile/loftwah/post/3n2goytaw322y";
const ts = "2026-11-16T14:00:00.000Z";
const scheduledAt = "2099-02-01T09:30:00.000Z";
const sourceLink = "https://media.loftwah.com/p/9UX85ricWNKOeA96";

const item = {
  id: itemId,
  workspace_id: workspaceId,
  stack_id: stackId,
  stack_revision: 30,
  channel: "bluesky",
  caption: "Foilbury · Pippa in the lantern garden",
  link: sourceLink,
  scheduled_at: scheduledAt,
  state: "shared",
  shared_at: ts,
  created_by: "owner",
  updated_by: "owner",
  revision: 1,
  created_at: ts,
  updated_at: ts,
  destination: "MP personal Bluesky",
  variants: "[]",
};
const approval = {
  item_id: itemId,
  workspace_id: workspaceId,
  channel: "bluesky",
  state: "approved",
  account_handle: handle,
  account_did: did,
  draft_revision: 2,
  approval_revision: 2,
  text_hash: textHash,
  media_hash: mediaHash,
  media_revision: "r7",
  link: sourceLink,
  scheduled_at: scheduledAt,
  binding_hash: bindingHash,
  approved_at: ts,
  expires_at: "2099-02-01T10:30:00.000Z",
  cancelled_at: null,
  revoked_at: null,
  revocation_reason: "",
  created_by: "owner",
  updated_by: "owner",
  created_at: ts,
  updated_at: ts,
};
const delivery = {
  idempotency_key: idempotencyKey,
  item_id: itemId,
  workspace_id: workspaceId,
  channel: "bluesky",
  approval_revision: 2,
  account_handle: handle,
  account_did: did,
  binding_hash: bindingHash,
  text_hash: textHash,
  rkey,
  state: "published",
  attempt: 1,
  provider_uri: providerUri,
  provider_cid: providerCid,
  permalink,
  error_code: "",
  error_message: "",
  claimed_at: ts,
  published_at: ts,
  created_at: ts,
  updated_at: ts,
};

const insert = (table, values) => {
  const columns = Object.keys(values);
  const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
  return db
    .prepare(sql)
    .bind(...Object.values(values))
    .run();
};

const query = async (sql, ...params) =>
  (
    await db
      .prepare(sql)
      .bind(...params)
      .all()
  ).results;

const hashOf = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

let db;
const seed = async () => {
  db = sqliteD1({ schema });
  await db.batch([
    {
      sql: "INSERT INTO creator_workspaces (id, name, created_at) VALUES (?, ?, ?)",
      params: [workspaceId, "Fictional portfolio", ts],
    },
    {
      sql: `INSERT INTO creator_stacks
        (id, workspace_id, slug, name, status, revision, draft_json,
         published_json, published_revision, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        stackId,
        workspaceId,
        "fictional-portfolio",
        "Fictional portfolio",
        30,
        "{}",
        "{}",
        30,
        ts,
        ts,
        ts,
      ],
    },
    {
      sql:
        "INSERT INTO creator_share_calendar_items (" +
        ITEM_COLUMNS.join(",") +
        ") VALUES (" +
        ITEM_COLUMNS.map(() => "?").join(",") +
        ")",
      params: ITEM_COLUMNS.map((c) => item[c]),
    },
    {
      sql:
        "INSERT INTO creator_share_approvals (" +
        APPROVAL_COLUMNS.join(",") +
        ") VALUES (" +
        APPROVAL_COLUMNS.map(() => "?").join(",") +
        ")",
      params: APPROVAL_COLUMNS.map((c) => approval[c]),
    },
    {
      sql:
        "INSERT INTO creator_share_deliveries (" +
        DELIVERY_COLUMNS.join(",") +
        ") VALUES (" +
        DELIVERY_COLUMNS.map(() => "?").join(",") +
        ")",
      params: DELIVERY_COLUMNS.map((c) => delivery[c]),
    },
  ]);
};

test("0037 preserves old approval/published delivery byte-for-byte and keeps FK integrity", async () => {
  await seed();
  try {
    const before = {
      item: (
        await query(
          `SELECT ${ITEM_COLUMNS.join(",")} FROM creator_share_calendar_items WHERE id=?`,
          itemId,
        )
      )[0],
      approval: (
        await query(
          `SELECT ${APPROVAL_COLUMNS.join(",")} FROM creator_share_approvals WHERE item_id=?`,
          itemId,
        )
      )[0],
      delivery: (
        await query(
          `SELECT ${DELIVERY_COLUMNS.join(",")} FROM creator_share_deliveries WHERE idempotency_key=?`,
          idempotencyKey,
        )
      )[0],
    };
    assert.ok(before.item && before.approval && before.delivery);
    const hashes = {
      item: hashOf(before.item),
      approval: hashOf(before.approval),
      delivery: hashOf(before.delivery),
    };

    await db.migrate(migrate);

    const after = {
      item: (
        await query(
          `SELECT ${ITEM_COLUMNS.join(",")} FROM creator_share_calendar_items WHERE id=?`,
          itemId,
        )
      )[0],
      approval: (
        await query(
          `SELECT ${APPROVAL_COLUMNS.join(",")} FROM creator_share_approvals WHERE item_id=?`,
          itemId,
        )
      )[0],
      delivery: (
        await query(
          `SELECT ${DELIVERY_COLUMNS.join(",")} FROM creator_share_deliveries WHERE idempotency_key=?`,
          idempotencyKey,
        )
      )[0],
    };
    assert.deepEqual(
      after,
      before,
      "all prior columns identical in content and order",
    );
    assert.equal(
      hashOf(after.item),
      hashes.item,
      "item id + prior columns unchanged",
    );
    assert.equal(
      hashOf(after.approval),
      hashes.approval,
      "approval hashes/id unchanged",
    );
    assert.equal(
      hashOf(after.delivery),
      hashes.delivery,
      "delivery hashes/id unchanged",
    );
    assert.equal(after.delivery.idempotency_key, idempotencyKey);
    assert.equal(after.delivery.state, "published");
    assert.equal(after.delivery.provider_cid, providerCid);
    assert.equal(after.approval.text_hash, textHash);
    assert.equal(after.approval.binding_hash, bindingHash);

    // Copied rows are stack items with no descriptor.
    const copied = (
      await query(
        "SELECT asset_kind, bluesky_asset FROM creator_share_calendar_items WHERE id=?",
        itemId,
      )
    )[0];
    assert.equal(copied.asset_kind, "stack");
    assert.equal(copied.bluesky_asset, null);

    // Exact FKs survived the rename: item -> stack, children -> renamed parent.
    const itemFks = await query(
      "PRAGMA foreign_key_list('creator_share_calendar_items')",
    );
    assert.ok(
      itemFks.some(
        (fk) =>
          fk.table === "creator_stacks" &&
          fk.from === "stack_id" &&
          fk.on_delete === "CASCADE",
      ),
    );
    for (const child of [
      "creator_share_approvals",
      "creator_share_deliveries",
    ]) {
      const fks = await query(`PRAGMA foreign_key_list('${child}')`);
      assert.ok(
        fks.some(
          (fk) =>
            fk.table === "creator_share_calendar_items" &&
            fk.from === "item_id" &&
            fk.on_delete === "CASCADE",
        ),
        `${child} FK rewritten to final parent`,
      );
    }
    // Exact indexes survived the rename.
    for (const [table, names] of Object.entries({
      creator_share_calendar_items: [
        "creator_share_calendar_schedule",
        "creator_share_calendar_source",
        "creator_share_calendar_destination",
      ],
      creator_share_approvals: ["creator_share_approvals_workspace"],
      creator_share_deliveries: [
        "creator_share_deliveries_item",
        "creator_share_deliveries_state",
      ],
    })) {
      const actual = (await query(`PRAGMA index_list('${table}')`)).map(
        (i) => i.name,
      );
      for (const name of names)
        assert.ok(actual.includes(name), `${table} keeps index ${name}`);
    }

    // No broken references after the rebuild.
    assert.deepEqual(await query("PRAGMA foreign_key_check"), []);

    // A real catalogue/portfolio item without a descriptor is rejected.
    const noDescriptor = {
      ...item,
      id: "portfolio-no-descriptor",
      stack_id: null,
      stack_revision: null,
      asset_kind: "portfolio",
      bluesky_asset: null,
      scheduled_at: null,
      state: "draft",
      shared_at: null,
      destination: "",
      variants: "[]",
    };
    await assert.rejects(
      () => insert("creator_share_calendar_items", noDescriptor),
      /constraint failed/i,
    );

    // A half-stack reference is rejected.
    const halfStack = {
      ...noDescriptor,
      id: "portfolio-half-stack",
      asset_kind: "stack",
      stack_id: stackId,
      bluesky_asset: '{"assetId":"example"}',
    };
    await assert.rejects(
      () => insert("creator_share_calendar_items", halfStack),
      /constraint failed/i,
    );

    // A non-Bluesky portfolio is rejected.
    const nonBluesky = {
      ...noDescriptor,
      id: "portfolio-other-channel",
      bluesky_asset: '{"assetId":"example"}',
      channel: "linkedin",
    };
    await assert.rejects(
      () => insert("creator_share_calendar_items", nonBluesky),
      /constraint failed/i,
    );

    // A valid real portfolio (catalogue) item with a descriptor is accepted.
    const validPortfolio = {
      ...noDescriptor,
      id: "portfolio-valid",
      bluesky_asset: '{"assetId":"example"}',
    };
    await insert("creator_share_calendar_items", validPortfolio);
    const saved = (
      await query(
        "SELECT asset_kind, bluesky_asset, stack_id, stack_revision, channel FROM creator_share_calendar_items WHERE id=?",
        "portfolio-valid",
      )
    )[0];
    assert.deepEqual(saved, {
      asset_kind: "portfolio",
      bluesky_asset: '{"assetId":"example"}',
      stack_id: null,
      stack_revision: null,
      channel: "bluesky",
    });

    // Normal cascading still works after the migration: deleting the stack
    // removes its item and the item's published delivery + approval, while the
    // stackless portfolio item remains.
    await db
      .prepare("DELETE FROM creator_stacks WHERE id=?")
      .bind(stackId)
      .run();
    assert.equal(
      (
        await query(
          "SELECT COUNT(*) AS n FROM creator_share_calendar_items WHERE id=?",
          itemId,
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await query(
          "SELECT COUNT(*) AS n FROM creator_share_approvals WHERE item_id=?",
          itemId,
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await query(
          "SELECT COUNT(*) AS n FROM creator_share_deliveries WHERE idempotency_key=?",
          idempotencyKey,
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await query(
          "SELECT COUNT(*) AS n FROM creator_share_calendar_items WHERE id=?",
          "portfolio-valid",
        )
      )[0].n,
      1,
    );
    assert.deepEqual(await query("PRAGMA foreign_key_check"), []);
  } finally {
    db.cleanup();
  }
});
