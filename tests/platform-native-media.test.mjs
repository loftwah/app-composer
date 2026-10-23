import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
  lstat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  actors,
  captions,
  chapters,
  inspectNativeMedia,
  planNativeEdit,
  sha256,
} from "../labs/platform/native-media-plan.mjs";
import { captionHTML, captionStamp } from "../labs/platform/media-captions.mjs";

// These are deliberately tiny static validator fixtures, never playable native
// recordings or qualification evidence. No browser, encoder or provider runs.
async function fixture(body) {
  const root = await mkdtemp(join(tmpdir(), "composer-native-media-test-"));
  try {
    const sources = Object.fromEntries(
      ["composer", "guestbook", "showcase"].map((name, i) => [
        name,
        { head: String(i + 1).repeat(40), dirty: false },
      ]),
    );
    const startedAt = "2026-10-23T10:00:00.000Z";
    const videos = [];
    for (const [index, actor] of actors.entries()) {
      const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, index]);
      const path = actor + ".webm";
      await writeFile(join(root, path), bytes);
      videos.push({
        actor,
        path,
        sha256: sha256(bytes),
        bytes: bytes.length,
        durationSeconds: 120,
        startedAt,
        continuous: true,
        privateStateExported: false,
        source: sources,
      });
    }
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
      "base64",
    );
    const captureAssets = [];
    for (const chapter of Object.keys(chapters)) {
      const path = chapter + ".png";
      await writeFile(join(root, path), png);
      captureAssets.push({
        path,
        sha256: sha256(png),
        actor: "anonymous",
        capturedAt: "2026-10-23T10:01:00.000Z",
      });
    }
    const row = (key) => ({
      id: "request-" + key,
      stackId: "stack-" + key,
      status: "complete",
      resources: [{ resource: "resource-" + key }],
    });
    const receipt = {
      schema: "composer.platform-native/1",
      qualification: "passed",
      startedAt,
      finishedAt: "2026-10-23T10:02:00.000Z",
      cleanup: {
        browserClosed: true,
        ownedRootRemoved: true,
        pointerRemoved: true,
      },
      preflight: {
        sources,
        authoredHashes: Object.fromEntries(
          [
            "labs/platform/native-run.mjs",
            "labs/platform/native-auth.mjs",
            "labs/platform/native-journey.mjs",
            "docs/platform/native-demo.md",
          ].map((name) => [name, "a".repeat(64)]),
        ),
        memberContract: {
          qualified: true,
          source: sources.guestbook.head,
          sourceOverride: false,
        },
      },
      copiedSource: sources,
      authentication: {
        nativeSessions: true,
        virtualPasskeys: true,
        productionAccess: false,
        insertedIdentityOrSessionRows: false,
      },
      capture: { status: "complete", expectedActors: 4, retainedActors: 4 },
      videos,
      journey: {
        memberSource: {
          revision: sources.guestbook.head,
          sourceOverride: false,
        },
        setup: [1, 2, 3].map(() => ({
          action: "configure",
          configurationObservationOnly: true,
        })),
        workspaces: ["a", "b"].map((key) => ({ key, id: "workspace-" + key })),
        initial: { a: row("a"), b: row("b") },
        ordinaryUser: {
          role: 10,
          ...Object.fromEntries(
            [
              "nativeConfigure",
              "memberConfigure",
              "nativeReview",
              "memberReview",
            ].map((key) => [key, { status: 403 }]),
          ),
        },
        contribution: { dataClass: "synthetic", resource: "resource-a" },
        publicAdmission: { accepts: false, state: "closed" },
        visibility: [404, 200, 404, 200].map((status) => ({ status })),
        updated: { contentPreserved: true, bUnchanged: true, a: row("a") },
        crossTeamRead: { status: 403 },
        crossTeamWrite: { status: 403 },
        policyDenied: {
          decision: { outcome: "denied" },
          stackId: null,
          resources: [],
        },
        screenshots: captureAssets.map((asset) => asset.path),
        captureAssets,
      },
    };
    const path = join(root, "receipt.json");
    const save = async () => {
      const bytes = JSON.stringify(receipt);
      await writeFile(path, bytes);
      return sha256(bytes);
    };
    const hash = await save();
    await body({ root, path, receipt, save, hash });
  } finally {
    await rm(root, { recursive: true, force: true });
    await assert.rejects(lstat(root), { code: "ENOENT" });
  }
}
function edit(native) {
  const selected = [
    "owner",
    "creator-a",
    "app-user",
    "app-user",
    "creator-b",
    "owner",
  ];
  const labels = [
    "authority",
    "delegation",
    "canvas",
    "update",
    "denials",
    "limits",
  ];
  const entries = (technical) =>
    Object.keys(chapters).flatMap((chapter, i) =>
      technical
        ? Object.entries(captions)
            .filter(
              ([key, value]) => key.includes("-") && value.chapter === chapter,
            )
            .map(([caption], index) => ({
              chapter,
              caption,
              kind: index === 0 ? "clip" : "still",
              asset: index === 0 ? selected[i] + ".webm" : chapter + ".png",
              ...(index === 0 ? { start: i === 3 || i === 5 ? 40 : 0 } : {}),
              duration: 12,
            }))
        : [
            {
              chapter,
              caption: labels[i],
              kind: "clip",
              asset: selected[i] + ".webm",
              start: i === 3 || i === 5 ? 40 : 0,
              duration: 8,
            },
            {
              chapter,
              caption: chapter === "boundaries" ? "recovery" : labels[i],
              kind: "still",
              asset: chapter + ".png",
              duration: 4.5,
            },
          ],
    );
  return {
    schema: "composer.platform-native-edit/1",
    nativeReceiptSHA256: native.receiptSHA256,
    films: { overview: entries(false), "technical-walkthrough": entries(true) },
  };
}

