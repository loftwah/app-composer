import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  rmSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePackage } from "../lib/launch-kit/package.mjs";
import { zip, unzip } from "../lib/launch-kit/archive.mjs";
import { sha256 } from "../lib/launch-kit/contract.mjs";
import { validateAdoption } from "../lib/launch-kit/adoption.mjs";
import {
  createContentProject,
  createBrandedContentProject,
  createLaunchKitProject,
} from "../lib/content-model/project.mjs";
import { starterModel } from "../lib/content-model/index.mjs";
const bytes = new Uint8Array(
  readFileSync(
    new URL("./fixtures/launch-kit/night-signal-v1.zip", import.meta.url),
  ),
);
const adoption = async (
  fields = { title: true, subtitle: true, icons: true, social: true },
) =>
  validateAdoption({
    format: "app-composer.launch-kit-adoption",
    version: 1,
    packageSha256: await sha256(bytes),
    fields,
  });
test("package is complete checked PNG data, never executable imported markup", async () => {
  const kit = await validatePackage(bytes);
  assert.equal(kit.files.size, 13);
  assert.equal(kit.settings.title, "Night Signal");
  for (const mutate of [
    (files) => files.set("evil.html", new Uint8Array()),
    (files) =>
      files.set("favicon-16.png", files.get("favicon-16.png").slice(0, 33)),
  ]) {
    const files = unzip(bytes);
    mutate(files);
    await assert.rejects(() => validatePackage(zip(files)));
  }
});
test("explicit adoption creates app-owned assets and safe app-specific manifest, preserves absent field defaults", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "launch-kit-test-")));
  try {
    const destination = join(root, "content");
    await createBrandedContentProject({
      model: starterModel,
      destination,
      packageBytes: bytes,
      adoption: await adoption(),
    });
    const manifest = JSON.parse(
      readFileSync(join(destination, "public/launch-kit/site.webmanifest")),
    );
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.name, "Night Signal");
    const branding = JSON.parse(
      readFileSync(join(destination, "src/launch-kit-branding.json")),
    );
    assert.equal(branding.title, "Night Signal");
    assert.equal(branding.icons, true);
    assert.deepEqual(
      new Uint8Array(
        readFileSync(join(destination, "public/launch-kit/icon-192.png")),
      ),
      (await validatePackage(bytes)).files.get("icon-192.png"),
    );
    const existingAdoption = await adoption();
    await assert.rejects(() =>
      createBrandedContentProject({
        model: starterModel,
        destination,
        packageBytes: bytes,
        adoption: existingAdoption,
      }),
    );
    assert.equal(
      JSON.parse(
        readFileSync(join(destination, "src/launch-kit-branding.json")),
      ).title,
      "Night Signal",
    );
    const kept = join(root, "kept");
    await createBrandedContentProject({
      model: starterModel,
      destination: kept,
      packageBytes: bytes,
      adoption: await adoption({
        title: false,
        subtitle: false,
        icons: true,
        social: false,
      }),
    });
    assert.equal(
      JSON.parse(readFileSync(join(kept, "public/launch-kit/site.webmanifest")))
        .name,
      starterModel.label,
    );
    assert.equal(
      existsSync(join(kept, "public/launch-kit/social-1200x630.png")),
      false,
    );
    assert.throws(() =>
      createContentProject({
        model: starterModel,
        destination: join(root, "unsafe"),
        prepared: {},
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("fresh static app has real timer and exact selected identity, refuses mismatched adoption and existing destination", async () => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "launch-kit-static-test-")),
  );
  try {
    const destination = join(root, "app"),
      a = await adoption();
    await createLaunchKitProject({
      destination,
      packageBytes: bytes,
      adoption: a,
      origin: "https://composer.loftwah.com",
      base: "/launch-kit/example/",
    });
    const html = readFileSync(join(destination, "public/index.html"), "utf8");
    assert.match(html, /<title>Night Signal<\/title>/);
    assert.match(html, /id="start"/);
    assert.match(html, /property="og:url" content="https:\/\/composer\.loftwah\.com\/launch-kit\/example\/"/);
    const manifest = JSON.parse(
      readFileSync(join(destination, "public/site.webmanifest")),
    );
    assert.equal(manifest.start_url, "/launch-kit/example/");
    assert.equal(manifest.scope, "/launch-kit/example/");
    await assert.rejects(() =>
      createLaunchKitProject({ destination, packageBytes: bytes, adoption: a }),
    );
    await assert.rejects(() =>
      createLaunchKitProject({
        destination: join(root, "bad"),
        packageBytes: bytes,
        adoption: { ...a, packageSha256: "0".repeat(64) },
      }),
    );
    assert.equal(existsSync(join(root, "bad")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
