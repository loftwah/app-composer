import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";

const camera = { width: 1440, height: 1000 };
const sameViewport = (value) =>
  value?.width === camera.width && value?.height === camera.height;

// Full-page geometry probes use separate pages. They never resize or replace a
// primary actor camera, whose continuous WebM remains the film source.
export function nativeCapture({ actors, output, result, origin }) {
  const probes = new WeakSet();
  result.captureCamera = {
    primaryViewport: { ...camera },
    primaryFullPage: false,
    responsive:
      "Full-page probes on separate pages in the same actor context; probes close after inspection.",
    timing:
      "video.startedAt and screenshot.capturedAt are wall-clock provenance, not reliable source clip offsets. Select cuts from decoded video pixels only.",
  };
  const actorFor = (page) =>
    Object.entries(actors).find(
      ([, actor]) => actor.page.context() === page.context(),
    )?.[0] ?? "anonymous";

  async function screenshot(page, name) {
    assert.match(name, /^[a-z0-9][a-z0-9-]{0,150}$/);
    const path = name + ".png";
    assert.ok(
      !result.screenshots.includes(path),
      "Native capture path would overwrite an earlier observation.",
    );
    const fullPage = probes.has(page);
    assert.ok(
      fullPage || sameViewport(page.viewportSize()),
      "A primary native camera must retain its 1440 by 1000 viewport.",
    );
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const bytes = await page.screenshot({
      path: join(output, path),
      fullPage,
    });
    result.screenshots.push(path);
    result.captureAssets.push({
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      actor: actorFor(page),
      capturedAt: new Date().toISOString(),
    });
    await page.waitForTimeout(result.captureInspectionHoldMs);
  }

  async function responsivePage(primary, observe) {
    const actor = actorFor(primary);
    assert.ok(
      actor !== "anonymous" &&
        actors[actor].page === primary &&
        sameViewport(primary.viewportSize()),
      "Responsive inspection requires an existing primary native actor.",
    );
    const address = new URL(primary.url());
    const workspace = address.searchParams.get("workspace");
    const view = address.searchParams.get("view");
    assert.ok(
      address.origin === origin &&
        address.pathname === "/me" &&
        !address.hash &&
        /^[a-z0-9-]{6,64}$/.test(workspace ?? "") &&
        ["apps", "platform"].includes(view) &&
        [...address.searchParams.keys()].length === 2 &&
        address.searchParams.getAll("workspace").length === 1 &&
        address.searchParams.getAll("view").length === 1,
      "Responsive inspection must retain the exact existing member view and workspace.",
    );
    const probe = await primary.context().newPage();
    probes.add(probe);
    try {
      await probe.goto(address.href);
      const selected = probe.getByRole("combobox", { name: /^Workspace/ });
      await selected.waitFor({ state: "visible" });
      assert.equal(
        await selected.inputValue(),
        workspace,
        "The responsive page changed its selected workspace.",
      );
      if (view === "platform")
        await probe
          .getByRole("heading", {
            name: "Team application requests",
            exact: true,
          })
          .waitFor();
      else
        await probe.getByLabel("Your message", { exact: true }).waitFor({
          state: "visible",
        });
      await observe(probe);
    } finally {
      try {
        await probe.close();
      } finally {
        probes.delete(probe);
        assert.ok(
          sameViewport(primary.viewportSize()),
          "Responsive inspection changed the primary native camera.",
        );
      }
    }
  }

  async function responsiveAdminPage(primary, observe) {
    const actor = actorFor(primary),
      address = new URL(primary.url());
    assert.ok(
      actor !== "anonymous" &&
        actors[actor].page === primary &&
        sameViewport(primary.viewportSize()),
    );
    assert.ok(
      address.origin === origin &&
        address.pathname === "/_emdash/admin/plugins/composer-stacks/stacks" &&
        /^[a-z0-9-]{6,64}$/.test(address.searchParams.get("workspace") ?? "") &&
        /^[a-z0-9-]{6,64}$/.test(address.searchParams.get("stack") ?? "") &&
        [...address.searchParams.keys()].length === 2,
    );
    const probe = await primary.context().newPage();
    probes.add(probe);
    try {
      await probe.goto(address.href);
      await probe
        .getByRole("heading", { name: "Creator stacks", exact: true })
        .waitFor();
      await observe(probe);
    } finally {
      await probe.close();
      probes.delete(probe);
      assert.ok(sameViewport(primary.viewportSize()));
    }
  }

  return { screenshot, responsivePage, responsiveAdminPage };
}
