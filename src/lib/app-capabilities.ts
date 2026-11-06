// Composer's verified, read-only capability catalogue. An entry describes an
// operation the app already supports; it never grants permission, executes code
// or carries a credential. App-owned manifest declarations remain #412/#3 work.
import { apps } from "./apps.ts";

export const capabilitiesVersion = 1;
export const capabilitiesReviewed = "2026-11-06";

export type CapabilityKind = "read" | "effect";
export type CapabilityAvailability =
  | "public"
  | "guest-invitation"
  | "owner-scope"
  | "local";

export interface CapabilityOperation {
  name: string;
  description: string;
  kind: CapabilityKind;
  method: "GET" | "POST";
  path: string;
  availability: CapabilityAvailability;
  requires: string[];
  confirmation: boolean;
  verified: string;
}

export interface AppCapabilities {
  id: string;
  name: string;
  origin: string;
  repository: string;
  status: "verified" | "limited";
  storage: "app-owned" | "browser-local" | "none";
  ui: string;
  guides: { label: string; href: string }[];
  operations: CapabilityOperation[];
}

const availability: CapabilityAvailability[] = [
  "public",
  "guest-invitation",
  "owner-scope",
  "local",
];
const operationKeys = [
  "name",
  "description",
  "kind",
  "method",
  "path",
  "availability",
  "requires",
  "confirmation",
  "verified",
];
const appKeys = [
  "id",
  "name",
  "origin",
  "repository",
  "status",
  "storage",
  "ui",
  "guides",
  "operations",
];

function text(value: unknown, max: number, label: string) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("Capability " + label + " must be short readable text");
  return value.trim();
}

function exactKeys(value: object, keys: string[], label: string) {
  const actual = Object.keys(value).sort().join(",");
  const expected = [...keys].sort().join(",");
  if (actual !== expected)
    throw new Error("Capability " + label + " has unsupported fields");
}

function path(value: unknown) {
  const result = text(value, 120, "path");
  if (
    !/^\/[a-z0-9:/_-]+$/i.test(result) ||
    result.includes("//") ||
    result.includes("..") ||
    result.includes("?") ||
    result.includes("#")
  )
    throw new Error("Capability path must be a safe relative path");
  return result;
}

function date(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Capability " + label + " must be a dated review");
  return value;
}

function operation(value: CapabilityOperation, app: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Capability operation must be an object");
  exactKeys(value, operationKeys, "operation");
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(value.name))
    throw new Error("Capability operation name is invalid");
  text(value.description, 240, "description");
  if (!["read", "effect"].includes(value.kind))
    throw new Error("Capability kind must be read or effect");
  if (!["GET", "POST"].includes(value.method))
    throw new Error("Capability method is unsupported");
  path(value.path);
  if (!availability.includes(value.availability))
    throw new Error("Capability availability is unsupported");
  if (
    !Array.isArray(value.requires) ||
    value.requires.length > 4 ||
    value.requires.some((item) => !/^[a-z][a-z0-9-]{0,40}$/.test(item))
  )
    throw new Error("Capability requirements must be short identifiers");
  date(value.verified, "operation review");
  // An effect must say it needs a deliberate confirmation and a real permit.
  // A read must not claim a confirmation step it does not have.
  if (value.kind === "effect" && (!value.confirmation || !value.requires.length))
    throw new Error(
      "Capability effect requires confirmation and a stated permit",
    );
  if (value.kind === "read" && value.confirmation)
    throw new Error("Capability read cannot require a write confirmation");
  if (value.availability === "public" && value.kind === "effect")
    throw new Error("Capability public effect must be scoped");
  void app;
  return value;
}

/** Validates the catalogue shape; it does not grant anything it describes. */
export function validateCapabilities(value: AppCapabilities[]) {
  if (!Array.isArray(value) || !value.length)
    throw new Error("Capability catalogue is empty");
  const known = new Set<string>(apps.map((app) => app.id));
  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Capability app must be an object");
    exactKeys(entry, appKeys, "app");
    if (!known.has(entry.id))
      throw new Error("Capability app is not in the shipped library: " + entry.id);
    if (ids.has(entry.id))
      throw new Error("Capability app is repeated: " + entry.id);
    ids.add(entry.id);
    text(entry.name, 80, "app name");
    const origin = new URL(text(entry.origin, 2048, "origin"));
    if (origin.protocol !== "https:" || origin.username || origin.password)
      throw new Error("Capability origin must be public HTTPS");
    if (!/^https:\/\/github\.com\/[a-z0-9-]+\/[a-z0-9-]+$/.test(entry.repository))
      throw new Error("Capability repository must be an exact GitHub URL");
    if (!["verified", "limited"].includes(entry.status))
      throw new Error("Capability status is unsupported");
    if (!["app-owned", "browser-local", "none"].includes(entry.storage))
      throw new Error("Capability storage is unsupported");
    if (!entry.ui.startsWith("/") && !entry.ui.startsWith("https://"))
      throw new Error("Capability UI must be a supported link");
    if (!Array.isArray(entry.guides) || entry.guides.length > 3)
      throw new Error("Capability guides must be bounded");
    for (const guide of entry.guides) {
      exactKeys(guide, ["label", "href"], "guide");
      text(guide.label, 60, "guide label");
      if (!guide.href.startsWith("/") && !guide.href.startsWith("https://"))
        throw new Error("Capability guide must be a supported link");
    }
    if (!Array.isArray(entry.operations) || entry.operations.length > 8)
      throw new Error("Capability operations must be bounded");
    const names = new Set<string>();
    for (const item of entry.operations) {
      operation(item, entry.id);
      if (names.has(item.name))
        throw new Error("Capability operation is repeated: " + item.name);
      names.add(item.name);
    }
  }
  // A credential or secret field never belongs in a public catalogue.
  if (/(?:"[^"]*(?:secret|password|api[_-]?key|authorization)[^"]*"\s*:)/i.test(JSON.stringify(value)))
    throw new Error("Capability catalogue must not carry credentials");
  return value;
}

