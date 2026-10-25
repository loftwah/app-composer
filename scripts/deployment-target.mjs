import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
  lstatSync,
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
  constants,
} from "node:fs";
import {
  pluginSecretInventoryQueries,
  summarisePluginSecretInventory,
} from "./plugin-secret-inventory.mjs";
import { join } from "node:path";
export function assertFreshPushedMain(sha, remoteRef) {
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    typeof remoteRef !== "string" ||
    remoteRef.trim() !== `${sha}\trefs/heads/main`
  )
    throw Error(
      "Remote main changed or could not be verified. Reconstruct the current release before any remote mutation.",
    );
}
export function assertProductionEnvironment(environment) {
  if (environment.CLOUDFLARE_ENV)
    throw Error(
      "Production deployment refuses a selected Cloudflare environment.",
    );
}
export function compositionServices(lock) {
  const services = lock.apps.map((app) => ({
    binding: app.id.toUpperCase(),
    service: "composer-" + app.id + "-" + lock.id.slice(0, 16),
  }));
  if (
    lock.apps.find((app) => app.id === "guestbook")?.manifest?.memberService
  ) {
    services.push({
      binding: "GUESTBOOK_MEMBERS",
      service: "composer-guestbook-" + lock.id.slice(0, 16),
      entrypoint: "GuestbookMemberService",
    });
  }
  return services;
}
export function assertProductionTarget(config, generated, lock) {
  if (
    config.name !== "app-composer" ||
    config.vars?.PUBLIC_ORIGIN !== "https://composer.loftwah.com" ||
    generated.name !== config.name ||
    generated.account_id !== config.account_id ||
    generated.vars?.PUBLIC_ORIGIN !== config.vars.PUBLIC_ORIGIN
  )
    throw Error(
      "Generated deployment does not match the selected production identity.",
    );
  for (const app of lock.apps) {
    const expected = "composer-" + app.id + "-" + lock.id.slice(0, 16);
    for (const value of [config, generated]) {
      const bindings = value.services?.filter(
        (binding) => binding.binding === app.id.toUpperCase(),
      );
      if (bindings?.length !== 1 || bindings[0].service !== expected)
        throw Error(
          "Deployment service differs from the reviewed composition.",
        );
    }
  }
  const expected = compositionServices(lock);
  for (const value of [config, generated]) {
    if (
      value.services?.length !== expected.length ||
      expected.some(
        (service) =>
          !value.services.some(
            (actual) =>
              actual.binding === service.binding &&
              actual.service === service.service &&
              actual.entrypoint === service.entrypoint,
          ),
      )
    )
      throw Error("Unexpected generated app service connection.");
  }
}
export function parseAdminSecrets(bytes) {
  let secrets;
  try {
    secrets = JSON.parse(bytes);
  } catch {
    throw Error("Invalid private mini-app connection file.");
  }
  if (!secrets || Array.isArray(secrets) || typeof secrets !== "object")
    throw Error("Invalid private mini-app connection file.");
  const keys = Object.keys(secrets).sort();
  const ownerKeys = ["GUESTBOOK_OWNER_TOKEN", "SHOWCASE_OWNER_TOKEN"];
  const memberKeys = [
    ...ownerKeys,
    "GUESTBOOK_MEMBER_TOKEN",
    "COMPOSER_PROFILE_BRIDGE_TOKEN",
  ].sort();
  if (
    ![JSON.stringify(ownerKeys), JSON.stringify(memberKeys)].includes(
      JSON.stringify(keys),
    ) ||
    keys.some(
      (key) =>
        typeof secrets[key] !== "string" ||
        !secrets[key] ||
        secrets[key].length > 4096 ||
        /[\r\n]/.test(secrets[key]),
    )
  )
    throw Error(
      "Use only the selected mini-app owner connections and the paired member connections.",
    );
  if (keys.length === 4 && new Set(keys.map((key) => secrets[key])).size !== 4)
    throw Error("Member and owner connections must use separate credentials.");
  return JSON.stringify(secrets);
}
export function snapshotAdminSecrets(validated, workspace) {
  const privateRoot = join(workspace, ".private");
  mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(join(privateRoot, "admin-deploy-")),
    path = join(directory, "secrets.json");
  try {
    writeFileSync(path, validated, { flag: "wx", mode: 0o600 });
  } catch {
    try {
      unlinkSync(path);
    } catch {}
    rmdirSync(directory);
    throw Error("Private deployment snapshot could not be created.");
  }
  return {
    path,
    remove() {
      unlinkSync(path);
      rmdirSync(directory);
    },
  };
}

