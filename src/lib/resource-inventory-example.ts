// A deterministic fictional walkthrough for the resource inventory screen.
// It exists so the drift, unknown, stale and unbound states can be inspected
// and tested without a Cloudflare credential. Everything here is invented and
// labelled as fictional in the interface; it is never mixed into a real read.
import {
  configurationDigest,
  effectiveGuestbookConfiguration,
} from "./resource-client.ts";
import type {
  InventoryResource,
  ResourceInventorySnapshot,
} from "./resource-inventory-contract.ts";
import {
  classifyResource,
  compareProviderTags,
  configurationDifferences,
  countStatuses,
  expectedProviderTags,
  type OperationAction,
  type ProviderTag,
} from "./resource-inventory-model.ts";

const READ_AT = "2026-10-24T05:00:00.000Z";
const ACCOUNT = "fictional-account-0001";
const TARGET = "https://fictional.example/guestbook";
const SOURCE = "a1b2c3d4".repeat(5);
const WORKSPACE = {
  id: "fictional-workspace",
  name: "Fictional Club workspace",
  role: "owner" as const,
};

export async function fictionalResourceInventory(): Promise<ResourceInventorySnapshot> {
  const now = Date.parse(READ_AT);
  const actionHref =
    "/_emdash/admin/plugins/composer-stacks/stacks?" +
    new URLSearchParams({ workspace: WORKSPACE.id });
  const digest = async (values: Record<string, string>) =>
    configurationDigest(effectiveGuestbookConfiguration(values));
  const base = {
    title: "Fictional trail journal",
    intro: "Walks, weather and notes from a made-up ridge line.",
    theme: "midnight",
    layout: "grid",
    guestAccess: "closed",
  };
  const changed = {
    ...base,
    title: "Fictional trail journal, second edition",
    guestAccess: "postcards",
  };
  const tagsFor = (labels: {
    workspace: string;
    app: string;
    environment: string;
    resource: string;
  }) => expectedProviderTags(labels);

  const trailTags = tagsFor({
    workspace: WORKSPACE.name,
    app: "guestbook",
    environment: "production",
    resource: "fictional-guestbook-trail",
  });
  const clubTags = tagsFor({
    workspace: WORKSPACE.name,
    app: "guestbook",
    environment: "production",
    resource: "fictional-guestbook-club",
  });
  // The club row keeps one agreeing tag and one invented extra tag, so the
  // comparison shows both "partial" tags and the fact Composer never removes
  // an unrelated tag.
  const clubRecorded: ProviderTag[] = [
    clubTags[0]!,
    { key: "owner:team", value: "fictional-committee" },
  ];
  const trailRecorded: ProviderTag[] = trailTags;

  const build = async (input: {
    id: string;
    state: InventoryResource["state"];
    version: number;
    recordedAt: string;
    configuration: Record<string, string> | null;
    configurationRevision: number | null;
    expectedValues: Record<string, string> | null;
    basis: InventoryResource["expected"]["basis"];
    stack?: {
      id: string;
      name: string;
      slug: string;
      instance: string;
      label: string;
    };
    pinned?: number[];
    unfinished?: InventoryResource["unfinishedOperation"];
    confirmedAt: string | null;
    confirmedAction?: OperationAction;
    recordedTags: ProviderTag[] | null;
  }): Promise<InventoryResource> => {
    const configuration =
      input.configuration && input.configurationRevision
        ? {
            revision: input.configurationRevision,
            digest: await digest(input.configuration),
            source: SOURCE,
            values: input.configuration,
          }
        : null;
    const expected = {
      basis: input.basis,
      stackId: input.stack?.id ?? null,
      stackName: input.stack?.name ?? null,
      instanceId: input.stack?.instance ?? null,
      instanceLabel: input.stack?.label ?? null,
      digest: input.expectedValues ? await digest(input.expectedValues) : null,
      source: input.expectedValues ? SOURCE : null,
      values: input.expectedValues,
      note:
        input.basis === "inherited"
          ? "This saved stack reuses the confirmed configuration of another instance, so there is no separate local override to compare."
          : null,
    };
    const providerTags = compareProviderTags(
      tagsFor({
        workspace: WORKSPACE.name,
        app: "guestbook",
        environment: "production",
        resource: input.id,
      }),
      input.recordedTags,
    );
    const observation = {
      id: input.id,
      state: input.state,
      configuration,
      expected: {
        available: Boolean(expected.values),
        basis: expected.basis,
        values: expected.values,
        digest: expected.digest,
        source: expected.source,
        note: expected.note,
      },
      targetMatches: true,
      bindings: input.stack ? 1 : 0,
      unfinished: input.unfinished ?? null,
      lastConfirmedAt: input.confirmedAt,
      published: input.pinned
        ? { pinned: input.pinned, current: configuration?.revision ?? null }
        : null,
      providerTags,
      actionHref,
    };
    const { status, findings } = classifyResource(observation, now);
    return {
      id: input.id,
      app: "guestbook",
      service: "GUESTBOOK",
      account: ACCOUNT,
      environment: "production",
      target: TARGET,
      recordedAt: input.recordedAt,
      state: input.state,
      version: input.version,
      status,
      configuration,
      expected,
      differences: configurationDifferences(
        configuration?.values ?? null,
        expected.values,
      ),
      bindings: input.stack
        ? [
            {
              stackId: input.stack.id,
              stackName: input.stack.name,
              stackSlug: input.stack.slug,
              stackStatus: "published",
              instanceId: input.stack.instance,
              instanceLabel: input.stack.label,
              mode: "own",
            },
          ]
        : [],
      published: observation.published,
      lastConfirmedOperation:
        input.confirmedAt && input.confirmedAction
          ? { action: input.confirmedAction, at: input.confirmedAt }
          : null,
      unfinishedOperation: input.unfinished ?? null,
      labels: {
        workspace: WORKSPACE.name,
        stack: input.stack?.name ?? null,
        instance: input.stack?.label ?? null,
        app: "Guestbook",
        environment: "production",
      },
      providerTags,
      findings,
    };
  };

  const resources: InventoryResource[] = [
    await build({
      id: "fictional-guestbook-trail",
      state: "ready",
      version: 6,
      recordedAt: "2026-09-30T00:10:00.000Z",
      configuration: base,
      configurationRevision: 4,
      expectedValues: base,
      basis: "saved-draft",
      stack: {
        id: "fictional-stack-trail",
        name: "Fictional Trail Notes",
        slug: "fictional-trail-notes",
        instance: "fictional-trail-instance",
        label: "Trail postcards",
      },
      pinned: [4],
      confirmedAt: "2026-10-21T03:20:00.000Z",
      confirmedAction: "activate",
      recordedTags: trailRecorded,
    }),
    await build({
      id: "fictional-guestbook-club",
      state: "ready",
      version: 9,
      recordedAt: "2026-09-12T23:40:00.000Z",
      configuration: base,
      configurationRevision: 3,
      expectedValues: changed,
      basis: "saved-draft",
      stack: {
        id: "fictional-stack-club",
        name: "Fictional Club",
        slug: "fictional-club",
        instance: "fictional-club-instance",
        label: "Club photo wall",
      },
      pinned: [2],
      confirmedAt: "2026-10-14T22:05:00.000Z",
      confirmedAction: "activate",
      recordedTags: clubRecorded,
    }),
    await build({
      id: "fictional-guestbook-board",
      state: "unknown",
      version: 12,
      recordedAt: "2026-08-28T06:15:00.000Z",
      configuration: base,
      configurationRevision: 5,
      expectedValues: base,
      basis: "saved-draft",
      stack: {
        id: "fictional-stack-board",
        name: "Fictional Launch Board",
        slug: "fictional-launch-board",
        instance: "fictional-board-instance",
        label: "Launch board",
      },
      unfinished: {
        action: "stage",
        state: "unknown",
        at: "2026-10-23T09:30:00.000Z",
      },
      confirmedAt: "2026-10-02T01:00:00.000Z",
      confirmedAction: "activate",
      recordedTags: null,
    }),
    await build({
      id: "fictional-guestbook-archive",
      state: "ready",
      version: 2,
      recordedAt: "2026-06-01T04:00:00.000Z",
      configuration: base,
      configurationRevision: 1,
      expectedValues: base,
      basis: "saved-draft",
      stack: {
        id: "fictional-stack-archive",
        name: "Fictional Winter Archive",
        slug: "fictional-winter-archive",
        instance: "fictional-archive-instance",
        label: "Winter archive",
      },
      pinned: [1],
      confirmedAt: "2026-08-10T02:00:00.000Z",
      confirmedAction: "activate",
      recordedTags: null,
    }),
    await build({
      id: "fictional-guestbook-unused",
      state: "ready",
      version: 1,
      recordedAt: "2026-05-04T01:00:00.000Z",
      configuration: base,
      configurationRevision: 1,
      expectedValues: null,
      basis: "unavailable",
      confirmedAt: "2026-05-04T01:30:00.000Z",
      confirmedAction: "create",
      recordedTags: null,
    }),
  ];

  return {
    ok: true,
    version: "composer.resources/1",
    synthetic: true,
    workspace: WORKSPACE,
    installation: {
      account: ACCOUNT,
      environment: "production",
      target: TARGET,
      service: "GUESTBOOK",
      bindingAvailable: true,
      credentialPresent: true,
      appSource: SOURCE,
    },
    provider: {
      state: "recorded",
      tags: [],
      verifiedAt: READ_AT,
      note: "Fictional walkthrough only. Each row carries an invented provider tag snapshot so the comparison can be inspected; no Cloudflare account, tag or billing record was read.",
    },
    readAt: READ_AT,
    atLimit: false,
    counts: countStatuses(resources),
    resources,
  };
}
