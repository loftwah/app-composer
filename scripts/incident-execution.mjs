#!/usr/bin/env node
import { executeCaptionRecovery } from "./lib/incident-execution.mjs";
const args = process.argv.slice(2),
  command = args.shift();
if (command === "help" || !command) {
  console.log(
    "Local-only incident action: plan|execute --root OWNED_ROOT --workspace ID --proposal ID --digest SHA256 --actor OWNER_ID [--confirm-owner]. No HTTP/email endpoint or production support.",
  );
} else {
  const flags = {};
  try {
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      if (
        ![
          "--root",
          "--workspace",
          "--proposal",
          "--digest",
          "--actor",
          "--confirm-owner",
        ].includes(key) ||
        key in flags
      )
        throw Error("Unknown or duplicated argument.");
      flags[key] = key === "--confirm-owner" ? true : args[++i];
      if (flags[key] === undefined) throw Error("Missing argument value.");
    }
    for (const key of ["root", "workspace", "proposal", "digest", "actor"])
      if (typeof flags["--" + key] !== "string")
        throw Error("Missing --" + key);
    const result = await executeCaptionRecovery({
      root: flags["--root"],
      workspace: flags["--workspace"],
      proposal: flags["--proposal"],
      expectedDigest: flags["--digest"],
      actor: flags["--actor"],
      confirmOwner: flags["--confirm-owner"] === true,
      mode: command,
    });
    console.log(JSON.stringify(result, null, 2));
    if (!["ready", "recovered"].includes(result.state)) process.exitCode = 1;
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error.code ?? "REFUSED",
        message:
          "Action refused or unverified. Inspect the retained incident and local target before another attempt.",
      }),
    );
    process.exitCode = 1;
  }
}
