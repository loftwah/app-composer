import test from "node:test";
import assert from "node:assert/strict";
import { guardPromotion, validateManifest } from "../scripts/contracts.mjs";

const source = {
  version: 1,
  kinds: ["guestbook.resource"],
  provider: "guestbook",
  selection: "explicit-resource-and-activated-configuration",
  eligibility: "checked-at-each-render-and-export",
};
const manifest = (id = "showcase") => ({
  contract: 1,
  id,
  runtime: "cloudflare-worker",
  dataVersion: 1,
  routes: ["/" + id],
  capabilities: ["features:write"],
});

test("legacy manifests remain valid and the exact scoped collection descriptor can be promoted", () => {
  const before = manifest();
  const after = { ...before, providerSources: structuredClone(source) };
  assert.equal(validateManifest(before), before);
  assert.equal(validateManifest(after), after);
  assert.equal(
    guardPromotion(
      { id: "current", apps: [{ id: "showcase", manifest: before }] },
      { apps: [{ id: "showcase", manifest: after }] },
      "current",
    ),
    true,
  );
});

test("unreviewed provider kinds, eligibility, authority and malformed descriptors fail before promotion", () => {
  const invalid = [
    null,
    false,
    [],
    "guestbook.resource",
    {},
    { ...source, version: 2 },
    { ...source, kinds: [] },
    { ...source, kinds: ["guestbook"] },
    { ...source, kinds: ["guestbook.resource", "other.resource"] },
    { ...source, kinds: "guestbook.resource" },
    { ...source, provider: "other" },
    { ...source, selection: "caller-selected-url" },
    { ...source, eligibility: "copied-at-write" },
    { ...source, url: "https://example.com/provider" },
    { ...source, token: "not-a-credential" },
    Object.fromEntries(
      Object.entries(source).filter(([key]) => key !== "eligibility"),
    ),
  ];
  for (const providerSources of invalid)
    assert.throws(
      () => validateManifest({ ...manifest(), providerSources }),
      /Unsupported scoped provider sources/,
    );
  assert.throws(
    () =>
      validateManifest({ ...manifest("guestbook"), providerSources: source }),
    /Unsupported scoped provider sources/,
  );
  const inherited = Object.assign(Object.create({ version: 1 }), {
    ...source,
    extra: true,
  });
  delete inherited.version;
  assert.throws(
    () => validateManifest({ ...manifest(), providerSources: inherited }),
    /Unsupported scoped provider sources/,
  );
});
