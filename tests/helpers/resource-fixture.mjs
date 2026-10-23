import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { appSettings } from "../../src/lib/app-settings.mjs";
import { createStack, saveStack } from "../../src/lib/stacks.mjs";
import { manageStacks } from "../../src/lib/stacks-admin.mjs";

export const origin = "https://composer.loftwah.com",
  account = "1003dc1d93af0ebea56b2f1252f89627";
export const user = {
  id: "fictional-creator-0001",
  name: "Fictional creator",
  role: 50,
};
export const settings = (title, patch = {}) => ({
  title,
  intro: "Fictional only",
  theme: "midnight",
  layout: "grid",
  guestAccess: "closed",
  ...patch,
});
export const instance = (id, title) => ({
  id,
  app: "guestbook",
  label: title,
  caption: "",
  visible: true,
  binding: { mode: "own", shareOf: null },
  config: settings(title),
});
export const document = (name, instances) => ({
  version: 1,
  name,
  description: "",
  theme: "midnight",
  instances,
});

// This double models only the independently tested HTTP contract. Composer's
// real D1 transaction/CAS/journal behaviour runs against FK-enabled SQLite.
function appContract() {
  const resources = new Map(),
    operations = new Map(),
    writes = [],
    items = new Map();
  let afterWrite,
    badBuild = false,
    malformed = false;
  let source = appSettings.guestbook.source.commit;
  const reply = (row, candidate = row.active) => ({
    contract: 1,
    outcome: "applied",
    resource: {
      id: row.id,
      workspace: row.workspace,
      account,
      environment: "production",
      target: origin + "/guestbook",
      version: row.version,
      activeRevision: row.active?.revision ?? null,
      visible: row.visible ?? true,
      paused: row.paused ?? false,
    },
    configuration: candidate ?? null,
  });
  const send = async (request) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/build.json"))
      return Response.json({
        app: "guestbook",
        revision: badBuild ? "b".repeat(40) : source,
        dataVersion: 1,
        resourceContract: 1,
        resourcesEnabled: true,
        resourceAccount: account,
        resourceEnvironment: "production",
      });
    assert.equal(
      request.headers.get("Authorization"),
      "Bearer fictional-owner-token",
    );
    assert.equal(request.headers.get("X-Composer-Account"), account);
    assert.equal(request.headers.get("X-Composer-Environment"), "production");
    assert.equal(request.headers.get("X-Composer-Source"), source);
    assert.equal(
      request.headers.get("X-Composer-Target"),
      origin + "/guestbook",
    );
    const segments = url.pathname.split("/");
    const id = segments[4],
      workspace = request.headers.get("X-Composer-Workspace");
    const resource = resources.get(id);
    if (request.method === "GET") {
      const operation = url.searchParams.get("operation");
      if (resource && resource.workspace !== workspace)
        return new Response(null, { status: 403 });
      if (operation)
        return Response.json({
          contract: 1,
          recorded: operations.has(operation),
          result: operations.get(operation),
          current: resource ?? null,
        });
      if (segments[5] === "export" && resource)
        return Response.json({
          contract: 1,
          format: "guestbook.resource-export/v1",
          resource: {
            id,
            workspace_id: workspace,
            account_id: account,
            environment: "production",
            target: origin + "/guestbook",
            version: resource.version,
          },
          configurations: [],
          items: [...items.values()]
            .filter((item) => item.resource === id)
            .map(({ resource, png, ...item }) => item),
        });
      if (segments[5] === "media") {
        const item = items.get(segments[6]);
        return item?.resource === id && item.status !== "deleted"
          ? new Response(Buffer.from(item.png, "base64"), {
              headers: { "Content-Type": "image/png" },
            })
          : new Response(null, { status: 404 });
      }
      return resource
        ? Response.json(reply(resource))
        : new Response(null, { status: 404 });
    }
    const command = await request.json();
    writes.push({ id, command });
    if (operations.has(command.operationId))
      return Response.json(operations.get(command.operationId));
    let row = resource;
    if (command.action === "create") {
      if (row) return new Response(null, { status: 409 });
      row = {
        id,
        workspace,
        version: 0,
        active: null,
        configurations: new Map(),
      };
      resources.set(id, row);
    } else {
      if (
        !row ||
        row.workspace !== workspace ||
        row.version !== command.expectedVersion
      )
        return new Response(null, { status: 409 });
      if (command.action === "stage") {
        const digest = createHash("sha256")
          .update(JSON.stringify(command.configuration))
          .digest("hex");
        row.configurations.set(row.version + 1, {
          revision: row.version + 1,
          digest,
          source,
          values: command.configuration,
        });
      } else if (command.action === "activate") {
        const selected = row.configurations.get(command.configurationRevision);
        if (!selected || selected.digest !== command.configurationDigest)
          return new Response(null, { status: 409 });
        row.active = selected;
      } else if (command.action === "moderate") {
        const item = items.get(command.item);
        if (
          !item ||
          item.resource !== id ||
          item.revision !== command.itemRevision ||
          item.status === "deleted"
        )
          return new Response(null, { status: 409 });
        item.status = command.status;
        item.revision++;
      } else if (command.action === "control") {
        row.visible = command.visible;
        row.paused = command.paused;
      }
      row.version++;
    }
    const result = reply(
      row,
      command.action === "stage"
        ? row.configurations.get(row.version)
        : row.active,
    );
    operations.set(command.operationId, result);
    if (afterWrite) await afterWrite({ id, command, row });
    return malformed ? Response.json({ ok: true }) : Response.json(result);
  };
  return {
    fetch: send,
    resources,
    operations,
    writes,
    items,
    afterWrite(fn) {
      afterWrite = fn;
    },
    source(value) {
      source = value;
    },
    badBuild(value) {
      badBuild = value;
    },
    malformed(value) {
      malformed = value;
    },
  };
}

export function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of [
    "0003_stacks.sql",
    "0004_stack_publications.sql",
    "0005_stack_publications_backfill.sql",
    "0006_stack_resources.sql",
    "0011_platform_requests.sql",
    "0007_resource_moderation.sql",
  ])
    sqlite.exec(
      readFileSync(
        new URL("../../migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  let beforeBatch;
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind(...values) {
      return statement(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      if (beforeBatch) await beforeBatch(statements);
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(({ sql, params }) => ({
          success: true,
          results: sqlite.prepare(sql).all(...params),
        }));
        sqlite.exec("COMMIT");
        return results;
      } catch (failure) {
        sqlite.exec("ROLLBACK");
        throw failure;
      }
    },
  };
  const app = appContract();
  const runtime = {
    DB: db,
    PUBLIC_ORIGIN: origin,
    RESOURCE_ACCOUNT_ID: account,
    RESOURCE_ENVIRONMENT: "production",
    GUESTBOOK_OWNER_TOKEN: "fictional-owner-token",
    GUESTBOOK: app,
  };
  const route = (command, reading = false, caller = user) =>
    manageStacks(
      {
        user: caller,
        input: command,
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/" +
            (reading ? "read" : "write"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      runtime,
    );
  return {
    sqlite,
    db,
    app,
    runtime,
    route,
    beforeBatch(fn) {
      beforeBatch = fn;
    },
    close() {
      sqlite.close();
    },
  };
}
export async function saved(f, workspace, name, instances) {
  const stack = await createStack(f.db, workspace, name);
  return saveStack(
    f.db,
    workspace,
    stack.id,
    document(name, instances),
    stack.revision,
  );
}
