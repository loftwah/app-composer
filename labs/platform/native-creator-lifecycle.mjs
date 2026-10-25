// Opt-in extension of the real native team journey, using only its owned fixtures.
import assert from "node:assert/strict";
import { nativeCall, nativeData } from "./native-auth.mjs";
const api = "/_emdash/api/plugins/composer-stacks/";
export async function qualifyNativeCreatorLifecycle({
  owner,
  publicPage,
  origin,
  workspace,
  stack,
  instance,
  readContent,
  readPublic,
  capture,
}) {
  const page = owner.page;
  const read = async (action, fields = {}) =>
    nativeData(
      await nativeCall(
        page,
        api +
          "read?" +
          new URLSearchParams({ action, workspace, stack, ...fields }),
      ),
    );
  const open = async () => (await read("open")).stack;
  const before = await open(),
    resourcesBefore = (await read("resources")).resources,
    contentBefore = await readContent();
  assert.equal(before.status, "published");
  const selected = before.draft.instances.find(
    (value) => value.id === instance,
  );
  assert.ok(selected);
  const bindingBefore = resourcesBefore.find(
    (value) => value.instance === instance,
  );
  assert.ok(bindingBefore?.configuration && bindingBefore.state === "ready");
  const publishedResourceBefore = before.published.instances.find(
    (value) => value.id === instance,
  )?.resource;
  assert.equal(publishedResourceBefore?.id, bindingBefore.resource);
  const ownerLabel = "Fictional team visitor book · owner label",
    firstCaption = "Owner customisation: weekly rowing volunteers",
    secondCaption = "Owner customisation: next weekly round";
  const result = {
    version: "composer.native-creator-lifecycle/1",
    workspace,
    stack,
    instance,
    beforeRevision: before.revision,
    beforePublication: before.publishedRevision,
    observations: [],
  };
  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/stacks?" +
      new URLSearchParams({ workspace, stack }),
  );
  await page
    .getByRole("heading", { name: "Creator stacks", exact: true })
    .waitFor();
  const row = page
    .locator(".ca-stack-instance")
    .filter({ has: page.getByRole("textbox", { name: "Label", exact: true }) })
    .first();
  assert.equal(
    await row.getByLabel("Label", { exact: true }).inputValue(),
    selected.label,
  );
  const awaitWrite = async (action, click) => {
    const reply = page.waitForResponse((response) => {
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
    const response = await reply;
    assert.equal(response.status(), 200);
    const raw = await response.json();
    assert.ok((raw.data ?? raw).ok, JSON.stringify(raw));
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
  assert.equal(
    JSON.stringify(firstDraft.draft.instances[0].config),
    JSON.stringify(selected.config),
  );
  await awaitWrite("publish", () =>
    page.getByRole("button", { name: "Publish", exact: true }).click(),
  );
  const first = await open();
  assert.equal(first.publishedRevision, firstDraft.revision);
  assert.equal(
    first.published.instances.find((value) => value.id === instance).caption,
    firstCaption,
  );
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
  const history = page.locator(".ca-stack-history li").filter({
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
  const resourcesAfter = (await read("resources")).resources,
    contentAfter = await readContent();
  assert.deepEqual(resourcesAfter, resourcesBefore);
  assert.deepEqual(contentAfter, contentBefore);
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
  const publications = (await read("publications")).publications;
  assert.ok(
    publications.some((value) => value.revision === first.publishedRevision),
  );
  assert.ok(
    publications.some((value) => value.revision === second.publishedRevision),
  );
  await capture(page, "creator-publication-restored-owner-draft-retained");
  await page.goto(
    origin +
      "/_emdash/admin/plugins/composer-stacks/outcomes?" +
      new URLSearchParams({ workspace, stack, instance }),
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
    contentAndMediaPreserved: true,
    publicationHistoryPreserved: true,
    outcomes: {
      scope: report.report.scope,
      metrics: report.report.metrics.map((value) => ({
        key: value.key,
        value: value.value,
        quality: value.quality,
      })),
      limits: report.report.limits,
    },
    limits: [
      "Actual native local workerd/EmDash and app-owned fictional data only; no production release or new customer admission.",
      "Rollback changes the selected stored publication; the second draft and independent app data/media remain.",
      "Owner analytics are recorded lower bounds or unavailable observations, not people, revenue or adoption.",
    ],
  };
}
