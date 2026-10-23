import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { nativeCapture } from "../labs/platform/native-capture.mjs";

const origin = "https://composer.example.test";
const workspace = "fictional-team-a";
const address = origin + "/me?view=platform&workspace=" + workspace;

function fixture({ url = address, selected = workspace, fail } = {}) {
  const calls = [],
    bytes = Buffer.from("actual returned screenshot bytes");
  let probe;
  const context = {
    async newPage() {
      calls.push("newPage");
      probe = page("probe");
      return probe;
    },
  };
  function page(label) {
    let viewport = { width: 1440, height: 1000 };
    return {
      context: () => context,
      url: () => url,
      viewportSize: () => viewport,
      async setViewportSize(value) {
        viewport = value;
        calls.push(label + ":resize");
      },
      async goto(value) {
        calls.push({ label, goto: value });
        if (fail === "goto") throw Error("Fictional navigation failure");
      },
      getByRole: () => ({
        async waitFor() {},
        async inputValue() {
          return selected;
        },
      }),
      getByLabel: () => ({ async waitFor() {} }),
      async evaluate() {
        calls.push(label + ":settled");
      },
      async screenshot(options) {
        calls.push({ label, screenshot: options });
        if (fail === "screenshot") throw Error("Fictional screenshot failure");
        return bytes;
      },
      async waitForTimeout(value) {
        calls.push({ label, hold: value });
      },
      async close() {
        calls.push(label + ":closed");
      },
    };
  }
  const primary = page("primary");
  const result = {
    screenshots: [],
    captureAssets: [],
    captureInspectionHoldMs: 2000,
  };
  const capture = nativeCapture({
    actors: { "app-user": { page: primary } },
    output: "/fictional-owned-output",
    result,
    origin,
  });
  return { ...capture, primary, result, calls, bytes, probe: () => probe };
}

test("primary capture keeps the viewport camera and hashes actual returned bytes", async () => {
  const f = fixture();
  await f.screenshot(f.primary, "fictional-primary");
  assert.deepEqual(f.calls.find((value) => value.screenshot)?.screenshot, {
    path: "/fictional-owned-output/fictional-primary.png",
    fullPage: false,
  });
  const asset = f.result.captureAssets[0];
  assert.equal(asset.actor, "app-user");
  assert.equal(
    asset.sha256,
    createHash("sha256").update(f.bytes).digest("hex"),
  );
  assert.equal(new Date(asset.capturedAt).toISOString(), asset.capturedAt);
  assert.deepEqual(f.result.screenshots, ["fictional-primary.png"]);
  assert.deepEqual(f.calls.at(-1), { label: "primary", hold: 2000 });
  await assert.rejects(
    f.screenshot(f.primary, "fictional-primary"),
    /overwrite/,
  );
  assert.equal(f.calls.filter((value) => value.screenshot).length, 1);
  await f.primary.setViewportSize({ width: 390, height: 844 });
  await assert.rejects(
    f.screenshot(f.primary, "fictional-resized"),
    /primary native camera/,
  );
  assert.equal(f.result.screenshots.length, 1);
});

test("responsive probe reuses the session and exact scope without resizing or replacing primary", async () => {
  const f = fixture();
  await f.responsivePage(f.primary, async (probe) => {
    assert.notEqual(probe, f.primary);
    assert.equal(probe.context(), f.primary.context());
    await probe.setViewportSize({ width: 390, height: 844 });
    await f.screenshot(probe, "fictional-responsive");
  });
  assert.deepEqual(
    f.calls.find((value) => value.goto),
    { label: "probe", goto: address },
  );
  assert.equal(
    f.calls.find((value) => value.screenshot)?.screenshot.fullPage,
    true,
  );
  assert.equal(f.result.captureAssets[0].actor, "app-user");
  assert.deepEqual(f.primary.viewportSize(), { width: 1440, height: 1000 });
  assert.ok(!f.calls.includes("primary:resize"));
  assert.equal(f.calls.at(-1), "probe:closed");
});

for (const failure of ["goto", "workspace", "observe", "screenshot"])
  test("responsive probe closes after " + failure + " failure", async () => {
    const f = fixture({
      selected: failure === "workspace" ? "foreign-team" : workspace,
      fail: failure,
    });
    await assert.rejects(
      f.responsivePage(f.primary, async (probe) => {
        if (failure === "observe") throw Error("Fictional geometry failure");
        await f.screenshot(probe, "fictional-responsive");
      }),
    );
    assert.equal(f.calls.at(-1), "probe:closed");
    assert.deepEqual(f.primary.viewportSize(), { width: 1440, height: 1000 });
    assert.equal(f.result.captureAssets.length, 0);
  });

for (const url of [
  "https://foreign.example.test/me?view=platform&workspace=" + workspace,
  origin + "/_emdash/admin?view=platform&workspace=" + workspace,
  address + "&workspace=foreign-team",
  address + "&token=fictional",
  address + "#changed",
  origin + "/me?view=unknown&workspace=" + workspace,
])
  test("responsive probe refuses changed member scope: " + url, async () => {
    const f = fixture({ url });
    await assert.rejects(
      f.responsivePage(f.primary, () => assert.fail("Unexpected probe")),
      /exact existing member view/,
    );
    assert.ok(!f.calls.includes("newPage"));
  });
