import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import {
  configuredBlueskyHandle,
  normalizeBlueskyHandle,
} from "../src/lib/bluesky-account.ts";
import { BLUESKY_APP_PASSWORD_SETTING } from "../src/lib/bluesky-publisher.ts";
import { manageShareConnections } from "../src/lib/share-connections-admin.ts";
import { manageShareCalendar } from "../src/lib/share-calendar-admin.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";

const origin = "https://composer.loftwah.com";
const handle = "trail-notes.bsky.social";
const did = "did:plc:abcdefghijklmnopqrstuvwx";
const appPassword = "abcd-efgh-ijkl-mnop";
const owner = { id: "fictional-share-owner", role: 50 };

const schema = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0031_share_calendar.sql",
  "0032_share_calendar_packages.sql",
  "0034_share_approvals.sql",
  "0035_bluesky_deliveries.sql",
]
  .map(migration)
  .join("\n");

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// An in-memory native settings store with opaque revisions, matching the host
// contract the route relies on. It stores exactly what the route writes; the
// real EmDash store encrypts the declared secret before persisting it.
function memorySettings(initial = {}) {
  let sequence = 0;
  const values = new Map();
  const put = (key, value) => {
    const revision = "rev-" + ++sequence;
    values.set(key, { value, revision });
    return revision;
  };
  for (const [key, value] of Object.entries(initial)) put(key, value);
  return {
    values,
    async getVersioned(key) {
      return values.get(key) ?? null;
    },
    async compareAndSet(key, expected, value) {
      const current = values.get(key) ?? null;
      if ((current?.revision ?? null) !== expected) return { applied: false };
      return { applied: true, revision: put(key, value) };
    },
    async compareAndDelete(key, expected) {
      const current = values.get(key) ?? null;
      if (!current || current.revision !== expected) return { applied: false };
      values.delete(key);
      return { applied: true };
    },
  };
}

function fakeBluesky(options = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (input, init = {}) => {
      const url = String(input);
      const body =
        typeof init.body === "string"
          ? JSON.parse(init.body)
          : init.body
            ? JSON.parse(String(init.body))
            : null;
      calls.push({ url, body });
      if (url.endsWith("/xrpc/com.atproto.server.createSession")) {
        if (options.reject)
          return json(
            {
              error: "InvalidPassword",
              message: "Private provider detail that must never be echoed",
            },
            401,
          );
        return json({
          did,
          handle,
          accessJwt: "access-" + "a".repeat(40),
          refreshJwt: "refresh-" + "b".repeat(40),
        });
      }
      if (url.includes("/xrpc/app.bsky.actor.getProfile")) {
        if (options.profileUnavailable)
          return new Response("{}", { status: 503 });
        return json({
          did,
          handle,
          displayName: "Fictional Trail Notes",
          avatar: "https://cdn.bsky.app/img/avatar/plain/example",
        });
      }
      throw Error("Unexpected network request in a Share connections test");
    },
  };
}

function runtime(db, options = {}) {
  return {
    DB: db,
    PUBLIC_ORIGIN: origin,
    SHARE_BLUESKY_HANDLE: options.configured === false ? undefined : handle,
    fetch: options.fetch,
  };
}

function call(db, settings, value, method = "POST", options = {}) {
  const read = method === "GET";
  return manageShareConnections(
    {
      user: options.user ?? owner,
      input: value,
      settings,
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/" +
          (read ? "shareConnectionsRead" : "shareConnectionsWrite"),
        {
          method,
          headers:
            options.headers ??
            (read
              ? {}
              : {
                  Origin: origin,
                  "X-EmDash-Request": "1",
                  "Content-Type": "application/json",
                }),
        },
      ),
    },
    runtime(db, options),
  );
}

