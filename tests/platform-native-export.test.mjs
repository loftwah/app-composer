import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { qualifyNativeApprovedExport } from "../labs/platform/native-export.mjs";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { manageMaintenance } from "../src/lib/creator-maintenance.ts";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { appSettings } from "../src/lib/app-settings.mjs";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const localAccount = "00000000000000000000000000000001";

// The production-shaped route fixture exercises real Composer SQLite and route
// guards. Its app HTTP contract and browser transport are labelled doubles; only
// metadata is remapped to the local lab scope. This is not native/workerd proof.
async function exercise(kind, verify) {
  const owned = await mkdtemp(join(tmpdir(), "composer-native-export-test-"));
  const f = fixture();
  try {
    const root = join(owned, "composer-invited-test");
    await mkdir(join(root, "composer"), { recursive: true });
    await writeFile(
      join(root, "composer/wrangler.local.jsonc"),
      JSON.stringify({
        name: "composer-invited-composer",
        main: "./lab-entry.ts",
        workers_dev: false,
        preview_urls: false,
        routes: [],
        vars: {
          RESOURCE_ACCOUNT_ID: localAccount,
          RESOURCE_ENVIRONMENT: "local",
        },
        services: [
          { binding: "GUESTBOOK", service: "composer-invited-guestbook" },
        ],
      }),
    );
    f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
    const workspace = (await workspaceForUser(f.db, user)).id;
    const platform = (input) =>
      managePlatform(
        {
          user,
          input: { workspace, ...input },
          request: new Request(
            origin + "/_emdash/api/plugins/composer-stacks/platformWrite",
            {
              method: "POST",
              headers: { Origin: origin, "X-EmDash-Request": "1" },
            },
          ),
        },
        f.runtime,
      );
    assert.equal(
      (
        await platform({
          action: "configure",
          expectedRevision: 0,
          profile: {
            enabled: true,
            allowMemberContributions: true,
            reviewRequired: false,
            allowedRecipes: ["guestbook"],
            environments: ["preview"],
            dataClasses: ["synthetic"],
            maxApplications: 2,
          },
        })
      ).ok,
      true,
    );
    const submitted = await platform({
      action: "submit",
      key: crypto.randomUUID(),
      request: {
        version: 1,
        name: "Fictional export qualification",
        recipe: "guestbook",
        environment: "preview",
        dataClass: "synthetic",
        location: "provider-default",
        quota: "small",
        contributions: "members",
      },
    });
    const request = submitted.requests[0];
    assert.equal(request.status, "complete");
    const selected = request.resources[0];
    const teamA = {
      workspace,
      request: request.id,
      stack: request.stackId,
      instance: selected.instance,
      resource: selected.resource,
    };
    const item = {
      id: "fictional-retained-approved",
      revision: 2,
      caption: "Never retain this caption in evidence",
      author: "Private fictional author",
      synthetic: 1,
      createdAt: "2026-10-18 10:00:00",
      media: {
        type: "image/png",
        sha256: sha(Buffer.from(png, "base64")),
        base64: png,
      },
    };
    const source = appSettings.guestbook.source.commit;
    const service = f.app.fetch;
    f.runtime.GUESTBOOK = {
      async fetch(request) {
        if (request.url.endsWith("/portable")) {
          const row = f.app.resources.get(teamA.resource);
          return Response.json({
            format: "guestbook.approved-portable/v1",
            contract: 1,
            exportedAt: new Date().toISOString(),
            source: {
              app: "guestbook",
              build: source,
              resource: teamA.resource,
              workspace,
              account: f.runtime.RESOURCE_ACCOUNT_ID,
              environment: "production",
              target: origin + "/guestbook",
              version: row.version,
            },
            configuration: row.active,
            items: [item],
            coverage: {
              approvedOriginals: 1,
              included: 1,
              complete: true,
              maximumItems: 8,
              privateContent: false,
              credentials: false,
              restoredCopies: false,
            },
            rights:
              "No new licence is granted. Retain contributor consent and confirm your permission to copy.",
            limitation:
              "Requires this live source authority. Restores are private, fresh copies; not offline or cross-account disaster recovery.",
          });
        }
        const response = await service(request);
        return request.url.endsWith("/build.json")
          ? Response.json({
              ...(await response.json()),
              portabilityContract: 1,
            })
          : response;
      },
    };
    let exports = 0;
    const paths = [];
    const fetch = async (path, options) => {
      paths.push(path);
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.redirect, "error");
      const url = new URL(path, origin),
        fields = Object.fromEntries(url.searchParams);
      let result;
      if (url.pathname === "/_emdash/api/auth/me")
        result = { id: user.id, role: 50 };
      else if (url.pathname.endsWith("/platformRead")) {
        result = await managePlatform(
          { user, input: fields, request: new Request(origin + path) },
          f.runtime,
        );
        for (const entry of result.requests ?? [])
          entry.plan.target = {
            account: localAccount,
            environment: "local",
            url: origin + "/guestbook",
          };
        if (result.setup?.target)
          result.setup.target = {
            account: localAccount,
            environment: "local",
            url: origin + "/guestbook",
          };
      } else if (url.pathname.endsWith("/maintenanceRead")) {
        result = await manageMaintenance(
          { user, input: fields, request: new Request(origin + path) },
          f.runtime,
        );
        assert.equal(result.ok, true, JSON.stringify(result));
        if (fields.action === "check") {
          for (const scope of [result.check.expected, result.check.actual])
            if (scope)
              Object.assign(scope, {
                account: localAccount,
                environment: "local",
              });
        } else {
          exports++;
          Object.assign(result.portable.source, {
            account: localAccount,
            environment: "local",
          });
          if (kind === "foreign-resource")
            result.portable.source.resource = "fictional-foreign-resource";
          if (kind === "foreign-source")
            result.portable.source.build = "f".repeat(40);
          if (kind === "private-coverage")
            result.portable.coverage.privateContent = true;
          if (kind === "false-media-digest")
            result.portable.items[0].media.sha256 = "0".repeat(64);
          if (kind === "missing-item")
            result.portable.items[0].id = "fictional-unrelated-item";
          if (kind === "non-synthetic") result.portable.items[0].synthetic = 0;
          if (kind === "stack-drift")
            f.sqlite
              .prepare(
                "UPDATE creator_stacks SET revision=revision+1 WHERE id=?",
              )
              .run(teamA.stack);
          if (kind === "revoked-owner")
            f.sqlite
              .prepare(
                "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
              )
              .run(workspace, user.id);
        }
      } else result = await f.route(fields, true);
      const text =
        kind === "oversized" && fields.action === "export"
          ? " ".repeat(1200001)
          : JSON.stringify(result);
      return new Response(text, {
        headers: {
          "Content-Type": "application/json",
          "x-composer-isolated-lab":
            kind === "wrong-bridge" ? "another-lab" : "composer-invited-test",
        },
      });
    };
    const page = {
      async evaluate(fn, args) {
        const result = await runInNewContext("(" + fn.toString() + ")(args)", {
          args,
          location: { origin },
          URL,
          AbortSignal,
          Uint8Array,
          TextDecoder,
          crypto,
          fetch,
        });
        return JSON.parse(JSON.stringify(result)); // Playwright's realm boundary.
      },
    };
    const beforeWrites = f.app.writes.length,
      beforeChanges = f.sqlite.prepare("SELECT total_changes() AS n").get().n;
    const run = () =>
      qualifyNativeApprovedExport({
        owner: { user, page },
        lab: {
          root,
          origins: { composer: origin },
          sources: {
            composer: { head: "a".repeat(40) },
            guestbook: { head: source },
          },
        },
        teamA,
        approvedItemId: item.id,
        expectedMediaSha: item.media.sha256,
      });
    await verify({
      run,
      teamA,
      item,
      exported: () => exports,
      paths,
      f,
      beforeWrites,
      beforeChanges,
    });
    assert.equal(f.app.writes.length, beforeWrites);
  } finally {
    f.close();
    await rm(owned, { recursive: true, force: true });
  }
}

