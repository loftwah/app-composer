// Composer's declared provider expectations, kept in one readable place.
//
// These values mirror `wrangler.jsonc`, `composition.lock.json` and the
// promotion boundary. `tests/provider-inventory.test.mjs` re-reads the actual
// files and fails when this declaration drifts. A declaration is not provider
// truth: the inventory check compares it with a bounded read and reports the
// difference, including when the read could not happen.
import lock from "../../composition.lock.json" with { type: "json" };
import {
  composerTags,
  type ExpectedInventory,
  type ExpectedResource,
  type ProviderTag,
} from "./provider-inventory.mjs";

export const EXPECTED_ACCOUNT = "1003dc1d93af0ebea56b2f1252f89627";
export const EXPECTED_WORKER = "app-composer";
export const EXPECTED_PREVIEW_WORKER = "app-composer-preview";
export const EXPECTED_CUSTOM_DOMAIN = "composer.loftwah.com";
export const EXPECTED_CRON = "* * * * *";
export const EXPECTED_COMPATIBILITY_DATE = "2026-10-13";
export const EXPECTED_COMPATIBILITY_FLAGS = [
  "nodejs_compat",
  "global_fetch_strictly_public",
];
export const EXPECTED_CPU_MS = 1000;
export const EXPECTED_OBSERVABILITY = {
  enabled: true,
  headSamplingRate: 0.1,
} as const;
export const EXPECTED_D1 = [
  {
    binding: "DB",
    name: "app-composer-emdash",
    id: "1b2b29c8-4109-4a5f-901a-befc91173bc5",
    environment: "production",
  },
  {
    binding: "DB",
    name: "app-composer-emdash-preview",
    id: "bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a",
    environment: "preview",
  },
] as const;
export const EXPECTED_R2 = [
  {
    binding: "MEDIA",
    name: "app-composer-media",
    environment: "production",
  },
  {
    binding: "MEDIA",
    name: "app-composer-media-preview",
    environment: "preview",
  },
] as const;
export const EXPECTED_KV = [
  {
    binding: "SESSION",
    name: "app-composer-sessions",
    id: "3a76800194064e498949fd7c251af7e3",
    environment: "production",
  },
  {
    binding: "SESSION",
    name: "app-composer-preview-sessions",
    id: "2e7ac1e5417f4425be41d60d99a35de1",
    environment: "preview",
  },
] as const;

/** The documented first-party Worker names. None carries a recorded provider id. */
export const FIRST_PARTY_WORKERS = [
  { app: "guestbook", name: "composer-guestbook" },
  { app: "showcase", name: "composer-showcase" },
  { app: "hello", name: "composer-hello" },
  { app: "state", name: "composer-state" },
  { app: "linkcheck", name: "composer-linkcheck" },
  { app: "ldraw", name: "composer-ldraw" },
  { app: "paperwork", name: "composer-paperwork" },
  { app: "launch-kit", name: "composer-launch-kit" },
] as const;

const pinnedService = (app: string) =>
  "composer-" + app + "-" + String(lock.id).slice(0, 16);
const pinnedAnnotation = "Pinned composition " + lock.id;

function resource(
  input: Omit<ExpectedResource, "tags" | "note"> & {
    tags: ProviderTag[];
    note?: string | null;
  },
): ExpectedResource {
  return { ...input, note: input.note ?? null };
}