const catalogue: AppCapabilities[] = [
  {
    id: "linkcheck",
    name: "Link Check",
    origin: "https://share.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-linkcheck",
    status: "verified",
    storage: "none",
    ui: "https://share.loftwah.com",
    guides: [
      { label: "Product guide", href: "/for/developer" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-linkcheck" },
    ],
    operations: [
      {
        name: "inspect-page",
        description:
          "Read one public HTTPS page and return bounded metadata, icon, share-image and discovery findings. Raw HTML only.",
        kind: "read",
        method: "POST",
        path: "/api/inspect",
        availability: "public",
        requires: ["public-https-url"],
        confirmation: false,
        verified: "2026-11-06",
      },
      {
        name: "read-health",
        description:
          "Read public liveness and the exact deployed source revision. It does not query storage or prove a user journey.",
        kind: "read",
        method: "GET",
        path: "/healthz",
        availability: "public",
        requires: ["none"],
        confirmation: false,
        verified: "2026-11-06",
      },
    ],
  },
  {
    id: "guestbook",
    name: "Here / there",
    origin: "https://guestbook.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-guestbook",
    status: "verified",
    storage: "app-owned",
    ui: "https://guestbook.loftwah.com",
    guides: [
      { label: "Contribution contract", href: "/docs" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-guestbook" },
    ],
    operations: [
      {
        name: "read-invitation",
        description:
          "Read one visitor book's current invitation state, contribution limits and exact form paths. It never returns the guest code or private media.",
        kind: "read",
        method: "GET",
        path: "/r/:resource/api/invitation",
        availability: "public",
        requires: ["none"],
        confirmation: false,
        verified: "2026-11-06",
      },
      {
        name: "list-public-items",
        description:
          "Read only the currently public, approved contributions. Pending, hidden and deleted items are excluded.",
        kind: "read",
        method: "GET",
        path: "/api/items",
        availability: "public",
        requires: ["none"],
        confirmation: false,
        verified: "2026-11-06",
      },
    ],
  },
  {
    id: "showcase",
    name: "Linkarooie",
    origin: "https://showcase.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-showcase",
    status: "verified",
    storage: "app-owned",
    ui: "https://showcase.loftwah.com",
    guides: [
      { label: "Profile settings", href: "/docs" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-showcase" },
    ],
    operations: [
      {
        name: "read-public-profile",
        description:
          "Read one explicitly published profile snapshot. Draft profile edits and owner configuration stay private.",
        kind: "read",
        method: "GET",
        path: "/p/:handle/",
        availability: "public",
        requires: ["none"],
        confirmation: false,
        verified: "2026-11-06",
      },
    ],
  },
  {
    id: "ldraw",
    name: "LDraw",
    origin: "https://ldraw.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-ldraw",
    status: "limited",
    storage: "browser-local",
    ui: "https://ldraw.loftwah.com",
    guides: [
      { label: "Editable diagram workflow", href: "/ldraw" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-ldraw" },
    ],
    operations: [],
  },
  {
    id: "paperwork",
    name: "Paperwork",
    origin: "https://paperwork.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-paperwork",
    status: "verified",
    storage: "browser-local",
    ui: "https://paperwork.loftwah.com",
    guides: [
      { label: "Product guide", href: "/paperwork" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-paperwork" },
    ],
    operations: [],
  },
  {
    id: "state",
    name: "Carry / forward",
    origin: "https://ai.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-state",
    status: "limited",
    storage: "browser-local",
    ui: "https://ai.loftwah.com",
    guides: [
      { label: "Fictional-only boundary", href: "/state" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-state" },
    ],
    operations: [],
  },
  {
    id: "launch-kit",
    name: "Launch Kit",
    origin: "https://composer-launch-kit.loftwah.workers.dev",
    repository: "https://github.com/loftwah/app-composer-launch-kit",
    status: "verified",
    storage: "browser-local",
    ui: "https://composer-launch-kit.loftwah.workers.dev",
    guides: [
      { label: "Package and adoption", href: "/launch-kit" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-launch-kit" },
    ],
    operations: [],
  },
  {
    id: "hello",
    name: "Hello World",
    origin: "https://ready.loftwah.com",
    repository: "https://github.com/loftwah/app-composer-hello",
    status: "limited",
    storage: "none",
    ui: "https://ready.loftwah.com",
    guides: [
      { label: "First-deployment journey", href: "/ready" },
      { label: "Independent source", href: "https://github.com/loftwah/app-composer-hello" },
    ],
    operations: [],
  },
];

export const appCapabilities = validateCapabilities(catalogue);
