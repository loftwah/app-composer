import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const text = (path) => read(path).toString("utf8");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the build story is a real article with correct metadata and source links", () => {
  const page = text("src/pages/building.astro");
  assert.match(page, /Building App Composer,/);
  assert.match(page, /building-hero-20261022\.jpg/);
  assert.match(page, /canonical="https:\/\/composer\.loftwah\.com\/building"/);
  assert.match(page, /TechArticle/);
  assert.match(page, /019ce0d117f9f89e472a5c7642d51d85301f7fcd/);
  assert.match(page, /20ef9a50c19c7a3419dc06fdae020c6a677ed5cf/);
  assert.match(page, /Docker was not used for this run/);
  assert.match(page, /local run is not a deployment|does not prove a Cloudflare deployment|not a deployment/i);
  assert.match(page, /story is not|not claiming|not a retrospective/i);
  assert.match(page, /Narration and shot list/);
  assert.doesNotMatch(page, /fully self-service|guaranteed recovery|one-click migration/i);
});

test("every article image exists, matches its declared dimensions and capture provenance", () => {
  const page = text("src/pages/building.astro");
  const provenance = JSON.parse(text("public/guides/building/provenance.json"));
  const images = new Map(provenance.images.map((image) => [image.name, image]));
  const references = [...page.matchAll(/<img src="\/guides\/building\/([^"]+)" width="(\d+)" height="(\d+)"/g)];
  assert(references.length >= 9, "the article must use the captured plates");
  for (const [, name, width, height] of references) {
    const image = images.get(name);
    assert(image, name + " must be in provenance");
    assert.equal(image.width, Number(width), name + " width");
    assert.equal(image.height, Number(height), name + " height");
    const bytes = read("public/guides/building/" + name);
    assert.equal(bytes.byteLength, image.bytes, name + " bytes");
    assert.equal(sha(bytes), image.sha256, name + " hash");
  }
  assert(existsSync(new URL("public/brand/building/building-hero-20261022.png", root)));
  assert(existsSync(new URL("public/brand/building/building-hero-wide-20261022.webp", root)));
  assert(existsSync(new URL("public/brand/building/building-hero-mobile-20261022.webp", root)));
  assert(existsSync(new URL("public/brand/building/building-hero-20261022.jpg", root)));
  assert(existsSync(new URL(".artwork/building/hero.html", root)));
  assert(existsSync(new URL(".artwork/building/render.sh", root)));
});

test("the Init specification and its published copy carry the same bytes", () => {
  const spec = read("public/downloads/building-199-init-spec.json");
  const provenance = JSON.parse(text("public/guides/building/provenance.json"));
  assert.equal(spec.byteLength, provenance.initSpec.bytes);
  assert.equal(sha(spec), provenance.initSpec.sha256);
  const value = JSON.parse(spec.toString("utf8"));
  assert.equal(value.preset, "composition");
  assert.equal(value.appSettings.showcase.layout, "profile");
  assert.equal(value.appSettings.guestbook.guestAccess, "postcards");
  assert.equal(value.deployment.mode, "preview");
  assert.doesNotMatch(spec.toString("utf8"), /token|secret|password|credential/i);
});

test("the editable diagrams have source, light/dark plates, phone variants and text equivalents", () => {
  const page = text("src/pages/building.astro");
  const dimensions = JSON.parse(text("public/diagrams/journey-dimensions.json"));
  for (const name of ["architecture", "workflow", "contribution"]) {
    assert(existsSync(new URL(`public/diagrams/building-${name}-20261023.d2`, root)));
    assert(existsSync(new URL(`public/diagrams/building-${name}-20261023-mobile.d2`, root)));
    for (const variant of ["dark", "light", "mobile-dark", "mobile-light"])
      assert(existsSync(new URL(`public/diagrams/building-${name}-20261023-${variant}.svg`, root)), name + " " + variant);
    assert(dimensions[`building-${name}`].desktop.width > 0);
    assert(dimensions[`building-${name}`].mobile.height > 0);
    assert.match(page, new RegExp(`/diagrams/building-${name}-20261023-dark\\.svg`));
    assert.match(page, new RegExp(`/diagrams/building-${name}-20261023-light\\.svg`));
  }
  assert.match(page, /Text version of the contribution flow/);
  assert.match(page, /Text version of the architecture/);
  assert.match(page, /Text version of the workflow/);
});

test("the build story is discoverable and the maintained contract note is linked", () => {
  assert.match(text("src/pages/sitemap.xml.ts"), /'\/building'/);
  assert.match(text("src/components/ProductHome.astro"), /href="\/building"/);
  assert.match(text("src/pages/learn.astro"), /href="\/building"/);
  const note = text("docs/guestbook-contributions.md");
  assert.match(note, /GET \/r\/:resource\/api\/invitation/);
  assert.match(note, /open \| paused \| closed \| full|open, paused, closed or full/);
  assert.match(note, /does not provide a public comment thread/);
  assert.match(text("docs/README.md"), /guestbook-contributions\.md/);
});

test("the owner diagram caption explains the product boundary instead of its implementation", () => {
  const page = text("src/pages/manage.astro");
  assert.doesNotMatch(page, /The diagram is authored in the page as SVG/);
  assert.match(page, /Read left to right/);
  assert.match(page, /not an arbitrary plugin runtime or a second content store/);
  assert.match(page, /restoring code does not bring deleted data back/);
  assert.match(page, /Here \/ there owns photo submissions and private media/);
  assert.match(page, /Linkarooie owns links, featured notes and curation/);
});

test("the local procedure and capture scripts are executable and scoped to owned resources", () => {
  const start = text("labs/building/start-local.sh");
  assert.match(start, /mktemp -d/);
  assert.match(start, /trap cleanup EXIT INT TERM/);
  assert.match(start, /--persist-to "\$TMPROOT\/guestbook"/);
  assert.doesNotMatch(start, /rm -rf \/|pkill -f wrangler|killall/);
  assert.equal(execFileSync("sh", ["-n", new URL("labs/building/start-local.sh", root).pathname]).toString(), "");
  assert.equal(execFileSync("sh", ["-n", new URL("labs/building/stop-local.sh", root).pathname]).toString(), "");
  const seed = text("labs/building/seed-local.mjs");
  assert.match(seed, /only targets explicit localhost Workers/);
  assert.match(seed, /NODE_TLS_REJECT_UNAUTHORIZED = "0"/);
  const capture = text("labs/building/capture-journey.mjs");
  assert.match(capture, /pending review|pending receipt|Postcard sent/i);
  assert.match(capture, /hide \/ revoke|hidden source content disappears/);
  assert.match(capture, /report\.json/);
  assert.match(text("labs/building/README.md"), /Docker is \*\*not\*\* used/);
});
