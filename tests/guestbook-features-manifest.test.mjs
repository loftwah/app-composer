import test from "node:test";
import assert from "node:assert/strict";
import { guardPromotion, validateManifest } from "../scripts/contracts.mjs";

const portability = {
  version: 1,
  format: "guestbook.approved-portable/v1",
  export: "/api/resources/:resource/portable",
  restore: "/api/resources/:freshResource/restore",
  maximumItems: 8,
  scope: "current-authorized-workspace-account-environment-target",
  restoredVisibility: "private",
  requiresLiveSource: true,
};
const privateEnquiries = {
  version: 1,
  model: "briefs/v1",
  owner: "/api/resources/:resource/enquiries",
  public: "/r/:resource/c/:configuration/enquiry",
  default: "closed",
  retentionDays: 30,
  receiptDays: 35,
  notifications: false,
};
const manifest = (id = "guestbook") => ({
  contract: 1,
  id,
  runtime: "cloudflare-worker",
  dataVersion: 1,
  routes: ["/" + id],
  capabilities: ["items:read", "items:moderate", "media:private"],
});

test("legacy Guestbook and exact separately reviewed contracts retain the existing promotion boundary", () => {
  const before = manifest();
  for (const fields of [
    {},
    { portability },
    { privateEnquiries },
    { portability, privateEnquiries },
  ]) {
    const after = { ...before, ...structuredClone(fields) };
    assert.equal(validateManifest(after), after);
    assert.equal(
      guardPromotion(
        { id: "current", apps: [{ id: "guestbook", manifest: before }] },
        { apps: [{ id: "guestbook", manifest: after }] },
        "current",
      ),
      true,
    );
  }
  assert.throws(
    () =>
      guardPromotion(
        { id: "current", apps: [{ id: "guestbook", manifest: before }] },
        { apps: [{ id: "guestbook", manifest: { ...before, portability } }] },
        "stale",
      ),
    /Active release changed/,
  );
});

for (const [field, approved] of Object.entries({
  portability,
  privateEnquiries,
})) {
  test(`${field} refuses missing, inherited, extra and malformed authority-bearing fields`, () => {
    const invalid = [
      null,
      false,
      [],
      "enabled",
      {},
      { ...approved, version: 2 },
      { ...approved, token: "not-a-credential" },
    ];
    for (const key of Object.keys(approved)) {
      const missing = { ...approved };
      delete missing[key];
      invalid.push(missing, { ...approved, [key]: null });
      const inherited = Object.assign(
        Object.create({ [key]: approved[key] }),
        missing,
        { extra: true },
      );
      invalid.push(inherited);
    }
    for (const value of invalid)
      assert.throws(
        () => validateManifest({ ...manifest(), [field]: value }),
        /Unsupported/,
      );
    assert.throws(
      () => validateManifest({ ...manifest("showcase"), [field]: approved }),
      /Unsupported/,
    );
  });
}

test("changed portability/enquiry scope, publication, endpoint, retention and notification semantics cannot be promoted", () => {
  for (const change of [
    { restoredVisibility: "published" },
    { requiresLiveSource: false },
    { maximumItems: 1000 },
    { scope: "any-workspace" },
    { restore: "https://example.test/restore" },
    { export: "/api/export" },
  ])
    assert.throws(
      () =>
        validateManifest({
          ...manifest(),
          portability: { ...portability, ...change },
        }),
      /Unsupported approved-content portability/,
    );
  for (const change of [
    { default: "open" },
    { model: "arbitrary-model/v1" },
    { notifications: true },
    { retentionDays: 365 },
    { receiptDays: 0 },
    { public: "https://example.test/form" },
    { owner: "/api/admin" },
  ])
    assert.throws(
      () =>
        validateManifest({
          ...manifest(),
          privateEnquiries: { ...privateEnquiries, ...change },
        }),
      /Unsupported private enquiry contract/,
    );
});
