import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";
import { parseAdminSecrets } from "../scripts/deployment-target.mjs";

const origin = "https://composer.loftwah.com";
const operatorRevision = "a".repeat(40);
const referenceRevision = {
  guestbook: "36797b8028682460c33fe092682bfbd63751ec1a",
  showcase: "b7cd3b3e8f19dbbb76d33fb4266053da928cf586",
};
const referenceApps = JSON.parse(
  readFileSync(
    new URL("../config/creator-hub-reference.json", import.meta.url),
    "utf8",
  ),
).apps;
const pins = { guestbook: operatorRevision, showcase: operatorRevision };
const context = (input) => ({
  user: { id: "fictional-owner", role: 50 },
  input,
  request: new Request(origin + "/_emdash/api/plugins/composer-miniapps/read", {
    method: ["snapshot", "preview", "collection-sources"].includes(input.action)
      ? "GET"
      : "POST",
    headers: { Origin: origin, "X-EmDash-Request": "1" },
  }),
});
function service(record, identityRevision) {
  return {
    async fetch(request) {
      record.push(request);
      if (request.url.endsWith("/build.json"))
        return Response.json({
          app: request.url.includes("/guestbook/") ? "guestbook" : "showcase",
          revision: identityRevision,
          dataVersion: 1,
        });
      return Response.json({
        dataVersion: 1,
        config: { title: "Fictional reference" },
        items: [],
        cards: [],
      });
    },
  };
}
function runtime(identityRevision = referenceRevision) {
  const calls = { operator: [], reference: [] };
  const value = {
    PUBLIC_ORIGIN: origin,
    GUESTBOOK: service(calls.operator, operatorRevision),
    SHOWCASE: service(calls.operator, operatorRevision),
    GUESTBOOK_OWNER_TOKEN: "fictional-operator-token",
    SHOWCASE_OWNER_TOKEN: "fictional-operator-token",
    CREATOR_HUB_GUESTBOOK: service(
      calls.reference,
      identityRevision.guestbook,
    ),
    CREATOR_HUB_SHOWCASE: service(calls.reference, identityRevision.showcase),
    CREATOR_HUB_GUESTBOOK_OWNER_TOKEN: "fictional-reference-guestbook-token",
    CREATOR_HUB_SHOWCASE_OWNER_TOKEN: "fictional-reference-showcase-token",
  };
  return { value, calls };
}
const invoke = (input, f, reference = referenceApps) =>
  manageMiniapps(context(input), f.value, { ...pins }, reference);

test("the reference site uses its own service, owner token and reviewed pin", async () => {
  const f = runtime();
  const result = await invoke(
    { app: "guestbook", site: "creator-hub", action: "snapshot" },
    f,
  );
  assert.equal(result.ok, true);
  assert.equal(result.site, "creator-hub");
  assert.equal(result.revision, referenceRevision.guestbook);
  assert.equal(f.calls.operator.length, 0);
  assert.equal(f.calls.reference.length, 2);
  assert.equal(
    f.calls.reference[0].url,
    referenceApps.guestbook.origin + "/guestbook/build.json",
  );
  assert.equal(
    f.calls.reference[1].headers.get("Authorization"),
    "Bearer fictional-reference-guestbook-token",
  );
  assert.doesNotMatch(JSON.stringify(result), /fictional-reference/);
});

test("a reference pin mismatch refuses before the owner API is called", async () => {
  const f = runtime({
    guestbook: referenceRevision.guestbook,
    showcase: operatorRevision,
  });
  const result = await invoke(
    { app: "showcase", site: "creator-hub", action: "snapshot" },
    f,
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "SOURCE");
  assert.equal(f.calls.reference.length, 1);
  assert.equal(f.calls.operator.length, 0);
});

test("the operator pair remains the default and keeps its own connections", async () => {
  const f = runtime();
  const result = await invoke({ app: "showcase", action: "snapshot" }, f);
  assert.equal(result.ok, true);
  assert.equal(result.site, "operator");
  assert.equal(result.revision, operatorRevision);
  assert.equal(f.calls.reference.length, 0);
  assert.equal(f.calls.operator.length, 2);
  assert.equal(
    f.calls.operator[1].headers.get("Authorization"),
    "Bearer fictional-operator-token",
  );
});

test("reference collection controls are refused without touching either app", async () => {
  const f = runtime();
  const result = await invoke(
    { app: "showcase", site: "creator-hub", action: "collection-sources" },
    f,
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID");
  assert.equal(f.calls.reference.length, 0);
  assert.equal(f.calls.operator.length, 0);
});

test("an unknown site or missing reference configuration fails closed", async () => {
  const f = runtime();
  const unknown = await invoke(
    { app: "guestbook", site: "somewhere-else", action: "snapshot" },
    f,
  );
  assert.equal(unknown.code, "INVALID");
  const missing = await invoke(
    { app: "guestbook", site: "creator-hub", action: "snapshot" },
    f,
    {},
  );
  assert.equal(missing.code, "UNAVAILABLE");
  assert.equal(f.calls.reference.length, 0);
  assert.equal(f.calls.operator.length, 0);
});

test("the reviewed reference file and deployment bindings stay in step", async () => {
  const wrangler = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );
  const services = Object.fromEntries(
    wrangler.services.map((entry) => [entry.binding, entry.service]),
  );
  assert.equal(services.CREATOR_HUB_GUESTBOOK, "creator-hub-guestbook");
  assert.equal(services.CREATOR_HUB_SHOWCASE, "creator-hub-showcase");
  assert.deepEqual(wrangler.env.preview.services, []);
  assert.equal(referenceApps.guestbook.commit, referenceRevision.guestbook);
  assert.equal(referenceApps.showcase.commit, referenceRevision.showcase);
  assert.equal(
    referenceApps.guestbook.origin,
    "https://creator-hub-guestbook.loftwah.com",
  );
  assert.equal(referenceApps.showcase.origin, "https://creator-hub.loftwah.com");
});

test("the deploy secret gate accepts the reference pair only as a complete set", () => {
  const owner = {
    GUESTBOOK_OWNER_TOKEN: "fictional-operator-guestbook",
    SHOWCASE_OWNER_TOKEN: "fictional-operator-showcase",
  };
  const reference = {
    CREATOR_HUB_GUESTBOOK_OWNER_TOKEN: "fictional-reference-guestbook",
    CREATOR_HUB_SHOWCASE_OWNER_TOKEN: "fictional-reference-showcase",
  };
  assert.deepEqual(
    Object.keys(
      JSON.parse(parseAdminSecrets(JSON.stringify({ ...owner, ...reference }))),
    ).sort(),
    [
      "CREATOR_HUB_GUESTBOOK_OWNER_TOKEN",
      "CREATOR_HUB_SHOWCASE_OWNER_TOKEN",
      "GUESTBOOK_OWNER_TOKEN",
      "SHOWCASE_OWNER_TOKEN",
    ],
  );
  assert.throws(() =>
    parseAdminSecrets(
      JSON.stringify({
        ...owner,
        CREATOR_HUB_GUESTBOOK_OWNER_TOKEN: "fictional-reference-guestbook",
      }),
    ),
  );
  assert.throws(() =>
    parseAdminSecrets(
      JSON.stringify({
        ...owner,
        ...reference,
        UNREVIEWED_OWNER_TOKEN: "fictional-unreviewed",
      }),
    ),
  );
});
