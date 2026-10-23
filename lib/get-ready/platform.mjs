// MIT. Observations guide setup; only current authenticated server actions execute it.
export const platformReportLimit = 32768;
const invalid = () =>
  new Error(
    "Choose a bounded platform observation from the selected installation; no setup or permission was changed.",
  );
const record = (value, keys) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw invalid();
  return value;
};
const text = (value, pattern) =>
  typeof value === "string" && pattern.test(value);
const id = (value) => text(value, /^[a-z0-9-]{6,64}$/);
const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
function installationOrigin(value) {
  if (typeof value !== "string" || value.length > 250) throw invalid();
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.origin !== value
  )
    throw invalid();
  return value;
}
export function validatePlatformReport(input, now = Date.now()) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).length > platformReportLimit)
      throw invalid();
    input = JSON.parse(input);
  }
  const value = record(input, [
    "schema",
    "version",
    "checkedAt",
    "installation",
    "workspace",
    "operator",
    "target",
    "inventory",
    "policy",
    "runner",
  ]);
  if (
    value.schema !== "app-composer.platform-observation" ||
    value.version !== 1 ||
    typeof value.checkedAt !== "string" ||
    !Number.isFinite(now) ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    new Date(value.checkedAt).toISOString() !== value.checkedAt ||
    Date.parse(value.checkedAt) > now + 30000
  )
    throw invalid();
  record(value.installation, ["origin", "source"]);
  installationOrigin(value.installation.origin);
  if (
    value.installation.source !== null &&
    !text(value.installation.source, /^[a-f0-9]{40}$/)
  )
    throw invalid();
  record(value.workspace, ["id", "name", "role"]);
  if (
    !id(value.workspace.id) ||
    typeof value.workspace.name !== "string" ||
    value.workspace.name.length < 1 ||
    value.workspace.name.length > 80 ||
    !["owner", "editor", "viewer"].includes(value.workspace.role) ||
    typeof value.operator !== "boolean" ||
    typeof value.runner !== "boolean"
  )
    throw invalid();
  if (value.target !== null) {
    record(value.target, ["account", "environment"]);
    if (
      !text(value.target.account, /^(?:[a-f0-9]{32}|unavailable)$/) ||
      !text(value.target.environment, /^[a-z][a-z0-9-]{0,39}$/)
    )
      throw invalid();
  }
  record(value.inventory, [
    "existingStacks",
    "managed",
    "resumable",
    "partial",
  ]);
  if (
    (value.inventory.existingStacks !== null &&
      !count(value.inventory.existingStacks)) ||
    typeof value.inventory.managed !== "boolean" ||
    typeof value.inventory.partial !== "boolean" ||
    !Array.isArray(value.inventory.resumable) ||
    value.inventory.resumable.length > 50 ||
    !value.inventory.resumable.every(id) ||
    new Set(value.inventory.resumable).size !==
      value.inventory.resumable.length ||
    value.inventory.managed !== (value.policy !== null)
  )
    throw invalid();
  if (value.policy !== null) {
    record(value.policy, [
      "revision",
      "enabled",
      "supported",
      "reviewRequired",
      "maxApplications",
    ]);
    if (
      !Number.isSafeInteger(value.policy.revision) ||
      value.policy.revision < 1 ||
      !["enabled", "supported", "reviewRequired"].every(
        (key) => typeof value.policy[key] === "boolean",
      ) ||
      !Number.isInteger(value.policy.maxApplications) ||
      value.policy.maxApplications < 1 ||
      value.policy.maxApplications > 10
    )
      throw invalid();
  }
  if (
    new TextEncoder().encode(JSON.stringify(value)).length > platformReportLimit
  )
    throw invalid();
  return structuredClone(value);
}