export function expectedProviderInventory(
  options: { revision?: string | null } = {},
): ExpectedInventory {
  const revision = options.revision?.trim() || null;
  const rootTags = composerTags({
    app: "app-composer",
    service: EXPECTED_WORKER,
    environment: "production",
    lifecycle: "active",
    owner: "loftwah",
  });
  const previewTags = composerTags({
    app: "app-composer",
    service: EXPECTED_PREVIEW_WORKER,
    environment: "preview",
    lifecycle: "preview",
    owner: "loftwah",
  });
  const resources: ExpectedResource[] = [
    resource({
      kind: "worker",
      name: EXPECTED_WORKER,
      id: null,
      environment: "production",
      source: "wrangler.jsonc",
      identityRecorded: true,
      tags: rootTags,
      checks: [
        {
          field: "account",
          expected: EXPECTED_ACCOUNT,
          source: "wrangler.jsonc",
        },
        {
          field: "customDomains",
          expected: [EXPECTED_CUSTOM_DOMAIN],
          source: "wrangler.jsonc:routes",
        },
        {
          field: "cron",
          expected: [EXPECTED_CRON],
          source: "wrangler.jsonc:triggers",
        },
        {
          field: "compatibilityDate",
          expected: EXPECTED_COMPATIBILITY_DATE,
          source: "wrangler.jsonc",
        },
        {
          field: "compatibilityFlags",
          expected: [...EXPECTED_COMPATIBILITY_FLAGS],
          source: "wrangler.jsonc",
        },
        {
          field: "observabilityEnabled",
          expected: EXPECTED_OBSERVABILITY.enabled,
          source: "wrangler.jsonc:observability",
        },
        {
          field: "cpuMs",
          expected: EXPECTED_CPU_MS,
          source: "wrangler.jsonc:limits",
        },
        {
          field: "binding:DB",
          expected: EXPECTED_D1[0].id,
          source: "wrangler.jsonc:d1_databases",
        },
        {
          field: "binding:MEDIA",
          expected: EXPECTED_R2[0].name,
          source: "wrangler.jsonc:r2_buckets",
        },
        {
          field: "binding:SESSION",
          expected: EXPECTED_KV[0].id,
          source: "wrangler.jsonc:kv_namespaces",
        },
        {
          field: "binding:GUESTBOOK",
          expected: pinnedService("guestbook") + "|production",
          source: "wrangler.jsonc:services",
        },
        {
          field: "binding:GUESTBOOK_MEMBERS",
          expected:
            pinnedService("guestbook") + "|production|GuestbookMemberService",
          source: "wrangler.jsonc:services",
        },
        {
          field: "binding:SHOWCASE",
          expected: pinnedService("showcase") + "|production",
          source: "wrangler.jsonc:services",
        },
        ...(revision
          ? [
              {
                field: "deploymentMessage",
                expected: "App Composer " + revision,
                source: "scripts/deploy.mjs",
              },
            ]
          : []),
      ],
    }),
    resource({
      kind: "worker",
      name: EXPECTED_PREVIEW_WORKER,
      id: null,
      environment: "preview",
      source: "wrangler.jsonc:env.preview",
      identityRecorded: true,
      tags: previewTags,
      checks: [
        {
          field: "account",
          expected: EXPECTED_ACCOUNT,
          source: "wrangler.jsonc",
        },
        {
          field: "customDomains",
          expected: [],
          source: "wrangler.jsonc:env.preview.routes",
        },
        {
          field: "cron",
          expected: [],
          source: "wrangler.jsonc:env.preview.triggers",
        },
        {
          field: "compatibilityDate",
          expected: EXPECTED_COMPATIBILITY_DATE,
          source: "wrangler.jsonc",
        },
        {
          field: "binding:GUESTBOOK",
          expected: "absent",
          source: "wrangler.jsonc:env.preview.services",
        },
        {
          field: "binding:SHOWCASE",
          expected: "absent",
          source: "wrangler.jsonc:env.preview.services",
        },
      ],
    }),
    ...EXPECTED_D1.map((database) =>
      resource({
        kind: "d1",
        name: database.name,
        id: database.id,
        environment: database.environment,
        source: "wrangler.jsonc:d1_databases",
        identityRecorded: true,
        tags: [],
        note: "Native D1 tag read is not verified on this path; no tag is assumed.",
        checks: [
          {
            field: "id",
            expected: database.id,
            source: "wrangler.jsonc:d1_databases",
          },
          {
            field: "name",
            expected: database.name,
            source: "wrangler.jsonc:d1_databases",
          },
        ],
      }),
    ),
    ...EXPECTED_R2.map((bucket) =>
      resource({
        kind: "r2",
        name: bucket.name,
        id: bucket.name,
        environment: bucket.environment,
        source: "wrangler.jsonc:r2_buckets",
        identityRecorded: true,
        tags: [],
        note: "Native R2 tag read is not verified on this path; no tag is assumed.",
        checks: [
          {
            field: "name",
            expected: bucket.name,
            source: "wrangler.jsonc:r2_buckets",
          },
        ],
      }),
    ),
    ...EXPECTED_KV.map((namespace) =>
      resource({
        kind: "kv",
        name: namespace.name,
        id: namespace.id,
        environment: namespace.environment,
        source: "wrangler.jsonc:kv_namespaces",
        identityRecorded: true,
        tags: [],
        note: "Native KV tag read is not verified on this path; no tag is assumed.",
        checks: [
          {
            field: "id",
            expected: namespace.id,
            source: "wrangler.jsonc:kv_namespaces",
          },
          {
            field: "name",
            expected: namespace.name,
            source: "wrangler.jsonc:kv_namespaces",
          },
        ],
      }),
    ),
    ...(["guestbook", "showcase"] as const).map((app) =>
      resource({
        kind: "service",
        name: pinnedService(app),
        id: null,
        environment: "production",
        source: "composition.lock.json",
        identityRecorded: true,
        tags: composerTags({
          app,
          service: pinnedService(app),
          environment: "production",
          lifecycle: "active",
          owner: "loftwah",
        }),
        note: "The service name is derived from the reviewed composition id and the promotion boundary. The deployment annotation is the confirming provider evidence; the name alone is not authority.",
        checks: [
          {
            field: "deploymentMessage",
            expected: pinnedAnnotation,
            source: "scripts/promotion-boundary.mjs",
          },
        ],
      }),
    ),
    ...FIRST_PARTY_WORKERS.map((worker) =>
      resource({
        kind: "worker",
        name: worker.name,
        id: null,
        environment: "production",
        source: "src/lib/release.json",
        identityRecorded: false,
        tags: composerTags({
          app: worker.app,
          service: worker.name,
          environment: "production",
          lifecycle: "active",
          owner: "loftwah",
        }),
        note: "Composer records this documented first-party app name but no provider Worker id or service identity. A matching name is a convention, not a confirmed identity.",
        checks: [
          {
            field: "name",
            expected: worker.name,
            source: "src/lib/release.json + docs/STATUS.md",
          },
        ],
      }),
    ),
  ];

  const workerHints: Record<string, "production" | "preview"> = {
    [EXPECTED_WORKER]: "production",
    [EXPECTED_PREVIEW_WORKER]: "preview",
  };
  for (const app of ["guestbook", "showcase"] as const)
    workerHints[pinnedService(app)] = "production";
  for (const worker of FIRST_PARTY_WORKERS)
    workerHints[worker.name] = "production";
  for (const bucket of EXPECTED_R2)
    workerHints[bucket.name] = bucket.environment;
  for (const namespace of EXPECTED_KV)
    workerHints[namespace.name] = namespace.environment;

  return {
    account: EXPECTED_ACCOUNT,
    resources,
    composition: {
      id: String(lock.id),
      annotation: pinnedAnnotation,
      apps: lock.apps.map((app: any) => ({
        id: String(app.id),
        commit: String(app.commit),
        service: pinnedService(String(app.id)),
        route: String(app.manifest?.routes?.[0] ?? "/" + String(app.id)),
        url: String(app.url),
      })),
    },
    workerHints,
    databaseHints: Object.fromEntries(
      EXPECTED_D1.map((database) => [database.id, database.environment]),
    ),
    databaseIds: EXPECTED_D1.map((database) => database.id),
    workerNames: [
      EXPECTED_WORKER,
      EXPECTED_PREVIEW_WORKER,
      pinnedService("guestbook"),
      pinnedService("showcase"),
      ...FIRST_PARTY_WORKERS.map((worker) => worker.name),
    ],
    settingsFor: [EXPECTED_WORKER, EXPECTED_PREVIEW_WORKER],
    schedulesFor: [EXPECTED_WORKER, EXPECTED_PREVIEW_WORKER],
    revision,
    sources: [
      "wrangler.jsonc",
      "composition.lock.json",
      "scripts/promotion-boundary.mjs",
      "src/lib/release.json",
    ],
  };
}
