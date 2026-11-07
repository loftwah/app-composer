import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateAgentCapabilitiesDeclaration } from "../scripts/lib/app-capability-declaration.mjs";
import { validateManifest } from "../scripts/contracts.mjs";
import { appCapabilities } from "../src/lib/app-capabilities.ts";

const guestbook = appCapabilities.find((app) => app.id === "guestbook");
const declaration = {
  version: 1,
  ui: guestbook.ui,
  storage: guestbook.storage,
  operations: guestbook.operations,
};

test("accepts the Guestbook catalogue as an app-owned declaration", () => {
  assert.equal(
    validateAgentCapabilitiesDeclaration(declaration, "guestbook"),
    declaration,
  );
  assert.equal(declaration.operations.length, 2);
});

test("old manifests without the optional declaration still validate", () => {
  const lock = JSON.parse(
    readFileSync(new URL("../composition.lock.json", import.meta.url), "utf8"),
  );
  const guestbookManifest = lock.apps.find(
    (app) => app.id === "guestbook",
  ).manifest;
  assert.equal(guestbookManifest.agentCapabilities, undefined);
  assert.equal(validateManifest(guestbookManifest), guestbookManifest);
});

test("validateManifest rejects an invalid declaration", () => {
  assert.throws(
    () =>
      validateManifest({
        ...JSON.parse(
          readFileSync(
            new URL("../composition.lock.json", import.meta.url),
            "utf8",
          ),
        ).apps.find((app) => app.id === "guestbook").manifest,
        agentCapabilities: {
          ...declaration,
          operations: [{ ...declaration.operations[0], kind: "effect" }],
        },
      }),
    /effect operation requires confirmation/,
  );
});

test("accepts the pushed Showcase app-owned declaration", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        "../docs/evidence/app-capability-showcase-20261107/showcase.app.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(validateManifest(manifest), manifest);
  assert.equal(manifest.agentCapabilities.operations.length, 1);
  assert.equal(
    manifest.agentCapabilities.operations[0].name,
    "read-public-profile",
  );
  assert.equal(manifest.agentCapabilities.operations[0].kind, "read");
});

test("rejects unknown declaration fields", () => {
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        { ...declaration, authority: "owner" },
        "guestbook",
      ),
    /unsupported fields/,
  );
});

test("rejects an effect without confirmation and a permit", () => {
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        {
          ...declaration,
          operations: [{ ...declaration.operations[0], kind: "effect" }],
        },
        "guestbook",
      ),
    /effect operation requires confirmation/,
  );
});

test("rejects a public effect", () => {
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        {
          ...declaration,
          operations: [
            {
              ...declaration.operations[0],
              kind: "effect",
              confirmation: true,
              requires: ["owner"],
            },
          ],
        },
        "guestbook",
      ),
    /public effect operation must be scoped/,
  );
});

test("rejects an unsafe path and duplicate names", () => {
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        {
          ...declaration,
          operations: [
            { ...declaration.operations[0], path: "/api/../secret" },
          ],
        },
        "guestbook",
      ),
    /safe relative path/,
  );
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        {
          ...declaration,
          operations: [declaration.operations[0], declaration.operations[0]],
        },
        "guestbook",
      ),
    /operation is repeated/,
  );
});

test("rejects credential-like fields", () => {
  assert.throws(
    () =>
      validateAgentCapabilitiesDeclaration(
        {
          ...declaration,
          operations: [
            {
              ...declaration.operations[0],
              api_key: "never-public",
            },
          ],
        },
        "guestbook",
      ),
    /unsupported fields/,
  );
});
