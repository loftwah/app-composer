import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  pluginSecretInventoryQueries as queries,
  summarisePluginSecretInventory,
} from "../scripts/plugin-secret-inventory.mjs";
const canary = "PRIVATE_PLUGIN_SETTING_CANARY";
function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(
    "CREATE TABLE options(name TEXT,value TEXT); CREATE TABLE _plugin_storage(plugin_id TEXT,data TEXT); CREATE TABLE _plugin_state(data TEXT);",
  );
  const scan = () =>
    summarisePluginSecretInventory(
      db.prepare(queries.options).get(),
      db.prepare(queries.storage).get(),
      db.prepare(queries.state).get(),
    );
  return { db, scan };
}
test("empty plugin stores include native options, not only collection/state tables, and never establish key health", (t) => {
  const f = fixture(t);
  f.db
    .prepare("INSERT INTO options VALUES (?,?)")
    .run("site:name", JSON.stringify(canary));
  f.db.exec("INSERT INTO _plugin_state VALUES (NULL),('');");
  const result = f.scan();
  assert.equal(result.storageObservation, "empty-plugin-stores");
  assert.equal(result.encryptionHealth, "unverified");
  assert.equal(result.rotationAuthorised, false);
  assert.equal(JSON.stringify(result).includes(canary), false);
});
test("native settings and encrypted envelopes are counted without returning names or values", (t) => {
  const f = fixture(t);
  for (const [name, value] of [
    [
      "plugin:fictional:settings:key",
      JSON.stringify({ $emdash: "plugin-setting", ciphertext: canary }),
    ],
    ["plugin:fictional:settings:ordinary", JSON.stringify(canary)],
    ["plugin:fictional:kv", "malformed-json"],
  ])
    f.db.prepare("INSERT INTO options VALUES (?,?)").run(name, value);
  const result = f.scan();
  assert.equal(result.storageObservation, "review-required");
  assert.equal(result.counts.pluginOptionRows, 3);
  assert.equal(result.counts.pluginSettingsRows, 2);
  assert.equal(result.counts.recognisedEncryptedOptionEnvelopes, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_PLUGIN|fictional|malformed-json/,
  );
});
test("nonempty legacy state or plugin collection rows force review regardless of options", (t) => {
  const f = fixture(t);
  f.db
    .prepare("INSERT INTO _plugin_storage VALUES (?,?)")
    .run("fictional", canary);
  f.db.prepare("INSERT INTO _plugin_state VALUES (?)").run(canary);
  assert.equal(f.scan().storageObservation, "review-required");
  assert.equal(JSON.stringify(f.scan()).includes(canary), false);
  assert.throws(
    () => summarisePluginSecretInventory({ plugin_option_rows: -1 }, {}, {}),
    /unavailable/,
  );
});
