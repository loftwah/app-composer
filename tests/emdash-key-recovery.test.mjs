import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  chmodSync,
  symlinkSync,
  linkSync,
  unlinkSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseEmdashEncryptionSecrets,
  readEmdashEncryptionSecrets,
  combineDeploymentSecrets,
  assertEmptyPluginStoresForFreshKey,
  snapshotAdminSecrets,
} from "../scripts/deployment-target.mjs";
const synthetic = "emdash_enc_v1_" + Buffer.alloc(32, 7).toString("base64url");
const approved = JSON.stringify({ EMDASH_ENCRYPTION_KEY: synthetic });
const admin = JSON.stringify({
  GUESTBOOK_OWNER_TOKEN: "fictional-guest",
  SHOWCASE_OWNER_TOKEN: "fictional-profile",
});
test("initial recovery accepts one canonical native key and preserves optional mini-app connections", () => {
  assert.deepEqual(JSON.parse(parseEmdashEncryptionSecrets(approved)), {
    EMDASH_ENCRYPTION_KEY: synthetic,
  });
  assert.deepEqual(JSON.parse(combineDeploymentSecrets(admin, approved)), {
    ...JSON.parse(admin),
    EMDASH_ENCRYPTION_KEY: synthetic,
  });
  assert.equal(combineDeploymentSecrets(null, null), null);
  assert.deepEqual(
    JSON.parse(combineDeploymentSecrets(admin, null)),
    JSON.parse(admin),
  );
  for (const input of [
    undefined,
    "CANARY_SECRET_MALFORMED",
    JSON.stringify({ EMDASH_ENCRYPTION_KEY: "CANARY_SECRET_MALFORMED" }),
    JSON.stringify({ EMDASH_ENCRYPTION_KEY: synthetic + "," + synthetic }),
    JSON.stringify({
      EMDASH_ENCRYPTION_KEY: synthetic,
      OTHER: "CANARY_SECRET_MALFORMED",
    }),
    `{"EMDASH_ENCRYPTION_KEY":"${synthetic}","EMDASH_ENCRYPTION_KEY":"${synthetic}"}`,
    String.raw`{"EMDASH_ENCRYPTION_KEY":"${synthetic}","EMDASH_\u0045NCRYPTION_KEY":"${synthetic}"}`,
    JSON.stringify({ EMDASH_ENCRYPTION_KEY: synthetic.slice(0, -1) + "B" }),
  ])
    assert.throws(
      () => parseEmdashEncryptionSecrets(input),
      (error) => !error.message.includes("CANARY_SECRET"),
    );
});
test("only fixed, private, unlinked key input is accepted; immutable snapshot cleanup preserves source", (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-key-recovery-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  const privateRoot = join(root, ".private");
  mkdirSync(privateRoot, { mode: 0o700 });
  const path = join(privateRoot, "emdash-encryption-secrets.json");
  writeFileSync(path, approved, { mode: 0o600 });
  const captured = readEmdashEncryptionSecrets(root);
  const snapshot = snapshotAdminSecrets(captured, root);
  assert.equal(statSync(snapshot.path).mode & 0o777, 0o600);
  snapshot.remove();
  assert.deepEqual(readdirSync(privateRoot), [
    "emdash-encryption-secrets.json",
  ]);
  assert.equal(readFileSync(path, "utf8"), approved);
  chmodSync(path, 0o644);
  assert.throws(() => readEmdashEncryptionSecrets(root));
  chmodSync(path, 0o600);
  chmodSync(privateRoot, 0o755);
  assert.throws(() => readEmdashEncryptionSecrets(root));
  chmodSync(privateRoot, 0o700);
  const other = join(root, "other");
  linkSync(path, other);
  assert.throws(() => readEmdashEncryptionSecrets(root));
  unlinkSync(other);
  unlinkSync(path);
  symlinkSync(other, path);
  assert.throws(() => readEmdashEncryptionSecrets(root));
});
const empty = {
  options: {
    plugin_option_rows: 0,
    plugin_settings_rows: 0,
    encrypted_envelopes: 0,
  },
  storage: { plugin_storage_rows: 0 },
  state: { plugin_state_rows: 4, nonempty_state_rows: 0 },
};
const query =
  (changes = {}) =>
  async (sql) => [
    {
      success: true,
      results: [
        sql.includes("FROM options")
          ? { ...empty.options, ...changes.options }
          : sql.includes("FROM _plugin_storage")
            ? { ...empty.storage, ...changes.storage }
            : { ...empty.state, ...changes.state },
      ],
    },
  ];
test("all three stores are freshly checked; any content, missing metadata or error refuses key replacement without echo", async () => {
  const calls = [];
  await assertEmptyPluginStoresForFreshKey(async (sql) => {
    calls.push(sql);
    return query()(sql);
  });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((sql) => sql.startsWith("SELECT")));
  for (const changes of [
    { options: { plugin_option_rows: 1, plugin_settings_rows: 1 } },
    { storage: { plugin_storage_rows: 1 } },
    { state: { nonempty_state_rows: 1 } },
  ])
    await assert.rejects(
      assertEmptyPluginStoresForFreshKey(query(changes)),
      /must be confirmed empty/,
    );
  for (const failure of [
    async () => [],
    async () => [{ success: false, results: [empty.options] }],
    async () => {
      throw Error(synthetic);
    },
  ])
    await assert.rejects(
      assertEmptyPluginStoresForFreshKey(failure),
      (error) => !error.message.includes(synthetic),
    );
});
