import test from "node:test";
import assert from "node:assert/strict";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import {
  readShopifyCatalogue,
  manageShopifyCatalogue,
  catalogueQuery,
} from "../src/lib/shopify-catalogue.ts";
import {
  catalogueFindings,
  shopifyCatalogueSnapshot,
  shopifyApiVersion,
} from "../src/lib/shopify-catalogue-contract.ts";
const shop = "fictional-riverton.myshopify.com";
const token = "FICTIONAL_SHOPIFY_TOKEN_CANARY";
const products = () => [
  {
    id: "gid://shopify/Product/101",
    title: "Trail journal",
    handle: "trail-journal",
    status: "ACTIVE",
    updatedAt: "2026-10-25T00:00:00Z",
    onlineStoreUrl: `https://${shop}/products/trail-journal`,
    featuredMedia: { image: { altText: "Orange pocket journal" } },
  },
  {
    id: "gid://shopify/Product/102",
    title: "Unpublished print",
    handle: "unpublished-print",
    status: "DRAFT",
    updatedAt: "2026-10-25T00:00:00Z",
    onlineStoreUrl: null,
    featuredMedia: { image: { altText: null } },
  },
];
function provider(patch = {}, status = 200, version = shopifyApiVersion) {
  return new Response(
    JSON.stringify({
      data: {
        shop: { myshopifyDomain: shop, primaryDomain: { host: shop } },
        products: { nodes: products(), pageInfo: { hasNextPage: true } },
        ...patch,
      },
    }),
    { status, headers: { "X-Shopify-API-Version": version } },
  );
}

test("selected fixed Shopify query reads product launch metadata and preserves draft/private distinctions", async () => {
  let calls = 0;
  const reply = await readShopifyCatalogue(
    shop,
    token,
    async (url, options) => {
      calls++;
      assert.equal(url, `https://${shop}/admin/api/2026-10/graphql.json`);
      assert.equal(options.headers["X-Shopify-Access-Token"], token);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal);
      assert.equal(JSON.parse(options.body).query, catalogueQuery);
      assert.doesNotMatch(
        catalogueQuery,
        /mutation|customer|orders|price|fulfillment/i,
      );
      return provider();
    },
  );
  assert.equal(calls, 1);
  assert.equal(reply.state, "ready");
  assert.equal(reply.atLimit, true);
  assert.equal(reply.products[0].url, `https://${shop}/products/trail-journal`);
  assert.equal(reply.products[1].url, null);
  assert.equal(catalogueFindings(reply.products[1]).length, 3);
  assert.equal(JSON.stringify(reply).includes(token), false);
});

test("wrong shops, unsafe product links, API fallback, incomplete GraphQL and oversized responses remain unavailable", async () => {
  assert.equal(
    (
      await readShopifyCatalogue(shop, token, async () =>
        provider({
          shop: {
            myshopifyDomain: "other-store.myshopify.com",
            primaryDomain: { host: shop },
          },
        }),
      )
    ).state,
    "mismatch",
  );
  for (const link of [
    "javascript:alert(1)",
    "https://attacker.test/products/trail-journal",
    `https://user:secret@${shop}/products/trail-journal`,
    `https://${shop}/admin`,
  ]) {
    const nodes = products();
    nodes[0].onlineStoreUrl = link;
    assert.equal(
      (
        await readShopifyCatalogue(shop, token, async () =>
          provider({ products: { nodes, pageInfo: { hasNextPage: false } } }),
        )
      ).state,
      "unavailable",
    );
  }
  assert.equal(
    (
      await readShopifyCatalogue(shop, token, async () =>
        provider({}, 200, "2026-07"),
      )
    ).state,
    "unavailable",
  );
  assert.equal(
    (
      await readShopifyCatalogue(
        shop,
        token,
        async () =>
          new Response(
            JSON.stringify({ data: null, errors: [{ message: token }] }),
            { headers: { "X-Shopify-API-Version": shopifyApiVersion } },
          ),
      )
    ).state,
    "unavailable",
  );
  assert.equal(
    (
      await readShopifyCatalogue(
        shop,
        token,
        async () =>
          new Response(new Uint8Array(128 * 1024 + 1), {
            headers: { "X-Shopify-API-Version": shopifyApiVersion },
          }),
      )
    ).state,
    "unavailable",
  );
  await assert.rejects(
    readShopifyCatalogue("https://attacker.test", token, async () => {
      throw Error("must not request");
    }),
  );
});