test("native export helper returns bounded approved-only media evidence and leaves actual Composer state unchanged", async () => {
  await exercise("valid", async ({ run, exported, f, beforeChanges }) => {
    const receipt = await run();
    assert.equal(exported(), 1);
    assert.equal(receipt.approvedItem.id, "fictional-retained-approved");
    assert.equal(
      receipt.configuration.source,
      appSettings.guestbook.source.commit,
    );
    assert.equal(receipt.portable.coverage.maximumItems, 8);
    assert.equal(receipt.portable.coverage.privateContent, false);
    assert.equal(receipt.exportedItems.length, 1);
    assert.equal(receipt.readOnly.resourceUnchanged, true);
    assert.equal(
      f.sqlite.prepare("SELECT total_changes() AS n").get().n,
      beforeChanges,
    );
    const output = JSON.stringify(receipt);
    assert.equal(output.includes(png), false);
    assert.equal(output.includes("base64"), false);
    assert.equal(output.includes("Never retain this caption"), false);
    assert.equal(output.includes("Private fictional author"), false);
    assert.equal(output.includes("fictional-owner-token"), false);
    assert.ok(Buffer.byteLength(output) < 6000);
  });
});

for (const kind of [
  "foreign-resource",
  "foreign-source",
  "private-coverage",
  "false-media-digest",
  "missing-item",
  "non-synthetic",
  "stack-drift",
  "revoked-owner",
  "oversized",
  "wrong-bridge",
])
  test(
    "native export helper refuses " + kind + " without mutation/retry",
    async () => {
      await exercise(kind, async ({ run, exported }) => {
        await assert.rejects(run());
        assert.ok(exported() <= 1);
      });
    },
  );
