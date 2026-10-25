#!/usr/bin/env node
// Read-only plan: input must contain native observations and independently hashed media.
import { readFileSync, statSync } from "node:fs";
import { planPublisherReconciliation } from "../lib/wordpress/reconcile.mjs";
const args = process.argv.slice(2);
try {
  if (args.length !== 2 || args[0] !== "--input")
    throw Error(
      "Use node scripts/wordpress-reconcile.mjs --input /path/to/private-observations.json",
    );
  if (statSync(args[1]).size > 2 * 1024 * 1024)
    throw Error("Use a bounded observation file below 2 MiB.");
  const result = planPublisherReconciliation(
    JSON.parse(readFileSync(args[1], "utf8")),
  );
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  console.error(
    ["ZodError", "SyntaxError"].includes(error.name)
      ? "The observation file does not match the bounded publisher contract. No action was performed."
      : error.message,
  );
  process.exitCode = 1;
}
