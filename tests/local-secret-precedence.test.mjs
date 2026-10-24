import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  unlinkSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unstable_getVarsForDev } from "wrangler";

test("the pinned Wrangler local secret loader chooses dev.vars and its actual env precedence", (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-connection-loader-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  const previous = process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV;
  process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = "false";
  t.after(() => {
    if (previous === undefined)
      delete process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV;
    else process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = previous;
  });
  const write = (name, value) =>
    writeFileSync(
      join(root, name),
      `COMPOSER_FICTIONAL_PRECEDENCE="${value}"\n`,
    );
  const load = () =>
    unstable_getVarsForDev(
      join(root, "wrangler.jsonc"),
      undefined,
      {},
      "preview",
      true,
    );
  write(".env", "base");
  write(".env.local", "local");
  write(".env.preview", "environment");
  write(".env.preview.local", "environment-local");
  assert.equal(load().COMPOSER_FICTIONAL_PRECEDENCE.value, "environment-local");
  unlinkSync(join(root, ".env.preview.local"));
  // This is the installed 4.143.1 export, not a new application loader. Its
  // environment file overrides .env.local, unlike the currently published
  // ordering on the Cloudflare secrets page. Keep this version-specific.
  assert.equal(load().COMPOSER_FICTIONAL_PRECEDENCE.value, "environment");
  write(".dev.vars", "dev-vars");
  assert.equal(load().COMPOSER_FICTIONAL_PRECEDENCE.value, "dev-vars");
  write(".dev.vars.preview", "dev-vars-environment");
  assert.equal(
    load().COMPOSER_FICTIONAL_PRECEDENCE.value,
    "dev-vars-environment",
  );
  writeFileSync(
    join(root, ".dev.vars.preview"),
    'COMPOSER_OTHER_FICTIONAL="only-this-file"\n',
  );
  assert.equal(load().COMPOSER_FICTIONAL_PRECEDENCE, undefined);
  assert.equal(load().COMPOSER_OTHER_FICTIONAL.value, "only-this-file");
  const ignore = readFileSync(
    new URL("../.gitignore", import.meta.url),
    "utf8",
  );
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^\.dev.vars\*$/m);
});
