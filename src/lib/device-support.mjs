// Device support describes a reviewed app release, never the operator's machine.
export const deviceKinds = ["desktop", "phone", "tablet"];
export const deviceActivities = [
  "core",
  "view",
  "edit",
  "play",
  "import",
  "export",
];
export const deviceTargets = ["unknown", "desktop", "mobile", "both"];
const statuses = ["unknown", "supported", "limited", "unsupported"];
const requirements = [
  "keyboard",
  "pointer",
  "touch",
  "stylus",
  "landscape",
  "portrait",
  "file-download",
  "file-picker",
];

function object(value, keys, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    throw Error("Invalid device support " + label);
  }
}

function text(value, max, label) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw Error("Invalid device support " + label);
  }
  return value.trim();
}

export function validateDeviceTarget(value = "unknown") {
  if (!deviceTargets.includes(value))
    throw Error("Choose desktop, mobile, both or an undecided device target");
  return value;
}

function assessment(input) {
  object(input, ["status", "note", "requirements", "evidence"], "assessment");
  if (!statuses.includes(input.status))
    throw Error("Invalid device support status");
  const result = { status: input.status };
  if (input.note !== undefined) result.note = text(input.note, 240, "note");
  if (input.status === "limited" || input.status === "unsupported") {
    if (!result.note)
      throw Error("Explain the limited or unsupported device operation");
  }
  if (input.requirements !== undefined) {
    if (
      !Array.isArray(input.requirements) ||
      input.requirements.length > requirements.length ||
      new Set(input.requirements).size !== input.requirements.length ||
      input.requirements.some((item) => !requirements.includes(item))
    ) {
      throw Error("Invalid device support requirements");
    }
    result.requirements = [...input.requirements];
  }
  if (input.evidence !== undefined) {
    const evidence = input.evidence;
    object(evidence, ["revision", "checked", "method", "journey"], "evidence");
    if (
      !/^[a-f0-9]{40}$/.test(evidence.revision ?? "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(evidence.checked ?? "") ||
      !Number.isFinite(Date.parse(evidence.checked + "T00:00:00Z")) ||
      new Date(evidence.checked + "T00:00:00Z").toISOString().slice(0, 10) !==
        evidence.checked ||
      !["browser-emulation", "physical-device"].includes(evidence.method)
    ) {
      throw Error("Invalid device support release evidence");
    }
    const journey = text(evidence.journey, 240, "journey");
    if (!journey) throw Error("Name the device journey that was exercised");
    result.evidence = {
      revision: evidence.revision,
      checked: evidence.checked,
      method: evidence.method,
      journey,
    };
  }
  if (["supported", "limited"].includes(input.status) && !result.evidence) {
    throw Error(
      "Supported or limited device support requires actual release evidence",
    );
  }
  if (input.status === "unknown" && result.evidence)
    throw Error("Unknown device support cannot claim verification");
  return result;
}

export function validateDeviceSupport(input) {
  if (input === undefined)
    return { version: 1, target: "unknown", activities: {} };
  object(input, ["version", "target", "activities"], "declaration");
  if (input.version !== 1) throw Error("Unsupported device support version");
  const target = validateDeviceTarget(input.target);
  object(input.activities ?? {}, deviceActivities, "activities");
  const activities = {};
  for (const [activity, devices] of Object.entries(input.activities ?? {})) {
    object(devices, deviceKinds, "devices");
    activities[activity] = {};
    for (const [device, value] of Object.entries(devices))
      activities[activity][device] = assessment(value);
  }
  return { version: 1, target, activities };
}

// Invalid imported/public metadata fails to unknown; manifest validation remains strict.
export function readDeviceSupport(input, revision) {
  try {
    const support = validateDeviceSupport(input);
    if (
      revision &&
      Object.values(support.activities).some((devices) =>
        Object.values(devices).some(
          (value) => value.evidence && value.evidence.revision !== revision,
        ),
      )
    ) {
      return { version: 1, target: support.target, activities: {} };
    }
    return support;
  } catch {
    return validateDeviceSupport();
  }
}

export function deviceAssessment(support, device, activity = "core") {
  return support.activities[activity]?.[device] ?? { status: "unknown" };
}

export function deviceSummary(support) {
  const desktop = deviceAssessment(support, "desktop").status;
  const phone = deviceAssessment(support, "phone").status;
  if (
    deviceAssessment(support, "phone", "view").status === "supported" &&
    deviceAssessment(support, "phone", "edit").status === "unsupported" &&
    deviceAssessment(support, "desktop", "edit").status === "supported"
  ) {
    return "View on mobile. Edit on desktop.";
  }
  if (desktop === "supported" && phone === "supported")
    return "Desktop and phone";
  if (desktop === "supported" && phone === "unsupported")
    return "Desktop only · phone not supported";
  if (phone === "supported" && desktop === "unsupported")
    return "Phone only · desktop not supported";
  if (desktop === "supported")
    return "Desktop supported · phone not checked yet";
  if (phone === "supported") return "Phone supported · desktop not checked yet";
  if (desktop === "limited" || phone === "limited")
    return "Limited device support · check the details";
  if (desktop === "unsupported" || phone === "unsupported")
    return "Some devices are not supported · check the details";
  return "Device support not checked yet";
}

export function deviceFilterTokens(support) {
  const supported = deviceKinds.filter(
    (device) => deviceAssessment(support, device).status === "supported",
  );
  if (
    deviceKinds.some(
      (device) => deviceAssessment(support, device).status === "limited",
    )
  )
    supported.push("limited");
  if (
    deviceKinds.every(
      (device) => deviceAssessment(support, device).status === "unknown",
    )
  )
    supported.push("unknown");
  return supported.join(" ");
}

// One external record can qualify one exact release. Duplicates or changed pins
// cannot silently select an older assessment; manifest intention is preserved.
export function releaseDeviceSupport(id, revision, manifest, records) {
  const intention = readDeviceSupport(manifest);
  const unknown = { version: 1, target: intention.target, activities: {} };
  if (!records || records.version !== 1 || !Array.isArray(records.releases))
    return unknown;
  const matches = records.releases.filter(
    (item) => item && item.id === id && item.revision === revision,
  );
  if (matches.length !== 1) return unknown;
  const support = readDeviceSupport(matches[0].support, revision);
  if (intention.target !== "unknown" && support.target !== intention.target)
    return unknown;
  return support;
}
