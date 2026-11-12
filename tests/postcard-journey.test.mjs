import assert from "node:assert/strict";
import test from "node:test";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";
import {
  checkPostcardJourney,
  postcardJourney,
  readPostcardObservation,
} from "../src/lib/postcard-journey.ts";
import reference from "../config/creator-hub-reference.json" with { type: "json" };

test("classifies a route error separately from insufficient evidence", async () => {
  const request = (response) => async (url, options) => {
    assert.equal(url, "https://creator-hub-guestbook.loftwah.com/contribute");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    assert.equal(new Headers(options.headers).has("authorization"), false);
    assert.equal(new Headers(options.headers).has("cookie"), false);
    return response;
  };
  const failed = await checkPostcardJourney(
    request(new Response("missing", { status: 404 })),
  );
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.reason, "route-failed");

  for (const response of [
    Response.redirect("https://example.com/"),
    Response.json({ unexpected: true }),
    new Response("challenge", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    }),
  ]) {
    const result = await checkPostcardJourney(request(response));
    assert.equal(result.outcome, "unavailable");
    assert.equal(result.reason, "response-unverified");
  }
});

test("accepts only the fixed observation identity and exports allowlisted fields", () => {
  const value = {
    ...postcardJourney,
    checkedAt: "2026-11-12T10:00:00.000Z",
    reason: "form-present",
    outcome: "passed",
  };
  const result = readPostcardObservation({
    ...value,
    label: "Untrusted label",
    contents: "Untrusted content",
  });
  assert.equal(result.label, "Postcard form served");
  assert.equal(Object.hasOwn(result, "contents"), false);
  for (const patch of [
    { environment: "preview" },
    { url: "https://example.com/" },
    { definition: "creator-hub.postcard-form/v0" },
    { checkedAt: "2026-02-31T10:00:00.000Z" },
    { outcome: "failed" },
  ])
    assert.throws(() => readPostcardObservation({ ...value, ...patch }));
});

test("only the production admin can check the selected Creator Hub Guestbook", async (t) => {
  const origin = "https://composer.loftwah.com";
  const request = new Request(
    origin + "/_emdash/api/plugins/composer-miniapps/read",
  );
  const context = {
    request,
    user: { role: 50 },
    input: {
      action: "postcard-journey",
      site: "creator-hub",
      app: "guestbook",
    },
  };
  const runtime = { PUBLIC_ORIGIN: origin };
  const transport = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 404 }),
  );
  const run = (ctx, env = runtime) =>
    manageMiniapps(ctx, env, {}, reference.apps);

  assert.equal(
    (await run({ ...context, user: { role: 40 } })).code,
    "FORBIDDEN",
  );
  assert.equal(
    (await run(context, { PUBLIC_ORIGIN: "https://preview.example.com" })).code,
    "UNAVAILABLE",
  );
  assert.equal(
    (
      await run({
        ...context,
        request: new Request(request.url, {
          headers: { Origin: "https://example.com" },
        }),
      })
    ).code,
    "FORBIDDEN",
  );
  assert.equal(
    (
      await run({
        ...context,
        request: new Request(request.url, { method: "POST" }),
      })
    ).code,
    "METHOD",
  );
  assert.equal(
    (await run({ ...context, input: { ...context.input, site: "operator" } }))
      .code,
    "INVALID",
  );
  assert.equal(
    (await run({ ...context, input: { ...context.input, app: "showcase" } }))
      .code,
    "INVALID",
  );
  assert.equal(transport.mock.callCount(), 0);
  const result = await run({
    ...context,
    input: { ...context.input, url: "https://example.com/" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.observation.reason, "route-failed");
  assert.equal(transport.mock.callCount(), 1);
  assert.equal(transport.mock.calls[0].arguments[0], postcardJourney.url);
});
