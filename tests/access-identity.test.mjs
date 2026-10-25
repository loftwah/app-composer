import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSubjectBindingInput } from "../src/lib/access-subject-bindings.mjs";

test("installed Access integration reproduces inheritance; explicit binding denies principal substitution and preserves grants", () => {
  const output = execFileSync(
    process.execPath,
    [
      new URL("./helpers/access-identity-scenario.mjs", import.meta.url)
        .pathname,
    ],
    {
      encoding: "utf8",
      timeout: 30000,
    },
  );
  const receipt = JSON.parse(output.trim().split("\n").at(-1));
  assert.equal(receipt.retainedAccounts, true);
  assert.equal(receipt.retainedMemberships, true);
  assert.equal(receipt.retainedGrants, true);
  assert.equal(receipt.productionEnforcement, "not enabled");
});

test("binding operator command is read-only by default and requires exact, explicit reviewed identity", (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-access-binding-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  const path = join(root, "synthetic.db");
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
      INSERT INTO users VALUES ('fictional-owner','owner@fictional.invalid',0);`);
    db.exec(
      readFileSync(
        new URL(
          "../migrations/0019_access_subject_bindings.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  } finally {
    db.close();
  }
  const bytes = readFileSync(path);
  const run = (args) =>
    execFileSync(
      process.execPath,
      ["scripts/access-subject-binding.mjs", "--database", path, ...args],
      {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  const input = {
    issuer: "https://synthetic.cloudflareaccess.com",
    subject: "access-sub-a",
    idpId: "idp-a",
    upstreamIssuer: "https://idp.fictional.invalid/tenant-a",
    upstreamSubject: "principal-a",
    userId: "fictional-owner",
    expectedEmail: "owner@fictional.invalid",
    reviewedBy: "synthetic-reviewer",
  };
  assert.equal(JSON.parse(run([])).mode, "read-only");
  assert.deepEqual(readFileSync(path), bytes);
  const flags = [
    "--bind",
    "--issuer",
    input.issuer,
    "--subject",
    input.subject,
    "--idp-id",
    input.idpId,
    "--upstream-issuer",
    input.upstreamIssuer,
    "--upstream-subject",
    input.upstreamSubject,
    "--user",
    input.userId,
    "--expected-email",
    input.expectedEmail,
    "--reviewed-by",
    input.reviewedBy,
  ];
  assert.throws(() => run(["--bind"]), /Command failed/);
  assert.throws(
    () =>
      run(
        flags.map((value) =>
          value === input.expectedEmail ? "wrong@fictional.invalid" : value,
        ),
      ),
    /Command failed/,
  );
  assert.equal(JSON.parse(run(flags)).bound, true);
  assert.equal(JSON.parse(run([])).activeBindings, 1);
  assert.throws(() => run(flags), /Command failed/);
  for (const invalid of [
    { subject: "" },
    { upstreamSubject: "" },
    { idpId: "" },
    { issuer: "https://evil.invalid" },
    { upstreamIssuer: "http://idp.fictional.invalid" },
    { upstreamIssuer: "https://user:secret@idp.fictional.invalid" },
    { reviewedBy: "new\nline" },
  ]) {
    assert.throws(() => validateSubjectBindingInput({ ...input, ...invalid }));
  }
});