test("static native media validation binds one passed cleaned run, sources and capture-time hashes", async () => {
  await fixture(async ({ path, hash }) => {
    const native = await inspectNativeMedia(path, hash);
    const plan = planNativeEdit(edit(native), native);
    assert.deepEqual(
      plan.films.map((film) => film.duration),
      [75, 360],
    );
    assert.deepEqual(
      plan.films.map((film) => film.target),
      [75, 360],
    );
    for (const film of plan.films)
      for (const segment of film.segments) {
        assert.match(
          segment.provenance[0],
          /LOCAL DEMO.*workerd\/native sessions.*virtual passkeys.*public edge unqualified/,
        );
        assert.ok(
          segment.provenance.join(" ").includes(native.sources.composer),
        );
        assert.ok(
          segment.provenance.join(" ").includes(native.sources.guestbook),
        );
        assert.ok(
          segment.provenance.join(" ").includes(native.sources.showcase),
        );
        assert.ok(
          segment.provenance.join(" ").includes(native.teams.a.resource),
        );
        assert.ok(
          segment.provenance.join(" ").includes(native.teams.b.request),
        );
      }
    assert.match(
      plan.films[1].segments.find(
        (entry) => entry.caption === "boundaries-test",
      ).body,
      /not footage of an outage/,
    );
  });
});

test("failed, dirty, mismatched-source and incomplete native runs never become final media inputs", async () => {
  await fixture(async ({ path, receipt, save }) => {
    const original = structuredClone(receipt);
    for (const mutate of [
      (r) => (r.qualification = "failed"),
      (r) => (r.cleanup.pointerRemoved = false),
      (r) => (r.cleanup.error = "cleanup unresolved"),
      (r) => (r.preflight.sources.composer.dirty = true),
      (r) => (r.journey.memberSource.revision = "a".repeat(40)),
      (r) => (r.capture.status = "incomplete"),
      (r) =>
        (r.journey.captureAssets[1].path = r.journey.captureAssets[0].path),
      (r) => (r.videos[0].continuous = false),
      (r) => (r.authentication.insertedIdentityOrSessionRows = true),
      (r) => (r.journey.updated.contentPreserved = false),
      (r) => (r.journey.publicAdmission.accepts = true),
      (r) => (r.journey.ordinaryUser.role = 50),
      (r) => (r.journey.policyDenied.resources = [{ resource: "forbidden" }]),
    ]) {
      Object.assign(receipt, structuredClone(original));
      mutate(receipt);
      await assert.rejects(inspectNativeMedia(path, await save()));
    }
  });
});

test("legacy screenshots, changed bytes, foreign sources and linked captures fail closed", async () => {
  await fixture(async ({ root, path, hash, receipt, save }) => {
    await assert.rejects(
      inspectNativeMedia(path, "f".repeat(64)),
      /approved hash/,
    );
    const captureAssets = receipt.journey.captureAssets;
    delete receipt.journey.captureAssets;
    await assert.rejects(
      inspectNativeMedia(path, await save()),
      /Capture-time screenshot hashes/,
    );
    receipt.journey.captureAssets = captureAssets;
    await save();
    await writeFile(join(root, "authority.png"), "changed capture");
    await assert.rejects(
      inspectNativeMedia(path, await save()),
      /capture-time hash/,
    );
    await rm(join(root, "authority.png"));
    await symlink(join(root, "teams.png"), join(root, "authority.png"));
    await assert.rejects(inspectNativeMedia(path, await save()), /linked/);
    await rm(join(root, "authority.png"));
    await writeFile(
      join(root, "authority.png"),
      await readFile(join(root, "teams.png")),
    );
    receipt.videos[0].path = "../outside.webm";
    await assert.rejects(
      inspectNativeMedia(path, await save()),
      /single local capture/,
    );
    receipt.videos[0].path = "owner.webm";
    receipt.videos[0].source = structuredClone(receipt.videos[0].source);
    receipt.videos[0].source.guestbook.head = "e".repeat(40);
    await assert.rejects(
      inspectNativeMedia(path, await save()),
      /different native source/,
    );
    assert.notEqual(hash, await save());
  });
});