// Bounded initial empty-store recovery only; this deliberately accepts no key
// ring, arbitrary binding, target override or general secret-rotation input.
export function parseEmdashEncryptionSecrets(bytes) {
  if (typeof bytes !== "string")
    throw Error("Invalid private EmDash encryption file.");
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    throw Error("Invalid private EmDash encryption file.");
  }
  const keys =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)
      : [];
  const key = value?.EMDASH_ENCRYPTION_KEY;
  if (
    keys.length !== 1 ||
    keys[0] !== "EMDASH_ENCRYPTION_KEY" ||
    typeof key !== "string" ||
    !/^emdash_enc_v1_[A-Za-z0-9_-]{43}$/.test(key) ||
    !/^\s*\{\s*"EMDASH_ENCRYPTION_KEY"\s*:\s*"emdash_enc_v1_[A-Za-z0-9_-]{43}"\s*\}\s*$/.test(
      bytes,
    )
  )
    throw Error("Use exactly one canonical native EmDash encryption key.");
  const suffix = key.slice("emdash_enc_v1_".length),
    decoded = Buffer.from(suffix, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== suffix)
    throw Error("Use exactly one canonical native EmDash encryption key.");
  return JSON.stringify({ EMDASH_ENCRYPTION_KEY: key });
}
export function readEmdashEncryptionSecrets(workspace) {
  const parent = join(workspace, ".private"),
    path = join(parent, "emdash-encryption-secrets.json");
  let fd;
  try {
    const directory = lstatSync(parent);
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      (directory.mode & 0o777) !== 0o700 ||
      directory.uid !== process.getuid?.()
    )
      throw Error("Private directory refused");
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const file = fstatSync(fd);
    if (
      !file.isFile() ||
      file.nlink !== 1 ||
      (file.mode & 0o777) !== 0o600 ||
      file.uid !== process.getuid?.() ||
      file.size > 256
    )
      throw Error("Private file refused");
    return parseEmdashEncryptionSecrets(readFileSync(fd, "utf8"));
  } catch {
    throw Error(
      "The approved EmDash key file must be one owned regular 0600 file in the 0700 .private directory.",
    );
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
export function combineDeploymentSecrets(admin, emdash) {
  if (!admin && !emdash) return null;
  return JSON.stringify({
    ...(admin ? JSON.parse(parseAdminSecrets(admin)) : {}),
    ...(emdash ? JSON.parse(parseEmdashEncryptionSecrets(emdash)) : {}),
  });
}
export async function assertEmptyPluginStoresForFreshKey(query) {
  try {
    const rows = {};
    for (const [store, sql] of Object.entries(pluginSecretInventoryQueries)) {
      const result = await query(sql);
      if (
        !Array.isArray(result) ||
        result.length !== 1 ||
        result[0]?.success !== true ||
        !Array.isArray(result[0]?.results) ||
        result[0].results.length !== 1
      )
        throw Error("Invalid metadata");
      rows[store] = result[0].results[0];
    }
    const observation = summarisePluginSecretInventory(
      rows.options,
      rows.storage,
      rows.state,
    );
    if (observation.storageObservation !== "empty-plugin-stores")
      throw Error("Nonempty plugin store");
    return observation;
  } catch {
    throw Error(
      "Fresh EmDash key deployment refused: all plugin options, collection storage and state data must be confirmed empty immediately before upload.",
    );
  }
}
