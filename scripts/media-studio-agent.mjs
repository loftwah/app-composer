#!/usr/bin/env node
// Authorised agent operations for the Media capability. The browser panel and
// this CLI reach the same handlers, the same validation and the same job rows.
//
//   MEDIA_AGENT_TOKEN=… node scripts/media-studio-agent.mjs status
//   … generate --kind image --model <id> --prompt "…" [--reference /path]
//   … generate --kind video --model <id> --prompt "…" --seconds 5 --resolution 720p
//   … reconcile --id job_…
//   … import --id job_…
//   … disable | enable | refresh
//
// The token is read from the process environment and is never printed.
const base = (process.env.APP_COMPOSER_AGENT_URL || "https://composer.loftwah.com").replace(/\/$/, "");
const token = process.env.MEDIA_AGENT_TOKEN;
if (!token) {
  console.error(
    "Set MEDIA_AGENT_TOKEN in this process environment. It is the deployment secret, not the OWNER key.",
  );
  process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);
const flags = {};
for (let index = 0; index < rest.length; index += 1) {
  const value = rest[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = rest[index + 1];
  if (next === undefined || next.startsWith("--")) flags[key] = true;
  else {
    flags[key] = next;
    index += 1;
  }
}

const actions = {
  status: { action: "status" },
  enable: { action: "enable" },
  disable: { action: "disable" },
  refresh: { action: "refresh" },
  generate: {
    action: "generate",
    kind: flags.kind || "image",
    model: flags.model,
    prompt: flags.prompt,
    ...(flags.width ? { width: Number(flags.width) } : {}),
    ...(flags.height ? { height: Number(flags.height) } : {}),
    ...(flags.seconds ? { durationSeconds: Number(flags.seconds) } : {}),
    ...(flags.resolution ? { resolution: String(flags.resolution) } : {}),
    ...(flags.reference ? { referencePath: String(flags.reference) } : {}),
  },
  reconcile: { action: "reconcile", id: flags.id },
  import: { action: "import", id: flags.id },
};

const body = actions[command];
if (!body) {
  console.error("Unknown command. Use one of: " + Object.keys(actions).join(", "));
  process.exit(2);
}
if (command === "generate" && (!body.model || !body.prompt)) {
  console.error("generate needs --model and --prompt.");
  process.exit(2);
}

const response = await fetch(base + "/api/media-agent", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    "X-Agent-Name": process.env.AGENT_NAME || "local-media-agent",
    Origin: base,
  },
  body: JSON.stringify(body),
});
const text = await response.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.error("Unreadable reply: " + text.slice(0, 400));
  process.exit(1);
}
if (!payload.ok) {
  console.error(payload.error || "The request was refused.");
  process.exit(1);
}
console.log(JSON.stringify(payload.data, null, 1));