test("edits cannot borrow another receipt, accelerate, loop, escape footage or pad missing chapters", async () => {
  await fixture(async ({ path, hash }) => {
    const native = await inspectNativeMedia(path, hash);
    const original = edit(native);
    for (const mutate of [
      (e) => (e.nativeReceiptSHA256 = "f".repeat(64)),
      (e) => (e.films.overview[0].speed = 2),
      (e) => (e.films.overview[0].start = 119),
      (e) => (e.films.overview[0].asset = "not-captured.webm"),
      (e) => (e.films.overview[0].caption = "invented-success"),
      (e) => (e.films.overview[0].duration = 1.01),
      (e) => (e.films.overview[0].crop = { x: 0, y: 0, width: 1, height: 1 }),
      (e) => (e.films.overview[1].crop = { x: 0, y: 0, width: 2, height: 1 }),
      (e) => (e.films.overview[10].start = 0),
      (e) => e.films.overview.splice(0, 2),
      (e) =>
        e.films["technical-walkthrough"].forEach(
          (entry) => (entry.duration = 2),
        ),
    ]) {
      const changed = structuredClone(original);
      mutate(changed);
      assert.throws(() => planNativeEdit(changed, native));
    }
  });
});

test("validate-only uses no Playwright, ffmpeg, native execution or temporary render root", async () => {
  await fixture(async ({ root, path, hash }) => {
    const native = await inspectNativeMedia(path, hash);
    const editPath = join(root, "edit.json");
    await writeFile(editPath, JSON.stringify(edit(native)));
    const before = await readdir(root);
    const response = spawnSync(
      process.execPath,
      [
        resolve("labs/platform/capture-walkthrough.mjs"),
        "--native-receipt",
        path,
        "--expect-native-sha256",
        hash,
        "--native-edit",
        editPath,
        "--validate-only",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TMPDIR: root,
          PLAYWRIGHT_MODULE: "/unavailable-no-browser",
          FFMPEG_PATH: "/unavailable-no-encoder",
          FFPROBE_PATH: "/unavailable-no-probe",
        },
      },
    );
    assert.equal(response.status, 0, response.stderr);
    const result = JSON.parse(response.stdout);
    assert.equal(result.render, "not-run");
    assert.equal(result.browser, "not-started");
    assert.deepEqual(await readdir(root), before);
    assert.deepEqual(
      result.films.map((film) => film.duration),
      [75, 360],
    );
    const denied = spawnSync(
      process.execPath,
      [
        resolve("labs/platform/capture-walkthrough.mjs"),
        "--native-receipt",
        path,
        "--native-edit",
        editPath,
        "--render",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /shared-host admission/);
  });
});

test("technical duration cannot substitute for distinct explanations and actual actor footage", async () => {
  await fixture(async ({ path, hash }) => {
    const native = await inspectNativeMedia(path, hash);
    const thin = edit(native);
    for (const entry of thin.films["technical-walkthrough"]) {
      entry.caption = Object.entries(captions).find(
        ([key, value]) => !key.includes("-") && value.chapter === entry.chapter,
      )[0];
    }
    assert.throws(
      () => planNativeEdit(thin, native),
      /distinct maintained technical explanations/,
    );
    const oneActor = edit(native);
    let index = 0;
    for (const entry of oneActor.films["technical-walkthrough"])
      if (entry.kind === "clip") {
        entry.asset = "owner.webm";
        entry.start = index++ * 15;
      }
    assert.throws(
      () => planNativeEdit(oneActor, native),
      /all four actual actor recordings/,
    );
    const shortFootage = edit(native);
    for (const entry of shortFootage.films["technical-walkthrough"])
      if (entry.kind === "clip") entry.duration = 8;
    assert.throws(
      () => planNativeEdit(shortFootage, native),
      /at least a minute/,
    );
  });
});

test("shared caption strips escape text and preserve source lines without remote assets", () => {
  const html = captionHTML({
    font: "local-font-bytes",
    heading: "<script>bad</script>",
    body: "A & B",
    provenance: ["source <unsafe>"],
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /source &lt;unsafe&gt;/);
  assert.match(html, /font\/woff2;base64,local-font-bytes/);
  assert.equal(captionStamp(75.5), "00:01:15.500");
});
