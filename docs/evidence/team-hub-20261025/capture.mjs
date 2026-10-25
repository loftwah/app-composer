// Reuse the maintained native passkey actors and admin fixture lifecycle.
// No identity/session/member rows are injected; admission and membership use
// real EmDash/Composer APIs. This never qualifies hosted passwordless MFA.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import {
  authenticateNativeActors,
  nativeCall,
  nativeData,
} from "../../../labs/platform/native-auth.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
  outIndex = process.argv.indexOf("--out"),
  out = resolve(
    outIndex < 0
      ? join(source, "output/team-hub", "native-replay-" + Date.now())
      : (process.argv[outIndex + 1] ?? ""),
  );
assert.ok(
  outIndex < 0 || process.argv[outIndex + 1],
  "--out needs a directory",
);
mkdirSync(out, { recursive: true });
const parent = join(tmpdir(), "opencode");
mkdirSync(parent, { recursive: true });
const root = mkdtempSync(join(parent, "composer-team-hub-"));
const prep = join(
  source,
  "docs/evidence/admin-journey-20261025/prepare-fixture.mjs",
);
let browser,
  cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (existsSync(join(root, "OWNED.md")))
    spawnSync(
      process.execPath,
      [prep, "--source", source, "--root", root, "--clean"],
      { cwd: source, stdio: "ignore", timeout: 30000 },
    );
  rmSync(root, { recursive: true, force: true });
}
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
const receipt = {
  schema: "composer.team-hub-native/1",
  warning:
    "Fictional local EmDash sessions and virtual passkeys. No production Access, MFA, provider or physical-device proof.",
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: source,
    encoding: "utf8",
  }).trim(),
  sourceDirty:
    execFileSync("git", ["status", "--porcelain"], {
      cwd: source,
      encoding: "utf8",
    }).trim() !== "",
  harnessHash: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex"),
  checks: {},
  captures: [],
  pageErrors: [],
  cleanup: false,
};
try {
  const port = await new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = server.address().port;
      server.close(() => resolve(selected));
    });
  });
  const origin = "http://localhost:" + port,
    marker = root.split("/").at(-1);
  const changes = [];
  // A replay must exercise the integrated interface, not shadow it with a
  // replacement middleware. Refuse partial or changed integration explicitly.
  const plugin = readFileSync(join(source, "src/lib/member-plugin.ts"), "utf8");
  const middleware = readFileSync(join(source, "src/middleware.ts"), "utf8");
  const hasRoutes = /\bteamHubRead\s*:/.test(plugin);
  const hasImport =
    /import\s*\{[^}]*\bteamHubPluginReply\b[^}]*\}\s*from\s*["']\.\/team-hub(?:\.ts)?["']/.test(
      plugin,
    );
  const routeBody = (name) => {
    const matches = [
      ...plugin.matchAll(new RegExp("\\b" + name + "\\s*:\\s*\\{", "g")),
    ];
    assert.equal(matches.length, 1, "Expected one " + name + " route");
    const start = matches[0].index + matches[0][0].length;
    let depth = 1,
      end = start;
    while (depth && end < plugin.length) {
      if (plugin[end] === "{") depth++;
      if (plugin[end] === "}") depth--;
      end++;
    }
    assert.equal(depth, 0);
    return plugin.slice(start, end - 1).replace(/\s+/g, "");
  };
  if (hasRoutes || hasImport || /\bteamHubWrite\s*:/.test(plugin)) {
    assert.ok(hasRoutes && hasImport, "Partial Team Hub plugin integration");
    for (const [name, method] of [
      ["teamHubRead", "GET"],
      ["teamHubWrite", "POST"],
    ]) {
      const body = routeBody(name);
      assert.ok(
        body.includes('methods:["' + method + '"]'),
        name + " method changed",
      );
      assert.ok(
        body.includes('permission:"content:read"'),
        name + " permission changed",
      );
      assert.ok(
        body.includes('response:"raw"'),
        name + " response contract changed",
      );
      assert.match(
        body,
        /handler:(?:\(ctx\)|ctx)=>teamHubPluginReply\(ctx,runtime\)/,
      );
      if (name === "teamHubWrite")
        assert.ok(body.includes('request:{body:"json",maxBytes:24000}'));
    }
  } else {
    changes.push(
      [
        "src/lib/member-plugin.ts",
        'import { definePlugin, pluginResponse } from "emdash";',
        'import { definePlugin, pluginResponse } from "emdash";\nimport {teamHubPluginReply} from "./team-hub.ts";',
      ],
      [
        "src/lib/member-plugin.ts",
        "routes: {",
        'routes: {\nteamHubRead:{methods:["GET"],permission:"content:read",response:"raw",handler:ctx=>teamHubPluginReply(ctx,runtime)},\nteamHubWrite:{methods:["POST"],permission:"content:read",response:"raw",request:{body:"json",maxBytes:24000},handler:ctx=>teamHubPluginReply(ctx,runtime)},',
      ],
    );
  }
  const hasGuard = /await\s+teamHubPageGate\(context,\s*runtime\)/.test(
    middleware,
  );
  if (hasGuard || middleware.includes("teamHubPageGate")) {
    assert.ok(hasGuard, "Partial Team Hub document guard");
    assert.equal(
      (middleware.match(/await\s+teamHubPageGate\(/g) ?? []).length,
      1,
    );
    assert.match(middleware, /if\s*\(teamRejection\)\s*return teamRejection;/);
    assert.ok(
      middleware.indexOf("await teamHubPageGate") <
        middleware.indexOf("await next()"),
    );
  } else {
    changes.push([
      "src/middleware.ts",
      "export const onRequest",
      'import {teamHubPageGate} from "./lib/team-hub";\nexport const onRequest',
    ]);
    const next = middleware.match(/const response\s*=\s*await next\(\);/);
    assert.ok(
      next,
      "Unsupported pre-Team Hub middleware; review its guard placement",
    );
    changes.push([
      "src/middleware.ts",
      next[0],
      "const teamRejection=await teamHubPageGate(context,runtime);if(teamRejection)return teamRejection;\n" +
        next[0],
    ]);
  }
  const securityHeader = middleware.match(
    /response\.headers\.set\(["']X-Content-Type-Options["'],\s*["']nosniff["']\);/,
  );
  assert.ok(
    securityHeader,
    "Native fixture marker needs reviewed security-header anchor",
  );
  changes.push([
    "src/middleware.ts",
    securityHeader[0],
    securityHeader[0] +
      '\nresponse.headers.set("X-Composer-Isolated-Lab",' +
      JSON.stringify(marker) +
      ");",
  ]);
  changes.push(
    [
      "src/lib/workspace-access.ts",
      'const origin = "https://composer.loftwah.com";',
      "const origin = " + JSON.stringify(origin) + ";",
    ],
    [
      "src/lib/member-access.ts",
      "runtime.PUBLIC_ORIGIN !== memberIssuer",
      "runtime.PUBLIC_ORIGIN !== " + JSON.stringify(origin),
    ],
    [
      "src/lib/member-access.ts",
      "(origin && origin !== memberIssuer)",
      "(origin && origin !== " + JSON.stringify(origin) + ")",
    ],
    [
      "src/lib/member-access.ts",
      '(ctx.request.method !== "GET" && origin !== memberIssuer)',
      '(ctx.request.method !== "GET" && origin !== ' +
        JSON.stringify(origin) +
        ")",
    ],
  );
  const clone = [
    "{ const {lstatSync,realpathSync}=await import('node:fs');",
    "if(lstatSync(join(app,'node_modules')).isSymbolicLink()){",
    "const dependencies=realpathSync(join(app,'node_modules'));rmSync(join(app,'node_modules'));",
    "execFileSync('cp',['-cR',dependencies,join(app,'node_modules')]);} }",
  ].join("\n");
  const integration =
    clone +
    "\n" +
    changes
      .map(
        ([file, before, after]) =>
          "patch(" +
          [file, before, after, "Team Hub isolated native integration"]
            .map((value) => JSON.stringify(value))
            .join(",") +
          ");",
      )
      .join("\n");
  let prepared = readFileSync(prep, "utf8"),
    sentinel = 'const port = new URL(origin).port || "80";';
  assert.equal(prepared.split(sentinel).length, 2);
  // The variant lives in the owned temporary root; keep the preparer's
  // process-ownership helper resolved to its actual source rather than /tmp.
  if (
    prepared.includes('from "../../../scripts/lib/native-fixture-process.mjs"')
  )
    prepared = prepared.replace(
      'from "../../../scripts/lib/native-fixture-process.mjs"',
      "from " +
        JSON.stringify(
          new URL(
            "../../../scripts/lib/native-fixture-process.mjs",
            pathToFileURL(prep),
          ).href,
        ),
    );
  prepared = prepared
    .replace(
      'RESOURCE_ENVIRONMENT: "production",',
      'RESOURCE_ENVIRONMENT: "preview", TEAM_HUB_AUTH_PROFILE:"native-local",',
    )
    .replace(sentinel, integration + sentinel);
  const variant = join(root, "prepare-team-hub.mjs");
  writeFileSync(variant, prepared);
  execFileSync(
    process.execPath,
    [variant, "--source", source, "--root", root, "--origin", origin],
    { cwd: source, stdio: "pipe", timeout: 240000 },
  );
  receipt.runtimeSourceHashes = Object.fromEntries(
    [
      "src/lib/team-hub.ts",
      "src/lib/team-hub-contract.ts",
      "src/components/team-hub/TeamHub.tsx",
      "migrations/0021_team_hub.sql",
      "src/lib/member-plugin.ts",
      "src/middleware.ts",
      "src/lib/admin-brand.ts",
      "docs/evidence/admin-journey-20261025/prepare-fixture.mjs",
      "scripts/lib/native-fixture-process.mjs",
    ].map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(source, file)))
        .digest("hex"),
    ]),
  );
  receipt.fixtureIntegrationHashes = Object.fromEntries(
    ["src/lib/member-plugin.ts", "src/middleware.ts"].map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(root, "app", file)))
        .digest("hex"),
    ]),
  );
  receipt.seams = [
    "Existing native fixture removes Access and uses local D1/R2, no provider bindings.",
    "Local origin guards for existing workspace/member acceptance APIs only; issuer/grant identity is unchanged.",
    hasRoutes && hasGuard
      ? "Existing integrated Team Hub routes and document guard validated and preserved; Brand middleware retained."
      : "Missing Team Hub registration/guard added only to the old-source fixture copy.",
    "Explicit native-local auth profile and preview namespace. Contained APFS dependency clone.",
  ];
  browser = await chromium.launch({
    headless: true,
    downloadsPath: join(root, "downloads"),
    executablePath:
      "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  });
  const auth = await authenticateNativeActors(
    browser,
    { root, origins: { composer: origin } },
    {
      actorRoles: [
        ["team-editor", 10],
        ["team-viewer", 10],
        ["team-bravo", 10],
      ],
      onActorContext: ({ page }) =>
        page.on("pageerror", (error) => receipt.pageErrors.push(error.message)),
    },
  );
  const owner = auth.actors.owner,
    editor = auth.actors["team-editor"],
    viewer = auth.actors["team-viewer"],
    bravo = auth.actors["team-bravo"];
  receipt.admission = auth.qualification;
  assert.equal(editor.user.role, 10);
  assert.equal(viewer.user.role, 10);
  assert.equal(bravo.user.role, 10);
  console.log("Native role10 actors admitted");
  const stacks = "/_emdash/api/plugins/composer-stacks/",
    members = "/_emdash/api/plugins/composer-members/";
  const post = async (actor, path, body) =>
    nativeData(await nativeCall(actor.page, path, body));
  const get = async (actor, path) =>
    nativeData(await nativeCall(actor.page, path));
  async function makeTeam(name) {
    const reply = await post(owner, stacks + "accessWrite", {
      action: "create",
      name,
    });
    return reply.changed.workspace;
  }
  async function invite(workspace, actor, email, role) {
    const current = await get(
      owner,
      stacks + "accessRead?action=open&workspace=" + workspace,
    );
    await post(owner, stacks + "accessWrite", {
      action: "invite",
      workspace,
      expectedRevision: current.access.workspace.revision,
      email,
      role,
    });
    const session = await get(actor, members + "read?action=session");
    const invitation = session.incoming.find(
      (item) => item.workspace === workspace,
    );
    assert.ok(invitation);
    await post(actor, members + "write", {
      action: "accept",
      workspace,
      expectedRevision: invitation.workspaceRevision,
      invitation: invitation.id,
      invitationRevision: invitation.revision,
    });
  }
  const alpha = await makeTeam("Fictional Alpha team"),
    beta = await makeTeam("Fictional Bravo team");
  await invite(alpha, editor, "team-editor@example.test", "editor");
  await invite(alpha, viewer, "team-viewer@example.test", "viewer");
  await invite(beta, bravo, "team-bravo@example.test", "editor");
  receipt.checks.nativeWorkspaceInvitationAcceptance = true;
  const href = (workspace) => origin + "/team-hub?workspace=" + workspace;
  const read = async (actor, workspace) =>
    get(actor, members + "teamHubRead?action=read&workspace=" + workspace);
  const capture = async (page, name) => {
    await page.screenshot({ path: join(out, name), fullPage: true });
    receipt.captures.push(name);
  };
  await owner.page.goto(href(alpha), { waitUntil: "networkidle" });
  await owner.page
    .getByRole("button", { name: "Enable Team Hub for this team", exact: true })
    .click();
  await owner.page
    .getByRole("heading", { name: "Today’s actions", exact: true })
    .waitFor();
  for (const actor of [editor, viewer]) {
    await owner.page
      .getByLabel("Eligible teammate", { exact: true })
      .selectOption(actor.user.id);
    await owner.page
      .getByRole("button", { name: "Grant this app permission", exact: true })
      .click();
    await owner.page
      .getByText(
        "App permission granted. Workspace membership and Access admission remain separate.",
        { exact: true },
      )
      .waitFor();
  }
  await post(owner, members + "teamHubWrite", {
    action: "enable",
    workspace: beta,
    expectedRevision: 0,
  });
  let betaState = await read(owner, beta);
  await post(owner, members + "teamHubWrite", {
    action: "grant",
    workspace: beta,
    expectedRevision: betaState.revision,
    member: bravo.user.id,
    capability: "use",
  });
  const legacySession = await get(owner, members + "read?action=session");
  assert.ok(
    legacySession.grants.every((grant) =>
      ["showcase", "guestbook"].includes(grant.app),
    ),
  );
  receipt.checks.legacyMemberSessionUnaffected = true;
  await editor.page.goto(href(alpha), { waitUntil: "networkidle" });
  await editor.page
    .getByLabel("Title", { exact: true })
    .fill("Review the fictional safety drill");
  await editor.page
    .getByLabel("What needs to happen?", { exact: true })
    .fill(
      "Confirm the team checklist before Friday. This is a private fictional request.",
    );
  await editor.page
    .getByLabel("Assigned to", { exact: true })
    .selectOption(viewer.user.id);
  const text = "Fictional drill checklist\nKeep the route clear.\n";
  await editor.page
    .getByLabel("Private text attachment", { exact: true })
    .setInputFiles({
      name: "drill-checklist.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
  await editor.page
    .getByRole("button", { name: "Save request", exact: true })
    .click();
  await editor.page
    .getByText("Request saved. Its previous version is retained.", {
      exact: true,
    })
    .waitFor();
  let state = await read(editor, alpha),
    id = state.requests[0].id;
  await editor.page
    .getByRole("button", {
      name: "Review the fictional safety drill",
      exact: true,
    })
    .click();
  await editor.page.getByText("Version 1 · open", { exact: true }).waitFor();
  await editor.page
    .getByLabel("What needs to happen?", { exact: true })
    .fill("Checklist reviewed. Confirm the assembly point with the team.");
  await editor.page
    .getByLabel("Status", { exact: true })
    .selectOption("in-progress");
  await editor.page
    .getByRole("button", { name: "Save request", exact: true })
    .click();
  await editor.page
    .getByText("Request saved. Its previous version is retained.", {
      exact: true,
    })
    .waitFor();
  const history = await get(
    editor,
    members + "teamHubRead?action=history&workspace=" + alpha + "&id=" + id,
  );
  assert.equal(history.history.length, 2);
  assert.match(history.history[1].request.body, /before Friday/);
  receipt.checks.role10EditorAndImmutableVersions = true;
  await viewer.page.goto(href(alpha), { waitUntil: "networkidle" });
  await viewer.page
    .getByRole("button", { name: "Download drill-checklist.txt", exact: true })
    .waitFor();
  assert.equal(
    await viewer.page
      .getByRole("button", { name: "Save request", exact: true })
      .count(),
    0,
  );
  const downloading = viewer.page.waitForEvent("download");
  await viewer.page
    .getByRole("button", { name: "Download drill-checklist.txt", exact: true })
    .click();
  assert.equal(readFileSync(await (await downloading).path(), "utf8"), text);
  receipt.checks.privateAttachmentRoundTrip = true;
  state = await read(viewer, alpha);
  const refused = await nativeCall(viewer.page, members + "teamHubWrite", {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 2,
    request: {
      title: "Denied edit",
      body: "A viewer cannot write this.",
      assignee: null,
      status: "done",
      attachment: null,
    },
  });
  assert.equal(refused.status, 403);
  const wrong = await nativeCall(
    bravo.page,
    members + "teamHubRead?action=attachment&workspace=" + alpha + "&id=" + id,
  );
  assert.equal(wrong.status, 403);
  const wrongHtml = await bravo.page.goto(href(alpha));
  assert.equal(wrongHtml.status(), 403);
  assert.ok(
    !(await bravo.page.locator("body").innerText()).includes(
      "Checklist reviewed.",
    ),
  );
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(href(alpha))).status(), 403);
  const anonymousApi = await anonymous.request.get(
    origin + members + "teamHubRead?action=read&workspace=" + alpha,
  );
  assert.equal(anonymousApi.status(), 401);
  receipt.checks.anonymousHtml403Api401 = true;
  await anonymous.close();
  receipt.checks.viewerWriteCrossTeamHtmlApiAndAnonymousDenied = true;
  await bravo.page.goto(href(beta), { waitUntil: "networkidle" });
  await bravo.page
    .getByLabel("Title", { exact: true })
    .fill("Bravo control action");
  await bravo.page
    .getByLabel("What needs to happen?", { exact: true })
    .fill("This independent team stays available during Alpha revocation.");
  await bravo.page
    .getByRole("button", { name: "Save request", exact: true })
    .click();
  await bravo.page
    .getByText("Request saved. Its previous version is retained.", {
      exact: true,
    })
    .waitFor();
  const bravoBefore = (await read(bravo, beta)).requests;
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ])
    for (const theme of ["dark", "light"]) {
      await editor.page.setViewportSize({ width, height });
      await editor.page.goto(href(alpha), { waitUntil: "networkidle" });
      await editor.page.evaluate((theme) => {
        localStorage.setItem("composer:theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
      }, theme);
      await editor.page
        .getByRole("button", {
          name: "Review the fictional safety drill",
          exact: true,
        })
        .waitFor();
      assert.ok(
        await editor.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await capture(editor.page, "editor-" + width + "-" + theme + ".png");
      await viewer.page.setViewportSize({ width, height });
      await viewer.page.goto(href(alpha), { waitUntil: "networkidle" });
      await viewer.page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await viewer.page
        .getByRole("button", {
          name: "Download drill-checklist.txt",
          exact: true,
        })
        .waitFor();
      await capture(viewer.page, "viewer-" + width + "-" + theme + ".png");
    }
  await owner.page.goto(href(alpha), { waitUntil: "networkidle" });
  await owner.page
    .getByRole("heading", { name: "People & access", exact: true })
    .waitFor();
  const viewerRow = owner.page
    .locator(".th-people li")
    .filter({ hasText: "Fictional team-viewer" });
  await viewerRow
    .getByRole("button", { name: "Revoke app access", exact: true })
    .click();
  await owner.page
    .getByText(
      "App permission revoked. Its next application request is refused.",
      { exact: true },
    )
    .waitFor();
  assert.equal((await viewer.page.reload()).status(), 403);
  assert.equal(
    (
      await nativeCall(
        viewer.page,
        members +
          "teamHubRead?action=attachment&workspace=" +
          alpha +
          "&id=" +
          id,
      )
    ).status,
    403,
  );
  await capture(viewer.page, "revoked-390.png");
  await post(
    owner,
    "/_emdash/api/admin/users/" + editor.user.id + "/disable",
    {},
  );
  assert.equal((await editor.page.reload()).status(), 403);
  assert.ok(
    [401, 403].includes(
      (
        await nativeCall(
          editor.page,
          members + "teamHubRead?action=read&workspace=" + alpha,
        )
      ).status,
    ),
  );
  assert.deepEqual((await read(bravo, beta)).requests, bravoBefore);
  receipt.checks.revokedDisabledAndUnaffectedTeam = true;
  receipt.success = true;
  assert.deepEqual(receipt.pageErrors, []);
  console.log(
    JSON.stringify({
      success: true,
      checks: receipt.checks,
      captures: receipt.captures.length,
    }),
  );
} catch (error) {
  receipt.failure = String(error);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    receipt.failedBody = (await page.locator("body").innerText()).slice(
      0,
      4000,
    );
    await page.screenshot({
      path: join(out, "failed.png"),
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser?.close();
  cleanup();
  receipt.cleanup = !existsSync(root);
  receipt.output = out;
  writeFileSync(
    join(out, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
