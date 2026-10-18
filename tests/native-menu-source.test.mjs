import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeMenuSource } from "../scripts/native-menu-source.mjs";
import nativeMenu from "../src/integrations/native-menu.ts";

test("native adapter has a strict browser-only compiler and rejects Node ambient leakage", () => {
  const root = mkdtempSync(join(tmpdir(), "composer-native-menu-source-"));
  try {
    for (const name of [
      "tsconfig.native-launcher.json",
      "src/browser/native-launcher.ts",
      "src/browser/native-launcher-assets.d.ts",
      "src/lib/apps.ts",
    ]) {
      const target = join(root, name);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(
        target,
        readFileSync(new URL("../" + name, import.meta.url)),
      );
    }
    assert.doesNotThrow(() => checkNativeMenuSource(root));
    const path = join(root, "src/browser/native-launcher.ts");
    writeFileSync(
      path,
      readFileSync(path, "utf8") + "\nconsole.log(process.env.SECRET);\n",
    );
    assert.throws(
      () => checkNativeMenuSource(root),
      /Cannot find name 'process'/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("supported Astro page injection stays inactive on public, API and similarly named routes", async () => {
  const injections = [];
  const integration = nativeMenu();
  await integration.hooks["astro:config:setup"]({
    injectScript: (stage, code) => injections.push({ stage, code }),
  });
  assert.equal(injections.length, 1);
  assert.equal(injections[0].stage, "page");
  // No DOM/global work executes for ordinary public or private API responses.
  const execute = new Function("location", injections[0].code);
  for (const pathname of [
    "/",
    "/apps",
    "/_emdash/api/manifest",
    "/_emdash/administer",
    "/guestbook/",
  ])
    assert.doesNotThrow(() => execute({ pathname }));
});
