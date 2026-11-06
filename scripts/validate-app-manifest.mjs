// Validate one independent mini-app manifest and its optional app-owned agent
// capability declaration. Read-only: this grants no permission and calls no app.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateManifest } from "./contracts.mjs";

const file = resolve(process.argv[2] ?? "app.manifest.json");
const manifest = JSON.parse(readFileSync(file, "utf8"));
validateManifest(manifest);
if (manifest.agentCapabilities === undefined)
  throw new Error(
    "This manifest has no app-owned agent capability declaration.",
  );
const declaration = manifest.agentCapabilities;
console.log(
  JSON.stringify(
    {
      ok: true,
      file,
      app: manifest.id,
      contract: manifest.contract,
      declarationVersion: declaration.version,
      ui: declaration.ui ?? null,
      storage: declaration.storage ?? null,
      operations: declaration.operations.map((operation) => ({
        name: operation.name,
        kind: operation.kind,
        method: operation.method,
        path: operation.path,
        availability: operation.availability,
        requires: operation.requires,
        confirmation: operation.confirmation,
        verified: operation.verified,
      })),
    },
    null,
    2,
  ),
);
