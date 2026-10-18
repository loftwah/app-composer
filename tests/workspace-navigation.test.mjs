import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The plugin's public blocker hook must consume the host RouterProvider, not
// another installed copy of TanStack's React context after a dependency update.
test("native Creator navigation uses the exact EmDash host router module", () => {
  const project = createRequire(import.meta.url);
  const emdash = createRequire(project.resolve("emdash"));
  const admin = createRequire(emdash.resolve("@emdash-cms/admin"));
  assert.equal(
    realpathSync(project.resolve("@tanstack/react-router")),
    realpathSync(admin.resolve("@tanstack/react-router")),
  );
  const router = createRequire(project.resolve("@tanstack/react-router"));
  const core = createRequire(router.resolve("@tanstack/router-core"));
  assert.equal(
    realpathSync(router.resolve("@tanstack/history")),
    realpathSync(core.resolve("@tanstack/history")),
  );
  const historyEntry = realpathSync(router.resolve("@tanstack/history"));
  const manifest = new URL("../../package.json", pathToFileURL(historyEntry));
  assert.equal(JSON.parse(readFileSync(manifest, "utf8")).version, "1.162.2");
});
