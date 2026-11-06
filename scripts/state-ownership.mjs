// A narrow guard for the admin React boundary, not a ban on useState.
// Composer's server records stay authoritative; a component that performs its
// own data call and keeps the result in useState must also carry a stale or
// unmount guard (a generation ref, an active/live ref, or an AbortController).
// Form drafts, disclosure toggles and ephemeral status remain ordinary state.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_CALL =
  /\b(?:apiFetch|ordersCall|callCollection|call|request|fetch)\s*\(/;
const STALE_GUARD = /\buseRef\b|AbortController|controller\.signal/;

function sources(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) files.push(path);
    }
  };
  for (const name of ["src/plugins", "src/components"]) {
    try {
      walk(join(root, name));
    } catch {
      // A partial checkout may not contain both surfaces.
    }
  }
  return files.map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

/** Returns the files that fetch server data without a stale-response guard. */
export function stateOwnershipViolations(files) {
  return files
    .filter(
      ({ source }) =>
        source.includes("useState") &&
        DATA_CALL.test(source) &&
        !STALE_GUARD.test(source),
    )
    .map(({ path }) => path);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL("..", import.meta.url).pathname;
  const violations = stateOwnershipViolations(sources(root));
  if (violations.length) {
    console.error(
      "Admin components fetch server data without a stale/unmount guard:",
    );
    for (const path of violations) console.error("  " + relative(root, path));
    console.error(
      "Keep server data authoritative and add a generation/active ref or AbortController. See docs/react-state-ownership.md.",
    );
    process.exitCode = 1;
  } else {
    console.log("Admin React state guards pass.");
  }
}
