// Seed the local fictional composition from the downloaded Init specification.
// This uses the same app-owned resource and configuration contracts as the
// hosted apps. It only talks to explicitly selected localhost Workers.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const guestbook = process.env.GUESTBOOK_URL || "https://localhost:8788";
const linkarooie = process.env.LINKAROOIE_URL || "https://localhost:8787";
const token = process.env.OWNER_TOKEN || "build-199-fictional-owner";
const resource = process.env.RESOURCE_ID || "build199-trail";
const specPath = process.env.INIT_SPEC || "public/downloads/building-199-init-spec.json";
const out = process.env.SEED_OUT || "output/build-199/seed.json";
if (!/^[a-z0-9-]{6,64}$/.test(resource)) throw Error("Use a safe resource ID.");
if (!/^https:\/\/localhost:\d+$/.test(guestbook) || !/^https:\/\/localhost:\d+$/.test(linkarooie))
  throw Error("This local seeder only targets explicit localhost Workers.");
// Local Wrangler uses a self-signed certificate. This exception is scoped to
// this process and the localhost URLs asserted above; it is never a hosted path.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const build = async (base) => {
  const response = await fetch(base + "/build.json");
  if (!response.ok) throw Error("Could not read " + base + "/build.json");
  return response.json();
};
const guestbookBuild = await build(guestbook);
const linkarooieBuild = await build(linkarooie);
const operation = (action) => `${action}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-Composer-Workspace": "build199workspace",
  "X-Composer-Account": "build199account",
  "X-Composer-Environment": "local",
  "X-Composer-Source": guestbookBuild.revision,
  "X-Composer-Target": guestbook,
};
const request = async (url, init = {}) => {
  const response = await fetch(url, init);
  const value = await response.json();
  if (!response.ok) throw Error(url + ": " + response.status + " " + JSON.stringify(value));
  return value;
};
const resourceURL = `${guestbook}/api/resources/${resource}`;
const snapshot = () => request(resourceURL, { headers });
const command = (body) =>
  request(resourceURL, { method: "POST", headers, body: JSON.stringify(body) });

const created = await command({ action: "create", operationId: operation("create") });
const staged = await command({
  action: "stage",
  operationId: operation("stage"),
  expectedVersion: created.resource.version,
  configuration: spec.appSettings.guestbook,
});
const active = await command({
  action: "activate",
  operationId: operation("activate"),
  expectedVersion: staged.resource.version,
  configurationRevision: staged.configuration.revision,
  configurationDigest: staged.configuration.digest,
});
const source = {
  kind: "guestbook.resource",
  version: 1,
  resource,
  configuration: active.configuration.revision,
};

const showcaseHeaders = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Origin: linkarooie,
};
await request(linkarooie + "/api/config", {
  method: "POST",
  headers: showcaseHeaders,
  body: JSON.stringify({
    ...spec.appSettings.showcase,
    handle: "build199",
    website: "https://example.test/build-199",
    github: "https://github.com/loftwah/app-composer",
    banner: "",
    avatar: "",
  }),
});
const existing = await request(linkarooie + "/api/export", {
  headers: { Authorization: `Bearer ${token}` },
});
const decoration = {
  "Field notes: the long way round": { icon: "book", group: "Writing", pinned: true },
  "A small toolkit for slow software": { icon: "code", group: "Projects", pinned: true },
  "Weekend radio": { icon: "music", group: "Music", pinned: false },
  "Reading list, autumn": { icon: "book", group: "Writing", pinned: false },
};
for (const card of spec.cards) {
  if (existing.cards.some((old) => old.title === card.title && old.url === card.url)) continue;
  const saved = await request(linkarooie + "/api/cards", {
    method: "POST",
    headers: showcaseHeaders,
    body: JSON.stringify({ ...card, description: "", status: "published" }),
  });
  await request(linkarooie + "/api/presentation", {
    method: "POST",
    headers: showcaseHeaders,
    body: JSON.stringify({ id: saved.id, ...decoration[card.title] }),
  });
}
const invitation = await request(linkarooie + "/api/invitation", {
  method: "POST",
  headers: showcaseHeaders,
  body: JSON.stringify({ action: "enable", source, expected: null }),
});
const report = {
  generated: new Date().toISOString(),
  guestbook,
  linkarooie,
  resource,
  source,
  builds: { guestbook: guestbookBuild.revision, linkarooie: linkarooieBuild.revision },
  initSpec: { path: specPath, sha256: createHash("sha256").update(readFileSync(specPath)).digest("hex") },
  invitation,
};
mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