test("revoked tokens, throttling and failed network have distinct redacted states and no retries", async () => {
  for (const [status, state] of [
    [401, "denied"],
    [403, "denied"],
    [429, "rate-limited"],
    [500, "unavailable"],
  ]) {
    let calls = 0;
    const result = await readShopifyCatalogue(shop, token, async () => {
      calls++;
      return new Response(token, { status });
    });
    assert.equal(result.state, state);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes(token), false);
  }
  assert.equal(
    (
      await readShopifyCatalogue(shop, token, async () => {
        throw Error(token);
      })
    ).state,
    "unavailable",
  );
});

async function prepared(t) {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  const runtime = {
    ...f.runtime,
    SHOPIFY_READ_ENABLED: "true",
    SHOPIFY_SHOP_DOMAIN: shop,
    SHOPIFY_ADMIN_ACCESS_TOKEN: token,
    SHOPIFY_WORKSPACE_ID: workspace.id,
    SHOPIFY_RESOURCE_ENVIRONMENT: "production",
  };
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return provider();
  };
  const route = (
    action = "check",
    changes = {},
    env = runtime,
    caller = user,
    method = action === "check" ? "POST" : "GET",
  ) =>
    manageShopifyCatalogue(
      {
        user: caller,
        input: { action, workspace: workspace.id },
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/shopifyCatalogue",
          { method, headers: { Origin: origin }, ...changes },
        ),
      },
      env,
      fetcher,
    );
  return { ...f, workspace, runtime, route, calls: () => calls };
}

test("workspace/environment configuration is server-selected and metadata status makes no provider call", async (t) => {
  const f = await prepared(t);
  const status = shopifyCatalogueSnapshot.parse(await f.route("status"));
  assert.equal(status.observedAt, null);
  assert.equal(f.calls(), 0);
  for (const patch of [
    { SHOPIFY_READ_ENABLED: undefined },
    { SHOPIFY_WORKSPACE_ID: "wrong-workspace" },
    { SHOPIFY_RESOURCE_ENVIRONMENT: "preview" },
    { SHOPIFY_SHOP_DOMAIN: "attacker.test" },
    { SHOPIFY_ADMIN_ACCESS_TOKEN: undefined },
  ]) {
    const result = await f.route("check", {}, { ...f.runtime, ...patch });
    assert.equal(result.state, "unconfigured");
    assert.equal(result.shop, null);
  }
  assert.equal(f.calls(), 0);
  const read = shopifyCatalogueSnapshot.parse(await f.route());
  assert.equal(read.source, "shopify");
  assert.equal(read.state, "ready");
  assert.equal(f.calls(), 1);
  assert.equal(JSON.stringify(read).includes(token), false);
});

test("anonymous, wrong workspace, cross-origin, disabled environment and GET checks are refused before provider access", async (t) => {
  const f = await prepared(t);
  for (const caller of [null, { id: "outsider", role: 40 }])
    assert.equal((await f.route("check", {}, f.runtime, caller)).ok, false);
  assert.equal(
    (await f.route("check", { headers: { Origin: "https://attacker.test" } }))
      .ok,
    false,
  );
  assert.equal(
    (
      await f.route(
        "check",
        {},
        { ...f.runtime, PUBLIC_ORIGIN: "https://other.test" },
      )
    ).ok,
    false,
  );
  assert.equal(
    (await f.route("check", {}, f.runtime, user, "GET")).code,
    "METHOD_NOT_ALLOWED",
  );
  assert.equal(f.calls(), 0);
  assert.equal((await f.route("check", { headers: {} })).ok, false);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  assert.equal((await f.route()).ok, false);
  assert.equal(f.calls(), 0);
});

test("membership revoked during the provider read cannot expose the returned private catalogue", async (t) => {
  const f = await prepared(t);
  const result = await manageShopifyCatalogue(
    {
      user,
      input: { action: "check", workspace: f.workspace.id },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/shopifyCatalogueCheck",
        { method: "POST", headers: { Origin: origin } },
      ),
    },
    f.runtime,
    async () => {
      f.sqlite
        .prepare(
          "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .run(f.workspace.id, user.id);
      return provider();
    },
  );
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes("Unpublished print"), false);
});