// Project only the reviewed setup fields. Request content, people, logs and
// resource selectors never travel with this portable observation.
export function platformObservation({
  origin,
  source,
  operator,
  snapshot,
  checkedAt = new Date().toISOString(),
}) {
  const setup = snapshot.setup;
  const policy = snapshot.profile;
  const report = {
    schema: "app-composer.platform-observation",
    version: 1,
    checkedAt,
    installation: { origin, source },
    workspace: {
      id: snapshot.workspace.id,
      name: snapshot.workspace.name,
      role: snapshot.workspace.role,
    },
    operator,
    target: setup
      ? { account: setup.target.account, environment: setup.target.environment }
      : null,
    inventory: {
      existingStacks: setup?.existingStacks ?? null,
      managed: setup?.managed ?? policy !== null,
      resumable: snapshot.requests
        .filter((entry) => entry.actorIsRequester && entry.resumable)
        .map((entry) => entry.id),
      partial: snapshot.requests.length >= 50,
    },
    policy: policy
      ? {
          revision: policy.revision,
          enabled: policy.enabled,
          reviewRequired: policy.reviewRequired,
          maxApplications: policy.maxApplications,
          supported:
            policy.allowedRecipes.includes("guestbook") &&
            policy.environments.includes("preview") &&
            policy.dataClasses.includes("synthetic"),
        }
      : null,
    runner: snapshot.runner.available,
  };
  return validatePlatformReport(report);
}

const actions = {
  refresh: [
    "Check the workspace again",
    "This observation is older than five minutes. Read current membership, policy and connection before continuing.",
  ],
  target: [
    "Inspect the selected installation",
    "Account, runtime or exact Composer source was not observed. Open the protected platform to inspect it; an older runtime may need an update.",
  ],
  inspect: [
    "Inspect existing applications",
    "This runtime did not report its workspace inventory. Inspect it before registering standing policy.",
  ],
  adoption: [
    "Resolve existing application ownership",
    "This workspace already has applications and has no platform policy. Adoption is not supported yet. Keep these applications intact and select a separate empty workspace for the supported setup.",
  ],
  configure: [
    "Set the standing rules",
    "Enable the supported recipe, synthetic preview requests and a bounded application limit in the protected platform. Saving policy does not create an application.",
  ],
  "ask-owner": [
    "Ask the platform operator to prepare this team",
    "Your membership is active. A currently authorised operator and workspace owner must establish standing policy.",
  ],
  paused: [
    "Review the paused policy",
    "Requests are paused. Existing applications and their lifecycle protections remain in place. An authorised owner can review the policy.",
  ],
  policy: [
    "Review the permitted recipe",
    "The saved policy does not permit the supported synthetic preview recipe. Ask the operator to review its intended scope.",
  ],
  connection: [
    "Reconnect the existing app adapter",
    "The trusted resource adapter is unavailable. Retain existing request identities and ask the operator to restore the connection before resuming.",
  ],
  resume: [
    "Resume your existing request",
    "An unfinished request is retained. Inspect its recorded outcome and reconcile uncertain operations before starting another application.",
  ],
  view: [
    "View team applications",
    "This workspace membership permits reading. Requesting an application requires an explicitly delegated editor capability.",
  ],
  request: [
    "Request a team application",
    "Use the team’s saved defaults. The server checks the current policy, quota and applicable review again before any operation.",
  ],
};
export function inspectPlatformReport(input, now = Date.now()) {
  const report = validatePlatformReport(input, now);
  const stale = now - Date.parse(report.checkedAt) > 300000;
  const { policy, inventory, workspace, target } = report;
  const next = stale
    ? "refresh"
    : !target ||
        target.account === "unavailable" ||
        target.environment === "unavailable" ||
        !report.installation.source
      ? "target"
      : !policy && inventory.existingStacks === null
        ? "inspect"
        : !policy && inventory.existingStacks > 0
          ? "adoption"
          : !policy
            ? report.operator && workspace.role === "owner"
              ? "configure"
              : "ask-owner"
            : !policy.enabled
              ? "paused"
              : !policy.supported
                ? "policy"
                : !report.runner
                  ? "connection"
                  : inventory.resumable.length
                    ? "resume"
                    : workspace.role === "viewer"
                      ? "view"
                      : "request";
  return {
    report,
    readOnly: true,
    ready: false,
    stale,
    next: { id: next, label: actions[next][0], text: actions[next][1] },
  };
}
