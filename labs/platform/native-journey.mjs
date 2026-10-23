import { createHash, randomUUID } from "node:crypto";
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
  allowMemberContributions: true,
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

export async function nativeJourney({ actors, lab, output, memberSource }) {
  const owner = actors.owner.page,
    a = actors["creator-a"].page,
    b = actors["creator-b"].page;
  const result = {
    workspaces: [],
    checks: [],
    screenshots: [],
    captureAssets: [],
    limits: [],
  };
  check(
    /^[a-f0-9]{40}$/.test(memberSource),
    "Select the actual locked qualified Guestbook source.",
  );
  async function publicFetch(page, path, limit = 500000) {
    // Node APIRequestContext does not inherit Chromium's host resolver. All
    // public proof must use the mapped browser and omit its native credentials.
    return page.evaluate(
      async ({ path, origin, marker, limit }) => {
        const address = new URL(path, location.origin);
        if (
          address.origin !== origin ||
          !address.pathname.startsWith("/guestbook/") ||
          address.pathname !== path
        )
          throw Error("Public proof path escaped the fixed local application.");
        const response = await fetch(path, {
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (response.headers.get("x-composer-isolated-lab") !== marker)
          throw Error("Public proof did not reach the isolated TLS bridge.");
        const reader = response.body?.getReader();
        if (!reader) throw Error("Public proof returned no body.");
        const chunks = [];
        let length = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > limit)
              throw Error("Public proof exceeded its byte bound.");
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const digest = new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes),
        );
        return {
          status: response.status,
          bytes: length,
          contentType: response.headers.get("content-type"),
          sha256: Array.from(digest, (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
          text: response.headers.get("content-type")?.includes("json")
            ? new TextDecoder().decode(bytes)
            : undefined,
        };
      },
      {
        path,
        origin: lab.origins.composer,
        marker: lab.root.split("/").at(-1),
        limit,
      },
    );
  }
  const build = await publicFetch(owner, "/guestbook/build.json", 32768);
  const buildIdentity = JSON.parse(build.text);
  const expectedService = {
    version: 2,
    entrypoint: "GuestbookMemberService",
    transport: "service-binding",
    path: "/__composer/member",
  };
  check(
    build.status === 200 &&
      buildIdentity.revision === memberSource &&
      Object.keys(buildIdentity.memberService ?? {}).length === 4 &&
      Object.entries(expectedService).every(
        ([key, value]) => buildIdentity.memberService[key] === value,
      ),
    "Actual mounted Guestbook build does not match the exact locked v2 descriptor/source.",
  );
  result.memberSource = {
    revision: memberSource,
    descriptor: buildIdentity.memberService,
    sourceOverride: false,
  };
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
    check(
      !result.screenshots.includes(name + ".png"),
      "Native capture path would overwrite an earlier observation.",
    );
    const bytes = await page.screenshot({
      path: join(output, name + ".png"),
      fullPage: true,
    });
    result.screenshots.push(name + ".png");
    result.captureAssets.push({
      path: name + ".png",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      actor:
        Object.entries(actors).find(([, actor]) => actor.page === page)?.[0] ??
        "anonymous",
      capturedAt: new Date().toISOString(),
    });
  }
  async function observeSetup(page, workspace, label) {
    await page.goto(
      lab.origins.composer + "/ready?profile=platform&workspace=" + workspace,
    );
    await page
      .getByRole("button", { name: "Check my signed-in access", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Set the standing rules", exact: true })
      .waitFor();
    check(
      (await page.locator("body").innerText()).includes("can configure policy"),
      "Native owner policy capability was not observed by Get Ready.",
    );
    const continuation = page.getByRole("link", {
      name: "Open protected platform",
      exact: true,
    });
    const href = await continuation.getAttribute("href");
    check(
      href ===
        "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
          workspace,
      "Get Ready substituted the selected policy workspace.",
    );
    (result.setup ??= []).push({
      workspace,
      label,
      action: "configure",
      href,
      configurationObservationOnly: true,
    });
    await screenshot(page, "ready-" + label);
    return continuation;
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
    if (key === "a") {
      const personal = accepted.workspaces.find(
        (space) => space.role === "owner",
      );
      check(
        personal,
        "The actual Creator personal owner context was not retained.",
      );
      await observeSetup(creator, personal.id, "creator20-owner");
    }
    const creatorPolicy = denied(
      await nativeCall(creator, stacks + "platformWrite", {
        action: "configure",
        workspace: workspace.id,
        expectedRevision: 0,
        profile,
      }),
    );
    const continueSetup = await observeSetup(
      owner,
      workspace.id,
      "operator-team-" + key,
    );
    await continueSetup.click();
    await owner.getByLabel("Enable platform requests").check();
    await owner.getByLabel("Require a separate operator decision").uncheck();
    await owner.getByLabel("Maximum applications").fill("2");
    await owner
      .getByLabel(
        "Allow member-only contributions on qualified synthetic services",
      )
      .check();
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
  const memberRead = (page, workspace) =>
    data(
      page,
      members +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace }),
    );
  result.ordinaryUser = { role: actors["app-user"].user.role };
  for (const [key, route, body] of [
    [
      "nativeRead",
      stacks +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace: wa }),
    ],
    [
      "nativeWrite",
      stacks + "platformWrite",
      {
        action: "submit",
        workspace: wa,
        key: randomUUID(),
        request: request("Forbidden ordinary native request"),
      },
    ],
    [
      "memberRead",
      members +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace: wa }),
    ],
    [
      "memberWrite",
      members + "platformWrite",
      {
        action: "submit",
        workspace: wa,
        key: randomUUID(),
        request: request("Forbidden undelegated member request"),
      },
    ],
  ]) {
    result.ordinaryUser[key] = denied(await nativeCall(ordinary, route, body));
    check(
      result.ordinaryUser[key].status === 403,
      "Undelegated role10 platform denial must remain HTTP403.",
    );
  }
  result.checks.push(
    "Ordinary native role10 has no platform authority before explicit editor delegation; native and member routes return HTTP403.",
  );

  // This is an actual owner invitation and native /me acceptance, not a role or
  // membership row inserted by the harness. The global role stays Subscriber.
  const access = await read(owner, "accessRead", {
    action: "open",
    workspace: wa,
  });
  await write(owner, "accessWrite", {
    action: "invite",
    workspace: wa,
    expectedRevision: access.access.workspace.revision,
    email: "app-user@example.test",
    role: "editor",
  });
  await ordinary.goto(lab.origins.composer + "/me");
  await ordinary
    .getByRole("button", { name: "Accept workspace invitation", exact: true })
    .click();
  await ordinary
    .getByRole("button", { name: "Team application requests", exact: true })
    .waitFor();
  const session = await data(ordinary, members + "read?action=session");
  check(
    session.workspaces.some(
      (space) => space.id === wa && space.role === "editor",
    ),
    "Role10 editor delegation was not confirmed by the current member session.",
  );
  const nativeIdentity = nativeData(
    await nativeCall(ordinary, "/_emdash/api/auth/me"),
  );
  check(
    nativeIdentity.id === actors["app-user"].user.id &&
      nativeIdentity.role === 10,
    "Delegation changed global native role.",
  );
  const delegated = await memberRead(ordinary, wa);
  check(
    delegated.workspace.id === wa && delegated.workspace.role === "editor",
    "Member adapter did not retain the selected explicit workspace.",
  );
  for (const [key, route, command] of [
    [
      "nativeConfigure",
      stacks + "platformWrite",
      {
        action: "configure",
        expectedRevision: delegated.profile.revision,
        profile,
      },
    ],
    [
      "memberConfigure",
      members + "platformWrite",
      {
        action: "configure",
        expectedRevision: delegated.profile.revision,
        profile,
      },
    ],
    [
      "nativeReview",
      stacks + "platformWrite",
      {
        action: "review",
        id: randomUUID(),
        expectedRevision: 1,
        decision: "accept",
        reason: "Forbidden operator action",
      },
    ],
    [
      "memberReview",
      members + "platformWrite",
      {
        action: "review",
        id: randomUUID(),
        expectedRevision: 1,
        decision: "accept",
        reason: "Forbidden operator action",
      },
    ],
  ]) {
    result.ordinaryUser[key] = denied(
      await nativeCall(ordinary, route, { workspace: wa, ...command }),
    );
    check(
      result.ordinaryUser[key].status === 403,
      "Delegated Subscriber gained native operator admission.",
    );
  }
  result.delegation = {
    workspace: wa,
    role: "editor",
    nativeRole: nativeIdentity.role,
    invitationAcceptedInUI: true,
  };
  result.crossTeamDelegated = denied(
    await nativeCall(
      ordinary,
      members +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace: wb }),
    ),
  );

  const snapshot = (page, workspace) =>
    read(page, "platformRead", { action: "list", workspace });
  async function completed(page, workspace, name, member = false) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const current = await (member
        ? memberRead(page, workspace)
        : snapshot(page, workspace));
      const row = current.requests.find((item) => item.name === name);
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
  await ordinary.goto(
    lab.origins.composer + "/ready?profile=platform&workspace=" + wa,
  );
  await ordinary
    .getByRole("button", { name: "Check my signed-in access", exact: true })
    .click();
  await ordinary
    .getByRole("heading", { name: "Request a team application", exact: true })
    .waitFor();
  await screenshot(ordinary, "ready-role10-team-a-request");
  const initLink = ordinary.getByRole("link", {
    name: "Continue in Init with this team",
    exact: true,
  });
  check(
    (await initLink.getAttribute("href")) ===
      "/init?profile=platform&workspace=" + wa,
    "Get Ready changed the member's selected team before Init.",
  );
  await initLink.click();
  const requestLink = ordinary.getByRole("link", {
    name: "Open application requests",
    exact: true,
  });
  check(
    (await requestLink.getAttribute("href")) ===
      "/me?view=platform&workspace=" + wa,
    "Init did not retain the delegated member request path and selected team.",
  );
  await screenshot(ordinary, "init-role10-team-a-request");
  await requestLink.click();
  await ordinary
    .getByRole("heading", { name: "Team application requests", exact: true })
    .waitFor();
  check(
    (await ordinary
      .getByRole("combobox", { name: /^Workspace/ })
      .inputValue()) === wa,
    "Readiness deep link changed workspace.",
  );
  await ordinary
    .getByLabel("Application name", { exact: true })
    .fill("Fictional Team A member visitor book");
  await ordinary
    .getByRole("combobox", { name: /^Contributions/ })
    .selectOption("members");
  await ordinary
    .getByRole("button", { name: "Request application", exact: true })
    .click();
  const initialA = await completed(
    ordinary,
    wa,
    "Fictional Team A member visitor book",
    true,
  );
  check(
    initialA.request.contributions === "members" &&
      initialA.plan.contributionMode.effective === "members" &&
      initialA.plan.contributionMode.qualified,
    "The explicit members requirement was substituted or remained unsupported.",
  );
  await b.goto(
    lab.origins.composer +
      "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
      wb,
  );
  await b
    .getByLabel("Application name", { exact: true })
    .fill("Fictional Team B closed visitor book");
  await b
    .getByRole("combobox", { name: /^Contributions/ })
    .selectOption("closed");
  await b
    .getByRole("button", { name: "Request application", exact: true })
    .click();
  const initialB = await completed(
    b,
    wb,
    "Fictional Team B closed visitor book",
  );
  check(
    initialA.resources[0].resource !== initialB.resources[0].resource &&
      initialA.stackId !== initialB.stackId,
    "Teams share an owned resource identity.",
  );
  result.initial = { a: initialA, b: initialB };
  await screenshot(ordinary, "team-a-role10-members-complete");
  await screenshot(b, "team-b-closed-complete");
  const resource = initialA.resources[0],
    caption = "Fictional Team A native member postcard",
    author = "Fictional invited member";
  result.beforeAppGrant = denied(
    await nativeCall(ordinary, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: resource.resource,
      capability: "contribute",
      input: {
        operationId: randomUUID(),
        caption,
        author,
        consent: true,
        png: "not-sent-without-grant",
      },
    }),
  );

  async function grantUI(member, capability) {
    await owner.goto(lab.origins.composer + "/people");
    await owner.getByRole("combobox", { name: /^Workspace/ }).selectOption(wa);
    await owner.getByRole("combobox", { name: /^Person/ }).selectOption(member);
    await owner
      .getByRole("combobox", { name: /^App/ })
      .selectOption("guestbook");
    await owner
      .getByRole("combobox", { name: /^Action/ })
      .selectOption(capability);
    await owner
      .getByRole("combobox", { name: /^Existing visitor-book resource/ })
      .selectOption(resource.resource);
    const response = owner.waitForResponse(
      (reply) =>
        reply.url().includes(members + "write") &&
        reply.request().method() === "POST",
    );
    await owner
      .getByRole("button", { name: "Grant selected action", exact: true })
      .click();
    const reply = await response;
    nativeData({ status: reply.status(), body: await reply.json() });
    await owner
      .getByText(
        "Selected permission granted. Other app permissions are unchanged.",
        { exact: true },
      )
      .waitFor();
  }
  await grantUI(actors["app-user"].user.id, "contribute");
  await grantUI(actors["creator-a"].user.id, "moderate");
  const people = await data(
    owner,
    members +
      "read?" +
      new URLSearchParams({ action: "people", workspace: wa }),
  );
  check(
    people.grants.some(
      (grant) =>
        grant.member === actors["app-user"].user.id &&
        grant.resource === resource.resource &&
        grant.action === "contribute",
    ),
    "Exact contribution grant was not persisted.",
  );
  check(
    !people.grants.some(
      (grant) =>
        grant.member === actors["app-user"].user.id &&
        grant.action === "moderate",
    ),
    "Contributor gained moderation authority.",
  );
  await ordinary.goto(lab.origins.composer + "/me?view=apps&workspace=" + wa);
  await ordinary
    .getByText("Contribute a fictional member postcard", { exact: true })
    .waitFor();
  await ordinary.getByLabel("Your message", { exact: true }).fill(caption);
  await ordinary.getByLabel("Public alias", { exact: true }).fill(author);
  await ordinary
    .getByLabel("I agree to publish this message and alias if approved.", {
      exact: true,
    })
    .check();
  // Canvas itself is authored UI. Its PNG is generated by that UI, never inserted
  // into R2/D1 or substituted by an evaluated synthetic HTTP body in this harness.
  check(
    (await ordinary
      .locator('canvas[aria-label="Postcard preview"]')
      .getAttribute("width")) === "1200",
    "Actual maintained canvas was not mounted.",
  );
  const submission = ordinary.waitForResponse(
    (reply) =>
      reply.url().includes(members + "write") &&
      reply.request().method() === "POST",
  );
  await ordinary
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  const contributionResponse = await submission;
  const contribution = nativeData({
    status: contributionResponse.status(),
    body: await contributionResponse.json(),
  });
  const receipt = contribution.result;
  check(
    receipt?.resource === resource.resource &&
      receipt.status === "pending" &&
      typeof receipt.operationId === "string",
    "Actual v2 contribution returned no matching pending receipt.",
  );
  await ordinary
    .getByText(
      "Postcard submitted for review. It remains private until an authorised moderator approves it.",
      { exact: true },
    )
    .waitFor();
  result.contribution = {
    actor: actors["app-user"].user.id,
    resource: receipt.resource,
    item: receipt.id,
    operationId: receipt.operationId,
    status: receipt.status,
    canvas: "maintained 1200x900 UI",
    dataClass: "synthetic",
  };
  await screenshot(ordinary, "team-a-role10-postcard-submitted");
  const memberList = () =>
    data(a, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: resource.resource,
      capability: "moderate",
      input: { operation: "list" },
    });
  const pendingList = (await memberList()).result;
  const pendingItem = pendingList.items.find((item) => item.id === receipt.id);
  check(
    pendingList.contract === 2 &&
      pendingItem?.status === "pending" &&
      pendingItem.synthetic === 1 &&
      pendingItem.caption === caption,
    "Pending native postcard is missing or lacks trusted synthetic attribution.",
  );
  result.crossTeamMember = denied(
    await nativeCall(b, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: resource.resource,
      capability: "moderate",
      input: { operation: "list" },
    }),
  );
  result.contributorModeration = denied(
    await nativeCall(ordinary, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: resource.resource,
      capability: "moderate",
      input: { operation: "list" },
    }),
  );
  result.foreignResource = denied(
    await nativeCall(ordinary, members + "write", {
      action: "guestbook",
      workspace: wa,
      resource: initialB.resources[0].resource,
      capability: "contribution-status",
      input: { operationId: receipt.operationId },
    }),
  );
  const opened = await read(a, "read", {
    action: "open",
    workspace: wa,
    stack: initialA.stackId,
  });
  result.crossTeamMedia = {
    ...denied(
      await nativeCall(
        b,
        stacks +
          "read?" +
          new URLSearchParams({
            action: "resourceMedia",
            workspace: wa,
            stack: initialA.stackId,
            instance: resource.instance,
            expectedRevision: String(opened.stack.revision),
            item: receipt.id,
          }),
      ),
    ),
    existingPrivateMediaExercised: true,
  };
  const browser = ordinary.context().browser();
  const anonymous = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  let approvedDigest;
  result.visibility = [];
  try {
    const publicPage = await anonymous.newPage();
    await publicPage.goto(lab.origins.composer + resource.configuration.path);
    const invitation = await publicFetch(
      publicPage,
      "/guestbook/r/" + resource.resource + "/api/invitation",
      32768,
    );
    const publicAdmission = JSON.parse(invitation.text);
    check(
      invitation.status === 200 &&
        publicAdmission.invitation.state === "closed" &&
        publicAdmission.invitation.accepts === false,
      "Member-only admission opened public postcard contributions.",
    );
    result.publicAdmission = {
      state: publicAdmission.invitation.state,
      accepts: false,
      nativeSession: false,
    };
    const mediaPath =
      "/guestbook/r/" + resource.resource + "/media/" + receipt.id;
    async function publicState(
      phase,
      expectedStatus,
      path = resource.configuration.path,
    ) {
      const media = await publicFetch(publicPage, mediaPath, 150000);
      check(
        media.status === expectedStatus,
        phase + " public media status was " + media.status,
      );
      const evidence = {
        phase,
        item: receipt.id,
        status: media.status,
        nativeSession: false,
      };
      if (expectedStatus === 200) {
        check(
          media.bytes <= 150000 && media.contentType?.startsWith("image/png"),
          "Actual public postcard media is not bounded PNG.",
        );
        evidence.sha256 = media.sha256;
        if (approvedDigest)
          check(
            evidence.sha256 === approvedDigest,
            "Visibility or title update changed postcard media bytes.",
          );
        approvedDigest ??= evidence.sha256;
      }
      const pageResponse = await publicPage.goto(lab.origins.composer + path);
      check(
        pageResponse.status() === 200,
        "Actual public resource page unavailable.",
      );
      const text = await publicPage.locator("body").innerText();
      check(
        text.includes(caption) === (expectedStatus === 200),
        phase + " public page visibility disagrees with media.",
      );
      if (expectedStatus === 200)
        check(
          text.includes("Fictional demonstration"),
          "Approved postcard lost synthetic public label.",
        );
      result.visibility.push(evidence);
      await screenshot(publicPage, "team-a-public-" + phase);
    }
    await publicState("pending-private", 404);
    await a.goto(lab.origins.composer + "/me?view=apps&workspace=" + wa);
    await a
      .getByRole("button", {
        name: "Load contributions to review",
        exact: true,
      })
      .click();
    const itemRow = a
      .getByRole("listitem")
      .filter({ has: a.getByRole("heading", { name: caption, exact: true }) });
    await itemRow.waitFor();
    async function moderateUI(status, phase = status) {
      const label = { approved: "Approve", hidden: "Hide", rejected: "Reject" }[
        status
      ];
      check(label, "Unsupported moderation action in native fixture.");
      await itemRow.getByRole("button", { name: label, exact: true }).click();
      await itemRow
        .getByText(author + " · " + status, { exact: true })
        .waitFor();
      const list = (await memberList()).result;
      check(
        list.items.find((item) => item.id === receipt.id)?.status === status,
        "UI moderation status was not confirmed by actual named service.",
      );
      await screenshot(a, "team-a-review-" + phase);
      return list.items;
    }
    await moderateUI("approved");
    await publicState("approved-public", 200);
    await moderateUI("hidden");
    await publicState("hidden-private", 404);
    // The maintained moderation UI supports re-approval of hidden retained
    // media. This is visibility restoration, not full data/media restore.
    await moderateUI("approved", "reapproved");
    await publicState("reapproved-public", 200);
    const contentBeforeUpdate = (await memberList()).result.items;
    await ordinary.goto(
      lab.origins.composer + "/me?view=platform&workspace=" + wa,
    );
    await ordinary
      .getByRole("button", { name: "Plan an update", exact: true })
      .click();
    await ordinary
      .getByLabel("Application name", { exact: true })
      .fill("Fictional Team A updated member visitor book");
    check(
      (await ordinary
        .getByRole("combobox", { name: /^Contributions/ })
        .inputValue()) === "members",
      "Update reset the explicit contribution mode.",
    );
    await ordinary
      .getByRole("button", { name: "Evaluate revised request", exact: true })
      .click();
    const updatedA = await completed(
      ordinary,
      wa,
      "Fictional Team A updated member visitor book",
      true,
    );
    const unchangedB = (await snapshot(b, wb)).requests.find(
      (item) => item.id === initialB.id,
    );
    check(
      updatedA.id === initialA.id &&
        updatedA.stackId === initialA.stackId &&
        updatedA.resources[0].resource === resource.resource,
      "Compatible title update replaced retained request/stack/resource identity.",
    );
    check(
      JSON.stringify(unchangedB) === JSON.stringify(initialB),
      "Team B changed after Team A content or title update.",
    );
    const contentAfterUpdate = (await memberList()).result.items;
    check(
      JSON.stringify(contentAfterUpdate) ===
        JSON.stringify(contentBeforeUpdate),
      "Title update changed contribution content/status/revision.",
    );
    await publicState(
      "updated-content-preserved",
      200,
      updatedA.resources[0].configuration.path,
    );
    result.updated = {
      a: updatedA,
      bUnchanged: true,
      contentPreserved: true,
      mediaSha256: approvedDigest,
    };
    await screenshot(ordinary, "team-a-role10-update-content-preserved");
  } finally {
    await anonymous.close();
  }
  const updatedA = result.updated.a;
  const refused = await data(ordinary, members + "platformWrite", {
    action: "submit",
    workspace: wa,
    key: randomUUID(),
    request: {
      ...request("Fictional sensitive request refused"),
      contributions: "members",
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
    "Sensitive request allocated app state or escaped policy.",
  );
  result.policyDenied = refusedRow;
  const audit = await data(
    owner,
    members +
      "read?" +
      new URLSearchParams({ action: "people", workspace: wa }),
  );
  check(
    audit.audit.some(
      (item) =>
        item.event === "dispatch" &&
        item.member === actors["app-user"].user.id &&
        item.resource === resource.resource,
    ),
    "Actual native member dispatch has no server audit.",
  );
  result.limits.push(
    "Visibility re-approval of retained hidden media is supported and exercised; full data/media restore is unavailable and unqualified.",
    "Retirement, knowledge recipes and the #215 incident foundation have no qualified product journey in this fixture.",
    "Local virtual-passkey admission and app-owned synthetic content do not establish production SSO, regional storage or upstream provider permissions.",
  );
  result.checks.push(
    "Delegated native role10 self-service retained global role10 and operator denials; exact app grants admitted real canvas synthetic authoring; actual anonymous media followed 404→200→404→200; compatible title update preserved content/media and Team B.",
  );
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