function fakeDelivery(db) {
  const now = "2026-11-17T00:00:00.000Z";
  return (async () => {
    const workspace = await workspaceForUser(db, owner);
    await db
      .prepare(
        "INSERT INTO creator_stacks (id,workspace_id,slug,name,draft_json) VALUES (?,?,?,?,?)",
      )
      .bind(
        "fictional-share-stack",
        workspace.id,
        "fictional-share-stack",
        "Fictional Share Stack",
        "{}",
      )
      .run();
    await db
      .prepare(
        `INSERT INTO creator_share_calendar_items
         (id,workspace_id,stack_id,stack_revision,channel,caption,state,created_by,updated_by,created_at,updated_at)
         VALUES (?,?,?,1,'bluesky','Fictional delivery row','draft',?,?,?,?)`,
      )
      .bind(
        "fictional-share-item",
        workspace.id,
        "fictional-share-stack",
        owner.id,
        owner.id,
        now,
        now,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO creator_share_deliveries
         (idempotency_key,item_id,workspace_id,channel,approval_revision,account_handle,account_did,binding_hash,text_hash,rkey,state,attempt,created_at,updated_at)
         VALUES (?,?,?,'bluesky',1,?,?,?,?,?,'approved',0,?,?)`,
      )
      .bind(
        "fictional-share-delivery-key-01",
        "fictional-share-item",
        workspace.id,
        handle,
        did,
        "a".repeat(64),
        "b".repeat(64),
        "0123456789abcdef0123456789abcdef",
        now,
        now,
      )
      .run();
    return workspace;
  })();
}

test("connecting stores both settings and never returns the app password", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const settings = memorySettings();
    const bluesky = fakeBluesky();
    const result = await call(
      db,
      settings,
      { action: "connect", handle: "@Trail-Notes.bsky.social", appPassword },
      "POST",
      { fetch: bluesky.fetch },
    );
    assert.equal(result.ok, true, result.message);
    assert.equal(result.handle, handle);
    assert.equal(result.handleSource, "stored");
    assert.equal(result.passwordConfigured, true);
    assert.equal(result.identity.status, "resolved");
    assert.equal(result.identity.did, did);
    assert.equal(result.identity.displayName, "Fictional Trail Notes");
    assert.equal(result.identity.publishing.authorised, false);
    assert.equal(result.publishing.state, "connected");
    assert.equal(settings.values.get("SHARE_BLUESKY_HANDLE").value, handle);
    assert.equal(
      settings.values.get(BLUESKY_APP_PASSWORD_SETTING).value,
      appPassword,
    );

    // The provider was contacted once for the session and once for the public
    // profile, with the exact normalized handle.
    assert.equal(bluesky.calls.length, 2);
    assert.match(
      bluesky.calls[0].url,
      /^https:\/\/bsky\.social\/xrpc\/com\.atproto\.server\.createSession$/,
    );
    assert.equal(bluesky.calls[0].body.identifier, handle);
    assert.equal(bluesky.calls[0].body.password, appPassword);
    assert.match(bluesky.calls[1].url, /app\.bsky\.actor\.getProfile/);
    assert.match(bluesky.calls[1].url, /actor=trail-notes\.bsky\.social/);

    const serialised = JSON.stringify(result);
    assert.equal(serialised.includes(appPassword), false);
    assert.equal(serialised.includes("access-"), false);
    assert.equal(serialised.includes("refresh-"), false);
    assert.equal("appPassword" in result, false);
    assert.equal("password" in result, false);
  } finally {
    db.cleanup();
  }
});

test("a rejected Bluesky session stores nothing and returns a safe code", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const settings = memorySettings();
    const bluesky = fakeBluesky({ reject: true });
    const result = await call(
      db,
      settings,
      { action: "connect", handle, appPassword },
      "POST",
      { fetch: bluesky.fetch },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "CREDENTIAL_REJECTED");
    assert.match(result.message, /Bluesky rejected/);
    assert.doesNotMatch(result.message, /Private provider detail/i);
    assert.doesNotMatch(result.message, /InvalidPassword/);
    assert.equal(settings.values.size, 0);
    assert.equal(bluesky.calls.length, 1);
    assert.equal(settings.values.has(BLUESKY_APP_PASSWORD_SETTING), false);
  } finally {
    db.cleanup();
  }
});

test("invalid input is refused before any provider call", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    let fetches = 0;
    const fetch = async () => {
      fetches += 1;
      throw Error("No provider call is allowed for invalid input");
    };
    const settings = memorySettings();
    const rejected = [
      { action: "connect", handle: "not a handle", appPassword },
      { action: "connect", handle: "owner.bsky.social/path", appPassword },
      { action: "connect", handle, appPassword: "a".repeat(513) },
      { action: "connect", handle, appPassword: "abcd-efgh\nijkl" },
      { action: "connect", handle, appPassword: "abcd efgh ijkl" },
      { action: "connect", handle, appPassword: "short" },
      { action: "connect", handle, appPassword, workspace: "extra" },
      { action: "connect", handle },
    ];
    for (const value of rejected) {
      const result = await call(db, settings, value, "POST", { fetch });
      assert.equal(result.ok, false, JSON.stringify(value));
      assert.equal(result.code, "INVALID");
      assert.equal(settings.values.size, 0);
    }
    assert.equal(fetches, 0);
    // The same bounds the send reader uses: 8–512 trimmed characters and no
    // control or whitespace bytes.
    assert.equal(normalizeBlueskyHandle(handle), handle);
  } finally {
    db.cleanup();
  }
});

test("the status read reports a stored connection without the password", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const settings = memorySettings({
      SHARE_BLUESKY_HANDLE: handle,
      [BLUESKY_APP_PASSWORD_SETTING]: appPassword,
    });
    const bluesky = fakeBluesky();
    const status = await call(db, settings, {}, "GET", {
      fetch: bluesky.fetch,
    });
    assert.equal(status.ok, true);
    assert.equal(status.handle, handle);
    assert.equal(status.handleSource, "stored");
    assert.equal(status.passwordConfigured, true);
    assert.equal(status.identity.status, "resolved");
    assert.equal(status.publishing.state, "connected");
    assert.equal("appPassword" in status, false);
    assert.equal(JSON.stringify(status).includes(appPassword), false);
    assert.equal(bluesky.calls.length, 1);
    assert.doesNotMatch(bluesky.calls[0].url, /createSession/);
  } finally {
    db.cleanup();
  }
});

test("disconnect removes both settings and keeps delivery receipts", async () => {
  const db = sqliteD1({ schema });
  try {
    await fakeDelivery(db);
    const settings = memorySettings({
      SHARE_BLUESKY_HANDLE: handle,
      [BLUESKY_APP_PASSWORD_SETTING]: appPassword,
    });
    const result = await call(db, settings, { action: "disconnect" }, "POST", {
      configured: false,
    });
    assert.equal(result.ok, true, result.message);
    assert.equal(settings.values.size, 0);
    assert.equal(result.handle, null);
    assert.equal(result.handleSource, "none");
    assert.equal(result.passwordConfigured, false);
    assert.equal(result.publishing.state, "not_configured");
    const deliveries = await db
      .prepare("SELECT COUNT(*) AS count FROM creator_share_deliveries")
      .first();
    assert.equal(deliveries.count, 1);
  } finally {
    db.cleanup();
  }
});

test("an invalid stored handle is reported instead of being silently replaced", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const settings = memorySettings({
      SHARE_BLUESKY_HANDLE: "not a handle",
      [BLUESKY_APP_PASSWORD_SETTING]: appPassword,
    });
    const result = await call(db, settings, {}, "GET");
    assert.equal(result.ok, true);
    assert.equal(result.handle, null);
    assert.equal(result.handleSource, "stored");
    assert.equal(result.identity.status, "invalid_handle");
    assert.equal(result.publishing.state, "invalid_handle");
  } finally {
    db.cleanup();
  }
});

test("the stored handle overrides the runtime fallback for the share calendar", async () => {
  assert.equal(configuredBlueskyHandle({}), null);
  assert.equal(
    configuredBlueskyHandle({
      SHARE_BLUESKY_HANDLE: "@Trail-Notes.bsky.social",
    }),
    handle,
  );
  assert.equal(
    configuredBlueskyHandle(
      { SHARE_BLUESKY_HANDLE: "@Trail-Notes.bsky.social" },
      "owner.bsky.social",
    ),
    "owner.bsky.social",
  );
  assert.equal(
    configuredBlueskyHandle({ SHARE_BLUESKY_HANDLE: handle }, null),
    handle,
  );
  assert.equal(
    configuredBlueskyHandle({ SHARE_BLUESKY_HANDLE: handle }, ""),
    null,
  );
  assert.equal(
    configuredBlueskyHandle({ SHARE_BLUESKY_HANDLE: handle }, "not a handle"),
    null,
  );

  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const command = { action: "list" };
    const request = () =>
      new Request(
        origin + "/_emdash/api/plugins/composer-stacks/shareCalendarRead",
        { method: "GET" },
      );
    const stored = await manageShareCalendar(
      {
        user: owner,
        input: command,
        settings: memorySettings({ SHARE_BLUESKY_HANDLE: "owner.bsky.social" }),
        request: request(),
      },
      runtime(db),
    );
    assert.equal(stored.ok, true);
    assert.equal(stored.bluesky.configuredHandle, "owner.bsky.social");

    const fallback = await manageShareCalendar(
      {
        user: owner,
        input: command,
        settings: memorySettings(),
        request: request(),
      },
      runtime(db),
    );
    assert.equal(fallback.ok, true);
    assert.equal(fallback.bluesky.configuredHandle, handle);
  } finally {
    db.cleanup();
  }
});

test("the connection boundary refuses anything but an owner administrator request", async () => {
  const db = sqliteD1({ schema });
  try {
    await workspaceForUser(db, owner);
    const settings = memorySettings();
    const forbidden = { Origin: origin, "X-EmDash-Request": "1" };

    const wrongRole = await call(db, settings, {}, "GET", {
      user: { id: owner.id, role: 20 },
    });
    assert.equal(wrongRole.code, "FORBIDDEN");

    const bearer = await call(db, settings, { action: "disconnect" }, "POST", {
      headers: { ...forbidden, Authorization: "Bearer fictional" },
    });
    assert.equal(bearer.code, "FORBIDDEN");

    const noMarker = await call(
      db,
      settings,
      { action: "disconnect" },
      "POST",
      {
        headers: { Origin: origin },
      },
    );
    assert.equal(noMarker.code, "FORBIDDEN");

    const foreignOrigin = await manageShareConnections(
      {
        user: owner,
        input: {},
        settings,
        request: new Request(
          "https://preview.example/_emdash/api/plugins/composer-stacks/shareConnectionsRead",
          { method: "GET" },
        ),
      },
      runtime(db),
    );
    assert.equal(foreignOrigin.code, "FORBIDDEN");
    assert.equal(settings.values.size, 0);
  } finally {
    db.cleanup();
  }
});

test("the plugin registers the page, both routes and the non-secret handle", () => {
  const definition = creatorPlugin("fictional-admin-entry", {});
  const page = definition.admin.pages.find(
    (entry) => entry.path === "/share-connections",
  );
  assert.ok(page);
  assert.equal(page.label, "Share connections");
  assert.equal(page.icon, "plugs");

  const read = definition.routes.shareConnectionsRead;
  const write = definition.routes.shareConnectionsWrite;
  assert.deepEqual(read.methods, ["GET"]);
  assert.equal(read.permission, "plugins:manage");
  assert.deepEqual(write.methods, ["POST"]);
  assert.equal(write.permission, "plugins:manage");
  assert.equal(write.request.body, "json");
  assert.equal(write.request.maxBytes, 4000);
  assert.equal(
    definition.admin.settingsSchema.SHARE_BLUESKY_HANDLE.type,
    "string",
  );
  assert.equal(
    definition.admin.settingsSchema[BLUESKY_APP_PASSWORD_SETTING].type,
    "secret",
  );

  const entry = readFileSync(
    new URL("../src/plugins/stacks-admin.tsx", import.meta.url),
    "utf8",
  );
  assert.match(entry, /"\/share-connections": ShareConnectionsPage/);

  const pageSource = readFileSync(
    new URL("../src/plugins/share-connections-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /type="password"/);
  assert.match(pageSource, /autoComplete="off"/);
  assert.match(pageSource, /setAppPassword\(""\)/);
  assert.doesNotMatch(pageSource, /console\./);
  assert.doesNotMatch(pageSource, /appPassword[^\n]{0,80}URLSearchParams/);
  assert.match(pageSource, /Bluesky Settings → App Passwords/);
});
