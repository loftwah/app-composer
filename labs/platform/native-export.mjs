// Read-only evidence from the existing native export route, never a restore runner.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { appSettings } from "../../src/lib/app-settings.mjs";
import { configurationDigest } from "../../src/lib/resource-client.ts";
import { decodeMaintenanceReply } from "../../src/plugins/maintenance/protocol.ts";
import { decodePlatformList } from "../../src/plugins/platform/protocol.ts";
import { decodeStackReply } from "../../src/plugins/stacks/protocol.ts";
import { nativeData } from "./native-auth.mjs";

const origin = "https://composer.loftwah.com";
const api = "/_emdash/api/plugins/composer-stacks/";
const digest = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
const check = (value, message) => {
  if (!value) throw Error(message);
};

export async function qualifyNativeApprovedExport({
  owner,
  lab,
  teamA,
  approvedItemId,
  expectedMediaSha,
}) {
  for (const key of ["workspace", "request", "stack", "instance", "resource"])
    check(
      /^[a-z0-9-]{6,64}$/.test(teamA?.[key]),
      "Select the exact retained Team A identities.",
    );
  check(
    /^[a-z0-9-]{6,64}$/.test(approvedItemId) &&
      /^[a-f0-9]{64}$/.test(expectedMediaSha),
    "Select the retained approved item and measured PNG digest.",
  );
  const root = await realpath(lab.root),
    marker = basename(root);
  check(
    /^composer-invited-/.test(marker) && lab.origins.composer === origin,
    "Export qualification requires the current local lifecycle.",
  );
  const configPath = await realpath(
    join(root, "composer/wrangler.local.jsonc"),
  );
  check(
    configPath.startsWith(root + sep),
    "The local configuration escaped the lab.",
  );
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const target = {
    account: "00000000000000000000000000000001",
    environment: "local",
    url: origin + "/guestbook",
  };
  check(
    config.name === "composer-invited-composer" &&
      config.main === "./lab-entry.ts" &&
      config.workers_dev === false &&
      config.preview_urls === false &&
      config.routes?.length === 0 &&
      config.vars?.RESOURCE_ACCOUNT_ID === target.account &&
      config.vars?.RESOURCE_ENVIRONMENT === target.environment &&
      config.services?.some(
        (binding) =>
          binding.binding === "GUESTBOOK" &&
          binding.service === "composer-invited-guestbook" &&
          binding.remote !== true,
      ),
    "Select the reviewed local account and app service.",
  );
  for (const name of ["composer", "guestbook"])
    check(
      /^[a-f0-9]{40}$/.test(lab.sources?.[name]?.head),
      "Select exact recorded source identities.",
    );
  check(
    lab.sources.guestbook.head === appSettings.guestbook.source.commit,
    "The local app source differs from the current exact composition pin.",
  );

  async function get(path, maximum = 262144) {
    // Actual credentialed native browser fetch; the fixed local bridge is checked
    // before reading bytes. The export is consumed transiently, never persisted.
    const response = await owner.page.evaluate(
      async ({ path, origin, marker, maximum }) => {
        const address = new URL(path, location.origin);
        if (
          address.origin !== origin ||
          ![
            "/_emdash/api/auth/me",
            "/_emdash/api/plugins/composer-stacks/read",
            "/_emdash/api/plugins/composer-stacks/platformRead",
            "/_emdash/api/plugins/composer-stacks/maintenanceRead",
          ].includes(address.pathname)
        )
          throw Error("Export read escaped its fixed native endpoints.");
        const response = await fetch(path, {
          method: "GET",
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
          headers: { "X-EmDash-Request": "1", Accept: "application/json" },
        });
        if (response.headers.get("x-composer-isolated-lab") !== marker)
          throw Error("Export read did not reach the owned local TLS bridge.");
        if (!response.headers.get("content-type")?.includes("json"))
          throw Error("Expected the native JSON export contract.");
        const reader = response.body?.getReader();
        if (!reader) throw Error("The native read returned no body.");
        const chunks = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > maximum)
              throw Error("Native export read exceeded its byte bound.");
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const sha = new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes),
        );
        return {
          status: response.status,
          body: JSON.parse(new TextDecoder().decode(bytes)),
          bytes: size,
          sha256: Array.from(sha, (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        };
      },
      { path, origin, marker, maximum },
    );
    return { ...response, data: nativeData(response) };
  }
  const read = (endpoint, fields) =>
    get(api + endpoint + "?" + new URLSearchParams(fields));
  async function actor() {
    const current = (await get("/_emdash/api/auth/me")).data;
    check(
      current.id === owner.user.id && current.role === 50,
      "The actual native operator session changed.",
    );
  }
  async function snapshot() {
    const platform = decodePlatformList(
      (
        await read("platformRead", {
          action: "list",
          workspace: teamA.workspace,
        })
      ).data,
    );
    const request = platform.requests.find(
      (entry) => entry.id === teamA.request,
    );
    check(
      platform.workspace.id === teamA.workspace &&
        platform.workspace.role === "owner" &&
        platform.profile?.enabled &&
        request?.status === "complete" &&
        request.stackId === teamA.stack &&
        request.plan.source.commit === lab.sources.guestbook.head &&
        request.plan.policyRevision === platform.profile.revision,
      "The current owner, policy or retained request changed.",
    );
    assert.deepEqual(
      request.plan.target,
      target,
      "The request targets another account or runtime.",
    );
    const stack = decodeStackReply(
      "open",
      (
        await read("read", {
          action: "open",
          workspace: teamA.workspace,
          stack: teamA.stack,
        })
      ).data,
    ).stack;
    const resources = decodeStackReply(
      "resources",
      (
        await read("read", {
          action: "resources",
          workspace: teamA.workspace,
          stack: teamA.stack,
        })
      ).data,
    ).resources;
    const resource = resources.find(
      (entry) => entry.instance === teamA.instance,
    );
    check(
      stack.id === teamA.stack &&
        stack.status === "published" &&
        resource?.resource === teamA.resource &&
        resource.state === "ready" &&
        !resource.shared &&
        resource.configuration?.source === lab.sources.guestbook.head,
      "The exact exclusive published resource is not ready.",
    );
    const selected = {
      workspace: teamA.workspace,
      stack: teamA.stack,
      instance: teamA.instance,
      expectedRevision: String(stack.revision),
    };
    const checked = decodeMaintenanceReply(
      "check",
      (await read("maintenanceRead", { action: "check", ...selected })).data,
    );
    const connection = checked.check;
    check(
      checked.workspace.id === teamA.workspace &&
        checked.workspace.role === "owner" &&
        connection.outcome === "matched" &&
        connection.portabilitySupported &&
        connection.stack === teamA.stack &&
        connection.instance === teamA.instance &&
        connection.resource === teamA.resource &&
        connection.revision === stack.revision &&
        connection.coverage.source === "matched" &&
        connection.coverage.resource === "matched",
      "The current maintenance capability or selection is unconfirmed.",
    );
    const expected = {
      account: target.account,
      environment: target.environment,
      target: target.url,
      source: lab.sources.guestbook.head,
      version: resource.version,
      configuration: {
        revision: resource.configuration.revision,
        digest: resource.configuration.digest,
        source: resource.configuration.source,
      },
    };
    assert.deepEqual(
      connection.expected,
      expected,
      "The saved app scope differs from the retained selection.",
    );
    assert.deepEqual(
      connection.actual,
      { ...expected, visible: true, paused: false },
      "Export requires the exact current visible, unpaused app scope.",
    );
    return { request, policy: platform.profile, stack, resource, selected };
  }
  await actor();
  const before = await snapshot();
  const response = await get(
    api +
      "maintenanceRead?" +
      new URLSearchParams({ action: "export", ...before.selected }),
    1200000,
  );
  const exported = decodeMaintenanceReply("export", response.data),
    file = exported.portable;
  check(
    exported.workspace.id === teamA.workspace &&
      exported.workspace.role === "owner",
    "The export acknowledged another workspace or capability.",
  );
  assert.deepEqual(
    file.source,
    {
      app: "guestbook",
      build: lab.sources.guestbook.head,
      resource: teamA.resource,
      workspace: teamA.workspace,
      account: target.account,
      environment: target.environment,
      target: target.url,
      version: before.resource.version,
    },
    "The approved export belongs to another source or scope.",
  );
  assert.deepEqual(
    file.configuration,
    {
      revision: before.resource.configuration.revision,
      digest: before.resource.configuration.digest,
      source: before.resource.configuration.source,
      values: before.resource.configuration.values,
    },
    "The export configuration differs from the selected resource.",
  );
  check(
    file.configuration.digest ===
      (await configurationDigest(file.configuration.values)),
    "The export configuration digest disagrees with its values.",
  );
  const media = file.items.map((item) => {
    check(
      item.synthetic === 1,
      "Only fictional synthetic originals belong in this local qualification.",
    );
    const bytes = Buffer.from(item.media.base64, "base64");
    check(
      bytes.toString("base64") === item.media.base64 &&
        bytes.length >= 33 &&
        bytes.length <= 100000 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.toString("ascii", 12, 16) === "IHDR",
      "The approved export contains incompatible PNG bytes.",
    );
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20),
      sha256 = digest(bytes);
    check(
      width >= 1 &&
        width <= 1200 &&
        height >= 1 &&
        height <= 900 &&
        sha256 === item.media.sha256,
      "The actual exported PNG differs from its declared size or digest.",
    );
    return {
      id: item.id,
      revision: item.revision,
      synthetic: true,
      media: { type: "image/png", bytes: bytes.length, width, height, sha256 },
    };
  });
  const approved = media.find((item) => item.id === approvedItemId);
  check(
    approved?.media.sha256 === expectedMediaSha,
    "The approved partial subset omits the retained synthetic item or its measured PNG.",
  );
  await actor();
  assert.deepEqual(
    await snapshot(),
    before,
    "The selected request, policy, stack or app resource changed during read-only export.",
  );
  return {
    schema: "composer.native-approved-export/1",
    classification: "local-workerd-fixture",
    checkedAt: new Date().toISOString(),
    sources: {
      composer: lab.sources.composer.head,
      guestbook: lab.sources.guestbook.head,
    },
    selection: {
      workspace: teamA.workspace,
      request: teamA.request,
      stack: teamA.stack,
      instance: teamA.instance,
      resource: teamA.resource,
      stackRevision: before.stack.revision,
      publishedRevision: before.stack.publishedRevision,
    },
    authority: {
      nativeRole: 50,
      workspaceRole: "owner",
      account: target.account,
      environment: target.environment,
      target: target.url,
    },
    request: {
      planDigest: before.request.planDigest,
      policyRevision: before.policy.revision,
    },
    configuration: {
      revision: file.configuration.revision,
      digest: file.configuration.digest,
      source: file.configuration.source,
    },
    resourceVersion: file.source.version,
    portable: {
      format: file.format,
      contract: file.contract,
      exportedAt: file.exportedAt,
      manifestJSONSha256: digest(file),
      responseSha256: response.sha256,
      responseBytes: response.bytes,
      coverage: file.coverage,
    },
    approvedItem: approved,
    exportedItems: media,
    readOnly: {
      requestPolicyUnchanged: true,
      stackUnchanged: true,
      resourceUnchanged: true,
    },
    limits: [
      "Approved original subset only, maximum eight; private content, credentials, restored copies and publication history are excluded. This is not a full backup.",
      "Export checked at this current source and version; no restore was attempted or qualified. Later control changes advance the source version.",
      "Local workerd, virtual-passkey and fictional data qualification only; no production or provider portability claim.",
    ],
  };
}
