// Ordinary creator publication through real native UI. Governed Team A stays a control.
import assert from "node:assert/strict";
import { nativeCall, nativeData } from "./native-auth.mjs";
const api = "/_emdash/api/plugins/composer-stacks/";
export async function qualifyNativeCreatorLifecycle({
  owner,
  publicPage,
  origin,
  workspace: controlWorkspace,
  stack: controlStack,
  instance: controlInstance,
  readContent,
  readPublic,
  capture,
  probeAdmin,
}) {
  const page = owner.page;
  const scopedRead =
    (workspace, stack) =>
    async (action, fields = {}) =>
      nativeData(
        await nativeCall(
          page,
          api +
            "read?" +
            new URLSearchParams({
              action,
              workspace,
              ...(stack ? { stack } : {}),
              ...fields,
            }),
        ),
      );
  const controlRead = scopedRead(controlWorkspace, controlStack),
    controlBefore = (await controlRead("open")).stack,
    controlResourcesBefore = (await controlRead("resources")).resources,
    controlContentBefore = await readContent();
  const awaitWrite = async (action, click) => {
    const pending = page.waitForResponse((response) => {
      if (
        !response.url().endsWith("/composer-stacks/write") ||
        response.request().method() !== "POST"
      )
        return false;
      try {
        return JSON.parse(response.request().postData()).action === action;
      } catch {
        return false;
      }
    });
    await click();
    const response = await pending;
    assert.equal(response.status(), 200);
    const raw = await response.json(),
      value = raw.data ?? raw;
    assert.ok(value.ok, JSON.stringify(raw));
    return value;
  };
  const matrix = async (name) =>
    probeAdmin(page, async (probe) => {
      const original = await probe.locator("html").getAttribute("data-mode");
      try {
        for (const width of [390, 1440])
          for (const theme of ["light", "dark"]) {
            await probe.setViewportSize({
              width,
              height: width === 390 ? 844 : 1000,
            });
            const toggle = probe.getByRole("button", {
              name: theme === "dark" ? "Switch to dark" : "Switch to light",
              exact: true,
            });
            if (await toggle.count()) await toggle.click();
            await probe.waitForFunction(
              (value) => document.documentElement.dataset.mode === value,
              theme,
              { timeout: 5000 },
            );
            await probe
              .getByRole("heading", { name: "Creator stacks", exact: true })
              .scrollIntoViewIfNeeded();
            assert.equal(
              await probe.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              true,
            );
            await capture(probe, `${name}-${width}-${theme}`);
          }
      } finally {
        if (["light", "dark"].includes(original)) {
          const toggle = probe.getByRole("button", {
            name: original === "dark" ? "Switch to dark" : "Switch to light",
            exact: true,
          });
          if (await toggle.count()) await toggle.click();
        }
      }
    });

  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/stacks?" +
      new URLSearchParams({ workspace: controlWorkspace, stack: controlStack }),
  );
  await page
    .getByRole("heading", {
      name: "Changes use application requests",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save draft", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Publish", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByLabel("Label", { exact: true }).isDisabled(),
    true,
  );
  assert.match(
    await page
      .getByRole("link", {
        name: "Open this workspace’s application requests",
        exact: true,
      })
      .getAttribute("href"),
    new RegExp("workspace=" + controlWorkspace),
  );
  await matrix("creator-governed-read-only");

  // An ordinary personal workspace is a distinct supported operating mode. No
  // profile, grant or policy is disabled to make the creator edit succeed.
  const ordinary = nativeData(await nativeCall(page, api + "read?action=list"));
  assert.equal(ordinary.lifecycle, "creator");
  assert.notEqual(ordinary.workspace.id, controlWorkspace);
  const workspace = ordinary.workspace.id;
  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/stacks?" +
      new URLSearchParams({ workspace }),
  );
  await page
    .getByLabel("New stack name", { exact: true })
    .fill("Fictional creator club page");
  const created = await awaitWrite("create", () =>
    page.getByRole("button", { name: "Create stack", exact: true }).click(),
  );
  const stack = created.stack.id,
    read = scopedRead(workspace, stack),
    open = async () => (await read("open")).stack;
  await page
    .getByRole("button", { name: "Add Here / there", exact: true })
    .click();
  let row = page.locator(".ca-stack-instance").first();
  await row.getByText(/Settings this app declares/).click();
  await row
    .getByLabel("Title", { exact: true })
    .fill("Fictional creator volunteer book");
  const applied = await awaitWrite("applyResources", () =>
    page
      .getByRole("button", { name: "Save and apply app settings", exact: true })
      .click(),
  );
  assert.ok(["applied", "unchanged"].includes(applied.outcome));
  await awaitWrite("publish", () =>
    page.getByRole("button", { name: "Publish", exact: true }).click(),
  );
  const before = await open(),
    instance = before.draft.instances[0].id,
    resourcesBefore = (await read("resources")).resources,
    selected = before.draft.instances[0];
  const bindingBefore = resourcesBefore.find(
    (value) => value.instance === instance,
  );
  assert.ok(bindingBefore?.configuration && bindingBefore.state === "ready");
  const publishedResourceBefore = before.published.instances.find(
    (value) => value.id === instance,
  )?.resource;
  assert.equal(publishedResourceBefore?.id, bindingBefore.resource);
  const bookBefore = (
    await read("resourceContent", {
      instance,
      expectedRevision: String(before.revision),
    })
  ).book;
  assert.equal(bookBefore.items.length, 0);
  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/stacks?" +
      new URLSearchParams({ workspace, stack }),
  );
  row = page.locator(".ca-stack-instance").first();
  const ownerLabel = "Fictional creator book · owner label",
    firstCaption = "Owner customisation: weekly rowing volunteers",
    secondCaption = "Owner customisation: next weekly round";
  const result = {
    version: "composer.native-creator-lifecycle/1",
    workspace,
    stack,
    instance,
    beforeRevision: before.revision,
    beforePublication: before.publishedRevision,
    control: {
      workspace: controlWorkspace,
      stack: controlStack,
      instance: controlInstance,
    },
    observations: [],
  };
  const publicState = async (stage, caption) => {
    const observation = await readPublic(publicPage, "/s/" + before.slug);
    assert.equal(observation.status, 200);
    assert.ok(observation.text.includes(ownerLabel));
    assert.ok(observation.text.includes(caption));
    if (caption === firstCaption)
      assert.equal(observation.text.includes(secondCaption), false);
    result.observations.push({
      stage,
      status: observation.status,
      sha256: observation.sha256,
    });
  };
  await row.getByLabel("Label", { exact: true }).fill(ownerLabel);
  await row.getByLabel("Caption", { exact: true }).fill(firstCaption);
  await page
    .locator(".ca-stack-preview")
    .getByText(firstCaption, { exact: true })
    .waitFor();
  const stillPublic = await readPublic(publicPage, "/s/" + before.slug);
  assert.equal(stillPublic.text.includes(firstCaption), false);
  await capture(page, "creator-owner-unsaved-preview");
  await awaitWrite("save", () =>
    page.getByRole("button", { name: "Save draft", exact: true }).click(),
  );
  const firstDraft = await open();
  assert.equal(firstDraft.publishedRevision, before.publishedRevision);
  assert.deepEqual(firstDraft.draft.instances[0].config, selected.config);
  await awaitWrite("publish", () =>
    page.getByRole("button", { name: "Publish", exact: true }).click(),
  );
  const first = await open();
  assert.equal(first.publishedRevision, firstDraft.revision);
  await publicState("first-publication", firstCaption);
  await row.getByLabel("Caption", { exact: true }).fill(secondCaption);
  assert.equal(
    await row.getByLabel("Label", { exact: true }).inputValue(),
    ownerLabel,
  );
  await page
    .locator(".ca-stack-preview")
    .getByText(secondCaption, { exact: true })
    .waitFor();
  await awaitWrite("save", () =>
    page.getByRole("button", { name: "Save draft", exact: true }).click(),
  );
  const secondDraft = await open();
  assert.equal(secondDraft.publishedRevision, first.publishedRevision);
  await publicState("second-draft-remains-private", firstCaption);
  await awaitWrite("publish", () =>
    page.getByRole("button", { name: "Publish", exact: true }).click(),
  );
  const second = await open();
  assert.equal(second.publishedRevision, secondDraft.revision);
  await publicState("second-publication", secondCaption);
  const history = page
    .locator(".ca-stack-history li")
    .filter({
      hasText: new RegExp("^Revision " + first.publishedRevision + "\\b"),
    });
  assert.equal(await history.count(), 1);
  page.once("dialog", (dialog) => dialog.accept());
  await awaitWrite("republish", () =>
    history
      .getByRole("button", { name: "Publish this revision", exact: true })
      .click(),
  );
  const restored = await open();
  assert.equal(restored.publishedRevision, first.publishedRevision);
  assert.equal(
    restored.published.instances.find((value) => value.id === instance).caption,
    firstCaption,
  );
  assert.equal(
    restored.draft.instances.find((value) => value.id === instance).caption,
    secondCaption,
  );
  await publicState("prior-publication-restored", firstCaption);
  const resourcesAfter = (await read("resources")).resources;
  assert.deepEqual(resourcesAfter, resourcesBefore);
  const retained = restored.draft.instances.find(
    (value) => value.id === instance,
  );
  assert.deepEqual(retained.config, selected.config);
  assert.deepEqual(
    restored.published.instances.find((value) => value.id === instance)
      .resource,
    publishedResourceBefore,
  );
  assert.equal(retained.label, ownerLabel);
  const bookAfter = (
    await read("resourceContent", {
      instance,
      expectedRevision: String(restored.revision),
    })
  ).book;
  assert.deepEqual(bookAfter.items, bookBefore.items);
  assert.deepEqual((await controlRead("open")).stack, controlBefore);
  assert.deepEqual(
    (await controlRead("resources")).resources,
    controlResourcesBefore,
  );
  assert.deepEqual(await readContent(), controlContentBefore);
  const publications = (await read("publications")).publications;
  assert.ok(
    publications.some((value) => value.revision === first.publishedRevision),
  );
  assert.ok(
    publications.some((value) => value.revision === second.publishedRevision),
  );
  await capture(page, "creator-publication-restored-owner-draft-retained");
  await matrix("creator-ordinary-round-trip");
  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/outcomes?" +
      new URLSearchParams({
        workspace,
        stack,
        instance,
        days: "7",
        traffic: "all",
      }),
  );
  await page
    .getByRole("heading", { name: "Workspace outcomes", exact: true })
    .waitFor();
  const report = nativeData(
    await nativeCall(
      page,
      api +
        "outcomesRead?" +
        new URLSearchParams({
          action: "report",
          workspace,
          stack,
          instance,
          days: "7",
          traffic: "all",
        }),
    ),
  );
  assert.equal(report.workspace.id, workspace);
  assert.equal(report.report.scope.stack, stack);
  assert.equal(report.report.scope.instance, instance);
  await capture(page, "creator-scoped-owner-outcomes");
  return {
    ...result,
    firstPublication: first.publishedRevision,
    secondPublication: second.publishedRevision,
    restoredPublication: restored.publishedRevision,
    retainedDraftRevision: restored.revision,
    ownerCustomisationPreserved: true,
    appConfigurationPreserved: true,
    resourceIdentityAndVersionPreserved: true,
    ordinaryAppRecordCount: 0,
    governedControlDataPreserved: true,
    publicationHistoryPreserved: true,
    outcomes: {
      scope: report.report.scope,
      traffic: report.report.traffic,
      metrics: report.report.metrics.map((value) => ({
        key: value.key,
        value: value.value,
        quality: value.quality,
      })),
      limits: report.report.limits,
    },
    limits: [
      "Actual native local workerd/EmDash and app-owned fictional data only; no production release or new customer admission.",
      "The ordinary creator book starts empty; nonempty Team A content/media is a separate unchanged governed control.",
      "Rollback changes the selected stored publication; the second draft and independent app configuration remain.",
      "Owner analytics are recorded lower bounds or unavailable observations, not people, revenue or adoption.",
    ],
  };
}
