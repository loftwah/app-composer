// Read-only resource inventory: Composer's trusted records, stated plainly.
// The schema is the transport boundary; the server validates its own snapshot
// before replying and the owner screen validates the reply before display.
import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const text = (max: number) => z.string().min(1).max(max);
const maybe = (max: number) => z.string().max(max);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.string().regex(/^[a-f0-9]{40}$/);
const values = z.record(z.string().min(1).max(40), z.string().max(240));
const tag = z.object({ key: text(80), value: maybe(120) }).strict();

export const inventoryFinding = z
  .object({
    code: z.enum([
      "target-mismatch",
      "unfinished-operation",
      "operation-refused",
      "state-unknown",
      "not-activated",
      "declared-settings-incomplete",
      "source-drift",
      "unapplied-settings",
      "published-configuration-drift",
      "provider-tag-drift",
      "stale-check",
      "no-binding",
    ]),
    severity: z.enum(["attention", "unknown", "info"]),
    title: text(120),
    detail: text(700),
    action: z
      .object({ label: text(60), href: maybe(400) })
      .strict()
      .nullable(),
  })
  .strict();
export type InventoryFinding = z.infer<typeof inventoryFinding>;

export const inventoryBinding = z
  .object({
    stackId: id,
    stackName: text(200),
    stackSlug: text(200),
    stackStatus: z.enum(["draft", "published", "archived"]),
    instanceId: id,
    instanceLabel: text(200),
    mode: z.enum(["own", "shared"]),
  })
  .strict();

export const inventoryResource = z
  .object({
    id,
    app: z.literal("guestbook"),
    service: z.literal("GUESTBOOK"),
    account: maybe(80),
    environment: maybe(40),
    target: maybe(200),
    recordedAt: z.iso.datetime(),
    state: z.enum(["reserved", "ready", "unknown", "refused"]),
    version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(["in-step", "stale", "attention", "unknown", "unbound"]),
    configuration: z
      .object({
        revision,
        digest,
        source,
        values,
      })
      .strict()
      .nullable(),
    expected: z
      .object({
        basis: z.enum(["saved-draft", "inherited", "unavailable"]),
        stackId: id.nullable(),
        stackName: maybe(200).nullable(),
        instanceId: id.nullable(),
        instanceLabel: maybe(200).nullable(),
        digest: digest.nullable(),
        source: source.nullable(),
        values: values.nullable(),
        note: maybe(400).nullable(),
      })
      .strict(),
    differences: z
      .array(
        z
          .object({
            field: text(40),
            current: maybe(240).nullable(),
            expected: maybe(240).nullable(),
          })
          .strict(),
      )
      .max(12),
    bindings: z.array(inventoryBinding).max(12),
    published: z
      .object({
        pinned: z.array(revision).max(12),
        current: revision.nullable(),
      })
      .strict()
      .nullable(),
    lastConfirmedOperation: z
      .object({
        action: z.enum(["create", "stage", "activate", "moderate", "control"]),
        at: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    unfinishedOperation: z
      .object({
        action: z.enum(["create", "stage", "activate", "moderate", "control"]),
        state: z.enum(["pending", "unknown"]),
        at: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    labels: z
      .object({
        workspace: text(200),
        stack: maybe(200).nullable(),
        instance: maybe(200).nullable(),
        app: z.literal("Guestbook"),
        environment: maybe(40),
      })
      .strict(),
    providerTags: z
      .object({
        state: z.enum(["unverified", "match", "mismatch", "partial"]),
        expected: z.array(tag).max(8),
        recorded: z.array(tag).max(8).nullable(),
        missing: z.array(text(80)).max(8),
        unexpected: z.array(text(80)).max(8),
      })
      .strict(),
    findings: z.array(inventoryFinding).max(12),
  })
  .strict();
export type InventoryResource = z.infer<typeof inventoryResource>;

export const resourceInventory = z
  .object({
    ok: z.literal(true),
    version: z.literal("composer.resources/1"),
    synthetic: z.boolean(),
    workspace: z
      .object({
        id,
        name: text(200),
        role: z.enum(["owner", "editor", "viewer"]),
      })
      .strict(),
    installation: z
      .object({
        account: maybe(80),
        environment: maybe(40),
        target: maybe(200),
        service: z.literal("GUESTBOOK"),
        bindingAvailable: z.boolean(),
        credentialPresent: z.boolean(),
        appSource: source.nullable(),
      })
      .strict(),
    provider: z
      .object({
        state: z.enum(["unverified", "recorded"]),
        tags: z.array(tag).max(8),
        verifiedAt: z.iso.datetime().nullable(),
        note: text(700),
      })
      .strict(),
    readAt: z.iso.datetime(),
    atLimit: z.boolean(),
    counts: z
      .object({
        inStep: z.number().int().nonnegative().max(40),
        stale: z.number().int().nonnegative().max(40),
        attention: z.number().int().nonnegative().max(40),
        unknown: z.number().int().nonnegative().max(40),
        unbound: z.number().int().nonnegative().max(40),
      })
      .strict(),
    resources: z.array(inventoryResource).max(40),
  })
  .strict();
export type ResourceInventorySnapshot = z.infer<typeof resourceInventory>;
