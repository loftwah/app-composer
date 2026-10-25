// Fixed metadata-only queries for the installed EmDash 1.3.1 storage layout.
// Counts never establish key validity, decryption or recovery of older backups.
export const pluginSecretInventoryQueries = Object.freeze({
  options: `SELECT COUNT(*) AS plugin_option_rows,
    COALESCE(SUM(CASE WHEN name LIKE 'plugin:%:settings:%' THEN 1 ELSE 0 END),0) AS plugin_settings_rows,
    COALESCE(SUM(CASE WHEN json_valid(value) THEN CASE WHEN json_extract(value,'$."$emdash"')='plugin-setting' THEN 1 ELSE 0 END ELSE 0 END),0) AS encrypted_envelopes
    FROM options WHERE name LIKE 'plugin:%'`,
  storage: "SELECT COUNT(*) AS plugin_storage_rows FROM _plugin_storage",
  state:
    "SELECT COUNT(*) AS plugin_state_rows, COALESCE(SUM(CASE WHEN LENGTH(data)>0 THEN 1 ELSE 0 END),0) AS nonempty_state_rows FROM _plugin_state",
});
const count = (value) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Metadata unavailable");
  return value;
};
export function summarisePluginSecretInventory(options, storage, state) {
  const counts = {
    pluginOptionRows: count(options.plugin_option_rows),
    pluginSettingsRows: count(options.plugin_settings_rows),
    recognisedEncryptedOptionEnvelopes: count(options.encrypted_envelopes),
    pluginStorageRows: count(storage.plugin_storage_rows),
    pluginStateRows: count(state.plugin_state_rows),
    nonemptyPluginStateRows: count(state.nonempty_state_rows),
  };
  if (
    counts.pluginSettingsRows > counts.pluginOptionRows ||
    counts.recognisedEncryptedOptionEnvelopes > counts.pluginOptionRows ||
    counts.nonemptyPluginStateRows > counts.pluginStateRows
  )
    throw Error("Metadata unavailable");
  return {
    schema: "composer.plugin-secret-inventory/1",
    counts,
    storageObservation:
      counts.pluginOptionRows === 0 &&
      counts.pluginStorageRows === 0 &&
      counts.nonemptyPluginStateRows === 0
        ? "empty-plugin-stores"
        : "review-required",
    encryptionHealth: "unverified",
    rotationAuthorised: false,
    note: "Metadata only. Nonempty stores require independent review; no plaintext, ciphertext, option names or credentials are returned. Key validity, decryptability and older backups are unverified.",
  };
}
