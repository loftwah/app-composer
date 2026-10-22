import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  saved,
  user,
  instance,
  origin,
  account,
} from "./helpers/resource-fixture.mjs";
import { workspaceForUser, publishStack } from "../src/lib/stacks.mjs";
import {
  applyStackResources,
  resourcePublication,
} from "../src/lib/stack-resources.ts";
import {
  manageEnquiries,
  publicationEnquiry,
} from "../src/lib/private-enquiries.ts";
import {
  publishedEnquiry,
  publicEnquiryRequest,
} from "../src/lib/public-enquiries.ts";
import { appSettings } from "../src/lib/app-settings.mjs";
import { resourceConnection } from "../src/lib/resource-client.ts";
const source = appSettings.guestbook.source.commit;
const { enquiryModel } = await import("../src/enquiries/enquiry-model.ts");
const model = enquiryModel();
async function prepared() {
  const f = fixture(),
    space = await workspaceForUser(f.db, user),
    draft = await saved(f, space.id, "Fictional private enquiries", [
      instance("fictional-enquiry-instance", "Fictional enquiry book"),
    ]);
  const applied = await applyStackResources(
      f.db,
      user.id,
      space.id,
      draft.id,
      draft.revision,
      f.runtime,
    ),
    resource = applied.resources[0].resource,
    document = await resourcePublication(
      f.db,
      space.id,
      draft.id,
      applied.stack.draft,
      f.runtime,
    ),
    published = await publishStack(
      f.db,
      space.id,
      draft.id,
      applied.stack.revision,
      document,
      user.id,
    );
  let handler;
  const original = f.app.fetch;
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.includes("/enquiries")) return handler(request);
      return original(request);
    },
  };
  const route = (input, reading = false, caller = { ...user, role: 20 }) =>
    manageEnquiries(
      {
        input,
        user: caller,
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/" +
            (reading ? "enquiriesRead" : "enquiriesWrite"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      f.runtime,
    );
  const row = () => ({
    id: resource,
    workspace_id: space.id,
    account_id: account,
    environment: "production",
    target: origin + "/guestbook",
    version: 2,
    active_revision: 1,
  });
  return {
    ...f,
    space,
    published,
    resource,
    route,
    row,
    handler(value) {
      handler = value;
    },
  };
}
const inbox = (f, patch = {}) => ({
  contract: 1,
  format: "guestbook.enquiry-inbox/v1",
  source,
  resource: f.row(),
  status: "pending",
  page: 1,
  limit: 20,
  retentionDays: 30,
  notifications: false,
  items: [],
  scopes: [],
  ...patch,
});
test("private inbox is role20 plus current workspace editor authority, rejects foreign resource and bounded-filter spoofing", async () => {
  const f = await prepared();
  try {
    let reads = 0;
    f.handler(() => {
      reads++;
      return Response.json(inbox(f));
    });
    const selected = {
      action: "inbox",
      workspace: f.space.id,
      resource: f.resource,
    };
    const valid = await f.route(selected, true);
    assert.equal(valid.ok, true, valid.message);
    assert.equal(valid.inbox.items.length, 0);
    assert.equal(
      (await f.route({ ...selected, resource: "foreign-resource" }, true)).ok,
      false,
    );
    assert.equal(reads, 1);
    assert.equal(
      (await f.route({ ...selected, page: "999999" }, true)).code,
      "INVALID",
    );
    assert.equal(
      (await f.route(selected, true, { ...user, role: 10 })).code,
      "FORBIDDEN",
    );
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(f.space.id, user.id);
    assert.equal((await f.route(selected, true)).code, "FORBIDDEN");
    assert.equal(reads, 1);
  } finally {
    f.close();
  }
});
test("page summary counts retained briefs by exact publication scope without returning private text", async () => {
  const f = await prepared();
  try {
    const publication = {
        kind: "composer.publication",
        resource: f.resource,
        configuration: 1,
        stack: f.published.id,
        publication: f.published.publishedRevision,
        instance: "fictional-enquiry-instance",
      },
      standalone = {
        kind: "standalone",
        resource: f.resource,
        configuration: 1,
      },
      item = (id, provenance, status, created_at) => ({
        id,
        scope_key: "c".repeat(64),
        configuration_revision: 1,
        provenance,
        model_version: 1,
        producer_source: source,
        values: {
          title: "Fictional private title",
          goal: "Fictional private goal that must not enter the summary.",
          starting_point: "New idea",
          deliverables: [],
        },
        consent_version: 1,
        consent_at: "2026-10-20 09:00:00",
        status,
        revision: 1,
        created_at,
        expires_at: "2026-11-19 09:00:00",
      });
    f.handler(() =>
      Response.json({
        contract: 1,
        format: "guestbook.private-enquiries/v1",
        source,
        resource: f.row(),
        retentionDays: 30,
        items: [
          item(
            "fictional-item-one",
            publication,
            "reviewed",
            "2026-10-20 10:00:00",
          ),
          item(
            "fictional-item-two",
            publication,
            "reviewed",
            "2026-10-21 10:00:00",
          ),
          item(
            "fictional-item-three",
            standalone,
            "pending",
            "2026-10-19 10:00:00",
          ),
        ],
        covers: {
          privateBodies: true,
          consent: true,
          provenance: true,
          notifications: false,
          credentials: false,
        },
        scope: "current-resource-only",
      }),
    );
    const result = await f.route(
      { action: "summary", workspace: f.space.id, resource: f.resource },
      true,
    );
    assert.equal(result.ok, true, result.message);
    assert.equal(result.summary.total, 3);
    assert.equal(result.summary.groups.length, 2);
    const published = result.summary.groups.find(
      (group) => group.kind === "composer.publication",
    );
    assert.deepEqual(
      {
        reviewed: published.reviewed,
        pending: published.pending,
        total: published.total,
        stack: published.stack,
        instance: published.instance,
        publication: published.publication,
      },
      {
        reviewed: 2,
        pending: 0,
        total: 2,
        stack: f.published.id,
        instance: "fictional-enquiry-instance",
        publication: f.published.publishedRevision,
      },
    );
    assert.equal(
      result.summary.groups.find((group) => group.kind === "standalone")
        .pending,
      1,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /Fictional private goal|Fictional private title/,
    );
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(f.space.id, user.id);
    assert.equal(
      (
        await f.route(
          { action: "summary", workspace: f.space.id, resource: f.resource },
          true,
        )
      ).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});

test("a permission change during source verification prevents the credential-bearing private write", async () => {
  const f = await prepared();
  try {
    const original = f.runtime.GUESTBOOK.fetch;
    let writes = 0,
      builds = 0;
    f.runtime.GUESTBOOK = {
      async fetch(request) {
        if (request.url.endsWith("/build.json")) {
          const response = await original(request);
          builds++;
          if (builds === 1)
            f.sqlite
              .prepare(
                "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
              )
              .run(f.space.id, user.id);
          return response;
        }
        if (request.method === "POST") writes++;
        return original(request);
      },
    };
    f.handler(() => {
      throw Error("Must not dispatch after access changed");
    });
    const result = await f.route({
      action: "review",
      workspace: f.space.id,
      resource: f.resource,
      source,
      operation: crypto.randomUUID(),
      item: "fictional-private-item",
      expectedVersion: 2,
      expectedRevision: 1,
    });
    assert.equal(result.code, "FORBIDDEN");
    assert.equal(writes, 0);
  } finally {
    f.close();
  }
});
test("owner form configuration verifies exact source, app version and immutable publication; malformed ACK stays unknown", async () => {
  const f = await prepared();
  try {
    const operation = crypto.randomUUID();
    let writes = 0;
    const selected = await publicationEnquiry(
      f.db,
      f.published.slug,
      "fictional-enquiry-instance",
    );
    assert(selected);
    f.handler(async (request) => {
      writes++;
      const value = await request.json();
      assert.equal(value.scope.stack, f.published.id);
      assert.equal(value.scope.publication, f.published.publishedRevision);
      return Response.json({ ok: true });
    });
    const command = {
      action: "configure",
      workspace: f.space.id,
      resource: f.resource,
      source,
      operation,
      expectedVersion: 2,
      expectedScopeRevision: 0,
      enabled: true,
      mode: "publication",
      stack: f.published.id,
      instance: "fictional-enquiry-instance",
      publication: f.published.publishedRevision,
    };
    assert.equal(
      (await f.route({ ...command, source: "b".repeat(40) })).code,
      "CONFLICT",
    );
    assert.equal(writes, 0);
    assert.equal(
      (await f.route({ ...command, publication: command.publication + 1 }))
        .code,
      "CONFLICT",
    );
    assert.equal(writes, 0);
    const malformed = await f.route(command);
    assert.equal(malformed.code, "UNKNOWN");
    assert.equal(writes, 1);
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
      )
      .run(f.space.id, user.id);
    assert.equal((await f.route(command)).code, "FORBIDDEN");
    assert.equal(writes, 1);
  } finally {
    f.close();
  }
});
test("public broker derives scope server-side, gives only bounded receipts and refuses closure after awaited metadata", async () => {
  const f = await prepared();
  try {
    const selected = await publicationEnquiry(
        f.db,
        f.published.slug,
        "fictional-enquiry-instance",
      ),
      intent = crypto.randomUUID();
    let delivered = 0,
      closeDuringBuild = false,
      builds = 0;
    f.handler(async (request) => {
      const command = await request.json();
      if (command.action === "form")
        return Response.json({
          contract: 1,
          format: "guestbook.enquiry-form/v1",
          source,
          open: true,
          scope: {
            key: "c".repeat(64),
            revision: 1,
            provenance: selected.scope,
          },
          model,
          retentionDays: 30,
          receiptDays: 35,
          delivery: "private-workspace-only",
          notifications: false,
          contacts: false,
          uploads: false,
        });
      delivered++;
      assert.deepEqual(command.scope, {
        kind: "composer.publication",
        configuration: selected.scope.configuration,
        stack: selected.scope.stack,
        publication: selected.scope.publication,
        instance: selected.scope.instance,
      });
      return Response.json({ contract: 1, intent, received: true });
    });
    const form = await publishedEnquiry(
      f.runtime,
      f.published.slug,
      "fictional-enquiry-instance",
    );
    assert.equal(form.selected.key, selected.key);
    const body = {
      contract: 1,
      intent,
      values: {
        title: "Fictional brief",
        goal: "Invented only",
        starting_point: "New idea",
        deliverables: [],
      },
      consent: true,
    };
    const request = (value) =>
      new Request(
        `${origin}/s/${f.published.slug}/enquiry/fictional-enquiry-instance/submit`,
        {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            "X-Guestbook-Enquiry-Source": source,
            "X-Guestbook-Enquiry-Target": origin,
            "X-Composer-Enquiry-Key": selected.key,
            "CF-Connecting-IP": "192.0.2.90",
          },
          body: JSON.stringify(value),
        },
      );
    const response = await publicEnquiryRequest(
      request(body),
      f.runtime,
      f.published.slug,
      "fictional-enquiry-instance",
      "submit",
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      contract: 1,
      intent,
      received: true,
    });
    assert.equal(delivered, 1);
    const spoof = await publicEnquiryRequest(
      request({ ...body, workspace: "foreign-workspace" }),
      f.runtime,
      f.published.slug,
      "fictional-enquiry-instance",
      "submit",
    );
    assert.notEqual(spoof.status, 201);
    assert.equal(delivered, 1);
    const original = f.runtime.GUESTBOOK.fetch;
    f.runtime.GUESTBOOK = {
      async fetch(req) {
        if (req.url.endsWith("/build.json")) {
          builds++;
          if (closeDuringBuild && builds === 2)
            f.sqlite
              .prepare("UPDATE creator_stacks SET status='draft' WHERE id=?")
              .run(f.published.id);
        }
        return original(req);
      },
    };
    closeDuringBuild = true;
    const closed = await publicEnquiryRequest(
      request(body),
      f.runtime,
      f.published.slug,
      "fictional-enquiry-instance",
      "submit",
    );
    assert.equal(closed.status, 409);
    assert.equal(delivered, 1);
  } finally {
    f.close();
  }
});
test("a public form key changes when a slug is reassigned; historical receipts never return private text", async () => {
  const f = await prepared();
  try {
    const before = await publicationEnquiry(
      f.db,
      f.published.slug,
      "fictional-enquiry-instance",
    );
    assert(before);
    f.sqlite
      .prepare("UPDATE creator_stacks SET slug=? WHERE id=?")
      .run("moved-fictional", f.published.id);
    assert.equal(
      await publicationEnquiry(
        f.db,
        f.published.slug,
        "fictional-enquiry-instance",
      ),
      null,
    );
    // A new stack can deliberately take the released name, but cannot inherit
    // the old publication's delivery authority even with the same app resource.
    const replacement = await saved(f, f.space.id, "Fictional replacement", [
      instance("fictional-enquiry-instance", "Fictional replacement book"),
    ]);
    f.sqlite
      .prepare("UPDATE creator_stacks SET slug=? WHERE id=?")
      .run(f.published.slug, replacement.id);
    await publishStack(
      f.db,
      f.space.id,
      replacement.id,
      replacement.revision,
      f.published.published,
      user.id,
    );
    const after = await publicationEnquiry(
      f.db,
      f.published.slug,
      "fictional-enquiry-instance",
    );
    assert(after);
    assert.notEqual(after.scope.stack, before.scope.stack);
    assert.notEqual(after.key, before.key);
    const operation = crypto.randomUUID();
    f.handler(() =>
      Response.json({
        contract: 1,
        recorded: true,
        result: {
          contract: 1,
          format: "guestbook.enquiry-operation/v1",
          operation,
          action: "review",
          outcome: "applied",
          source: "b".repeat(40),
          resource: {
            id: f.resource,
            workspace: f.space.id,
            account,
            environment: "production",
            target: origin + "/guestbook",
            version: 3,
          },
          scope: null,
          item: {
            id: "fictional-private-item",
            status: "reviewed",
            revision: 2,
          },
        },
      }),
    );
    const receipt = await f.route(
      {
        action: "receipt",
        workspace: f.space.id,
        resource: f.resource,
        operation,
      },
      true,
    );
    assert.equal(receipt.ok, true, receipt.message);
    assert.equal(receipt.receipt.result.source, "b".repeat(40));
    assert(!JSON.stringify(receipt).includes("values"));
  } finally {
    f.close();
  }
});

test("the checked enquiry transport refuses a write without the current-authority callback", async () => {
  const f = await prepared();
  try {
    let dispatched = 0;
    f.handler(() => {
      dispatched++;
      return Response.json({});
    });
    await assert.rejects(
      () =>
        resourceConnection(f.runtime, f.space.id).enquiry(f.resource, "", {
          action: "review",
        }),
      /current workspace\/publication guard/,
    );
    assert.equal(dispatched, 0);
  } finally {
    f.close();
  }
});
