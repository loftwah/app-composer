import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { nativeCall, nativeData } from "./native-auth.mjs";

const stacks = "/_emdash/api/plugins/composer-stacks/";
const members = "/_emdash/api/plugins/composer-members/";
const request = (name) => ({
  version: 1,
  name,
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
});
const profile = {
  enabled: true,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
  reviewRequired: false,
};
const check = (value, message) => {
  if (!value) throw Error(message);
};
const data = async (page, path, body) =>
  nativeData(await nativeCall(page, path, body));
const read = (page, route, args) =>
  data(page, stacks + route + "?" + new URLSearchParams(args));
const write = (page, route, body) => data(page, stacks + route, body);
function denied(reply) {
  const value = reply.body?.data ?? reply.body;
  check(
    reply.status === 403 ||
      (value?.ok === false &&
        (value.code === "FORBIDDEN" || value.error?.code === "FORBIDDEN")),
    "Expected current authorization denial.",
  );
  return {
    status: reply.status,
    code: value.code ?? value.error?.code ?? "HTTP_403",
  };
}

export async function nativeJourney({ actors, lab, output }) {
  const owner = actors.owner.page,
    a = actors["creator-a"].page,
    b = actors["creator-b"].page;
  const result = { workspaces: [], checks: [], screenshots: [], limits: [] };
  async function openWorkspaceAccess(page) {
    await page.goto(
      lab.origins.composer +
        "/_emdash/admin/plugins/composer-stacks/workspaces",
    );
    await page.getByLabel("New workspace name").waitFor({ state: "visible" });
    // Actual EmDash first-login welcome makes the background controls inert.
    // Complete that native step instead of forcing clicks through its dialog.
    const welcome = page.getByRole("button", {
      name: "Get Started",
      exact: true,
    });
    if (await welcome.isVisible()) {
      await welcome.click();
      await welcome.waitFor({ state: "hidden" });
    }
  }
  async function screenshot(page, name) {
    await page.screenshot({
      path: join(output, name + ".png"),
      fullPage: true,
    });
    result.screenshots.push(name + ".png");
  }
  // The form is the actual native React workspaces page; the API confirms its persisted result.
  for (const [key, creator, name] of [
    ["a", a, "Fictional platform Team A"],
    ["b", b, "Fictional platform Team B"],
  ]) {
    await openWorkspaceAccess(owner);
    await owner.getByLabel("New workspace name").fill(name);
    await owner
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await owner.getByText(name, { exact: true }).first().waitFor();
    const spaces = await read(owner, "accessRead", { action: "list" });
    const workspace = spaces.workspaces.find((item) => item.name === name);
    check(
      workspace?.role === "owner",
      "Native workspace creation did not retain owner.",
    );
    const current = await read(owner, "accessRead", {
      action: "open",
      workspace: workspace.id,
    });
    await write(owner, "accessWrite", {
      action: "invite",
      workspace: workspace.id,
      expectedRevision: current.access.workspace.revision,
      email: "creator-" + key + "@example.test",
      role: "editor",
    });
    await openWorkspaceAccess(creator);
    const acceptance = creator.waitForResponse(
      (response) =>
        response.url().includes(stacks + "accessWrite") &&
        response.request().method() === "POST",
    );
    await creator
      .getByRole("button", { name: "Accept workspace invitation", exact: true })
      .click();
    await acceptance;
    const accepted = await read(creator, "accessRead", { action: "list" });
    check(
      accepted.workspaces.some(
        (item) => item.id === workspace.id && item.role === "editor",
      ),
      "Native workspace invitation was not accepted.",
    );
    const creatorPolicy = denied(
      await nativeCall(creator, stacks + "platformWrite", {
        action: "configure",
        workspace: workspace.id,
        expectedRevision: 0,
        profile,
      }),
    );
    await owner.goto(
      lab.origins.composer +
        "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
        workspace.id,
    );
    await owner.getByLabel("Enable platform requests").check();
    await owner.getByLabel("Require a separate operator decision").uncheck();
    await owner.getByLabel("Maximum applications").fill("2");
    for (const label of [
      "Allow the visitor book recipe",
      "Allow synthetic preview applications",
      "Allow fictional synthetic data",
    ])
      await owner.getByLabel(label).check();
    const policySave = owner.waitForResponse(
      (response) =>
        response.url().includes(stacks + "platformWrite") &&
        response.request().method() === "POST",
    );
    await owner
      .getByRole("button", { name: "Save workspace policy", exact: true })
      .click();
    await policySave;
    const configured = await read(owner, "platformRead", {
      action: "list",
      workspace: workspace.id,
    });
    check(configured.profile.enabled, "Standing policy was not persisted.");
    result.workspaces.push({
      key,
      id: workspace.id,
      name,
      nativeCreator: actors["creator-" + key].user.id,
      role: "editor",
      policyRevision: configured.profile.revision,
      creatorPolicy,
    });
    await screenshot(creator, "team-" + key + "-workspace");
  }
  result.checks.push(
    "Two role20 creators accepted actual editor invitations into distinct owner-created workspaces.",
  );
  const wa = result.workspaces[0].id,
    wb = result.workspaces[1].id;
  result.crossTeamRead = denied(
    await nativeCall(
      b,
      stacks +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace: wa }),
    ),
  );
  result.crossTeamWrite = denied(
    await nativeCall(b, stacks + "platformWrite", {
      action: "submit",
      workspace: wa,
      key: randomUUID(),
      request: request("Forbidden cross-team request"),
    }),
  );
  const ordinary = actors["app-user"].page;
  result.ordinaryUser = {
    role: actors["app-user"].user.role,
    read: denied(
      await nativeCall(
        ordinary,
        stacks +
          "platformRead?" +
          new URLSearchParams({ action: "list", workspace: wa }),
      ),
    ),
    write: denied(
      await nativeCall(ordinary, stacks + "platformWrite", {
        action: "submit",
        workspace: wa,
        key: randomUUID(),
        request: request("Forbidden ordinary request"),
      }),
    ),
  };
  check(
    result.ordinaryUser.read.status === 403 &&
      result.ordinaryUser.write.status === 403,
    "Role10 native dispatcher must return HTTP403.",
  );
  result.checks.push(
    "Cross-team reads/writes refused; ordinary native role10 platform read/write both HTTP403.",
  );
  async function snapshot(page, workspace) {
    return read(page, "platformRead", { action: "list", workspace });
  }
  async function completed(page, workspace, name) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const current = await snapshot(page, workspace),
        row = current.requests.find((item) => item.name === name);
      if (row?.status === "complete") return row;
      if (
        row &&
        ["denied", "unsupported", "needs-attention"].includes(row.status)
      )
        throw Error("Native request stopped: " + row.status + " " + row.reason);
      await page.waitForTimeout(500);
    }
    throw Error("Native request did not complete within bounded observation.");
  }
  async function submitUI(page, workspace, name) {
    await page.goto(
      lab.origins.composer +
        "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
        workspace,
    );
    await page.getByLabel("Application name").fill(name);
    await page
      .getByRole("button", { name: "Request application", exact: true })
      .click();
    return completed(page, workspace, name);
  }
  const initialA = await submitUI(a, wa, "Fictional Team A visitor book");
  const initialB = await submitUI(b, wb, "Fictional Team B visitor book");
  check(
    initialA.resources[0].resource !== initialB.resources[0].resource &&
      initialA.stackId !== initialB.stackId,
    "Teams share an owned identity.",
  );
  await screenshot(a, "team-a-complete");
  await screenshot(b, "team-b-complete");
  result.initial = { a: initialA, b: initialB };
  result.checks.push(
    "Actual native request UI provisioned two app-owned resources and published actual local StackView routes.",
  );
  const resource = initialA.resources[0];
  const people = await data(
    owner,
    members +
      "read?" +
      new URLSearchParams({ action: "people", workspace: wa }),
  );
  await data(owner, members + "write", {
    action: "grant",
    workspace: wa,
    expectedRevision: people.workspace.revision,
    member: actors["creator-a"].user.id,
    app: "guestbook",
    resource: resource.resource,
    capability: "moderate",
  });
  const memberList = await data(a, members + "write", {
    action: "guestbook",
    workspace: wa,
    resource: resource.resource,
    capability: "moderate",
    input: { operation: "list" },
  });
  result.namedService = { operation: "moderate/list", result: memberList };
  const currentPeople = await data(
    owner,
    members +
      "read?" +
      new URLSearchParams({ action: "people", workspace: wa }),
  );
  check(
    currentPeople.audit.some(
      (item) =>
        item.event === "dispatch" &&
        item.member === actors["creator-a"].user.id &&
        item.resource === resource.resource,
    ),
    "No server member dispatch audit.",
  );
  await data(owner, members + "write", {
    action: "grant",
    workspace: wa,
    expectedRevision: currentPeople.workspace.revision,
    member: actors["creator-a"].user.id,
    app: "guestbook",
    resource: resource.resource,
    capability: "contribute",
  });
  await a.goto(lab.origins.composer + "/me");
  await a.getByLabel("Workspace", { exact: true }).selectOption(wa);
  await a.getByRole("button", { name: "My apps", exact: true }).click();
  await a
    .getByRole("button", { name: "Load contributions to review", exact: true })
    .click();
  await a
    .getByText("No contributions need review in this visitor book.", {
      exact: true,
    })
    .waitFor();
  await screenshot(a, "team-a-member-empty-review");
  await a
    .getByLabel("Your message", { exact: true })
    .fill("Fictional closed-path probe");
  await a.getByLabel("Public alias", { exact: true }).fill("Fictional Team A");
  await a
    .getByLabel("I agree to publish this message and alias if approved.", {
      exact: true,
    })
    .check();
  const contributionResponse = a.waitForResponse(
    (response) =>
      response.url().includes(members + "write") &&
      response.request().method() === "POST",
  );
  await a
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  const response = await contributionResponse;
  const closed = { status: response.status(), body: await response.json() };
  const closedValue = closed.body?.data ?? closed.body;
  result.closedContribution = {
    ...denied(closed),
    result: closedValue,
    grantedContribute: true,
    recipeGuestAccess: "closed",
    bridgeMessage:
      "The member bridge intentionally returns a generic app-refusal message.",
  };
  await a
    .getByRole("alert")
    .filter({ hasText: "The app refused this operation" })
    .waitFor();
  await screenshot(a, "team-a-member-contribution-refused");
  result.crossTeamMember = denied(
    await nativeCall(b, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: resource.resource,
      capability: "moderate",
      input: { operation: "list" },
    }),
  );
  const opened = await read(a, "read", {
    action: "open",
    workspace: wa,
    stack: initialA.stackId,
  });
  const selection = {
    action: "resourceMedia",
    workspace: wa,
    stack: initialA.stackId,
    instance: resource.instance,
    expectedRevision: String(opened.stack.revision),
    item: "fictional-nonexistent-postcard",
  };
  result.crossTeamMedia = {
    ...denied(
      await nativeCall(b, stacks + "read?" + new URLSearchParams(selection)),
    ),
    existingPrivateMediaExercised: false,
  };
  result.limits.push(
    "Recipe closes guest contributions. Named member moderation list and dispatch are exercised; mutation of an existing pending postcard and existing private media are not established by this empty collection.",
  );
  await a.goto(
    lab.origins.composer +
      "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
      wa,
  );
  await a.getByRole("button", { name: "Plan an update", exact: true }).click();
  await a
    .getByLabel("Application name")
    .fill("Fictional Team A updated visitor book");
  await a
    .getByRole("button", { name: "Submit revised request", exact: true })
    .click();
  const updatedA = await completed(
    a,
    wa,
    "Fictional Team A updated visitor book",
  );
  const unchangedB = (await snapshot(b, wb)).requests.find(
    (item) => item.id === initialB.id,
  );
  check(
    updatedA.id === initialA.id &&
      updatedA.stackId === initialA.stackId &&
      updatedA.resources[0].resource === resource.resource,
    "Compatible update replaced retained identity.",
  );
  check(
    JSON.stringify(unchangedB) === JSON.stringify(initialB),
    "Team B changed after Team A update.",
  );
  result.updated = { a: updatedA, bUnchanged: true };
  await screenshot(a, "team-a-updated");
  const refused = await write(a, "platformWrite", {
    action: "submit",
    workspace: wa,
    key: randomUUID(),
    request: {
      ...request("Fictional sensitive request refused"),
      dataClass: "sensitive",
    },
  });
  const refusedRow = refused.requests.find(
    (item) => item.name === "Fictional sensitive request refused",
  );
  check(
    refusedRow?.decision.outcome === "denied" &&
      !refusedRow.stackId &&
      !refusedRow.resources.length,
    "Sensitive request created app state or escaped policy.",
  );
  result.policyDenied = refusedRow;
  await a.reload();
  await screenshot(a, "team-a-policy-denied");
  const publicContext = await a
    .context()
    .browser()
    .newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    });
  try {
    const page = await publicContext.newPage();
    result.public = [];
    for (const [key, row] of [
      ["a", updatedA],
      ["b", initialB],
    ]) {
      for (const [surface, path] of [
        ["stack", row.url],
        ["app", row.resources[0].configuration.path],
      ]) {
        check(
          typeof path === "string" &&
            path.startsWith("/") &&
            !path.startsWith("//"),
          "Unexpected public resource path.",
        );
        const response = await page.goto(lab.origins.composer + path);
        check(
          response.status() === 200 &&
            response.headers()["x-composer-isolated-lab"] ===
              lab.root.split("/").at(-1),
          "Public read escaped isolated runtime.",
        );
        check(
          (await page.locator("body").innerText()).includes(row.name),
          "Public document lacks current exact application name.",
        );
        result.public.push({
          team: key,
          surface,
          path,
          status: response.status(),
          nativeSession: false,
        });
        await screenshot(page, "team-" + key + "-public-" + surface);
      }
    }
  } finally {
    await publicContext.close();
  }
  result.checks.push(
    "UI update retained Team A identities and left Team B unchanged; sensitive request refused before app allocation; both actual public app and /s pages read without native session.",
  );
  return result;
}
