// Composer's recorded identity for the eight first-party app Workers.
//
// Each row cites the app's own committed Wrangler manifest (which declares the
// Worker name), the documented production hostname and a recorded release
// receipt. This is Composer's declaration, not provider truth: the bounded
// check compares it with the account and reports verified, drift or unknown.
// A matching name, tag or description on its own is never treated as identity
// or ownership.
import type { AppWorkerIdentityRecord } from "./provider-inventory.mjs";

const receipt = (
  reference: string,
  versionId: string | null,
  commit: string | null,
): AppWorkerIdentityRecord["receipt"] => ({ reference, versionId, commit });

const reviewRelease =
  "Compare the live deployment with the app's own release receipt before calling it the current release.";

export const APP_WORKER_IDENTITIES: readonly AppWorkerIdentityRecord[] = [
  {
    app: "guestbook",
    worker: "composer-guestbook",
    repo: "https://github.com/loftwah/app-composer-guestbook",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "guestbook.loftwah.com",
    annotationPrefix: null,
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "ec9016ea-1dcf-4f1c-bd64-b957e4780ead",
      "5075d7be53b43aca288d3707fd06851aca91e8c2",
    ),
    nextAction: reviewRelease,
  },
  {
    app: "showcase",
    worker: "composer-showcase",
    repo: "https://github.com/loftwah/app-composer-showcase",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "showcase.loftwah.com",
    annotationPrefix: null,
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "23968fbc-f57a-4667-86e6-6a90e909d974",
      "f1dd27952ca8548f81fde5c5905346dae4a2b61b",
    ),
    nextAction: reviewRelease,
  },
  {
    app: "hello",
    worker: "composer-hello",
    repo: "https://github.com/loftwah/app-composer-hello",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "ready.loftwah.com",
    annotationPrefix: null,
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "e7086a4e-348b-42db-bb1a-d7df47863170",
      "db0a98c6c3bf2ff5ffb901d3d8f78de3698efb37",
    ),
    nextAction:
      "The recorded receipt matches the live version. Re-check only if the live build identity changes.",
  },
  {
    app: "state",
    worker: "composer-state",
    repo: "https://github.com/loftwah/app-composer-state",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "ai.loftwah.com",
    annotationPrefix: null,
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "ab43cf01-39a9-4cc4-8cb1-a338eeca3919",
      "ab67e2f2a36e5df04ae6708d9aaa3db6ed117013",
    ),
    nextAction:
      "The recorded receipt matches the live version. Keep the synthetic-only data gate until #31 is independently accepted.",
  },
  {
    app: "linkcheck",
    worker: "composer-linkcheck",
    repo: "https://github.com/loftwah/app-composer-linkcheck",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "share.loftwah.com",
    annotationPrefix: "Link Check ",
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "7c96b217-a9c7-4610-82f3-9f423f528bfe",
      "7970d17efcbd85270106f9ae042d3fb9d4d12a4d",
    ),
    nextAction: reviewRelease,
  },
  {
    app: "ldraw",
    worker: "composer-ldraw",
    repo: "https://github.com/loftwah/app-composer-ldraw",
    manifest: "wrangler.json",
    environment: "production",
    domain: "ldraw.loftwah.com",
    annotationPrefix: "LDraw ",
    receipt: receipt(
      "GitHub #11 LDraw editor source pin, 2026-10-25",
      null,
      "c9c2339a1296",
    ),
    nextAction:
      "Compare the live deployment annotation with the editor's own build.json before treating it as the published catalogue revision.",
  },
  {
    app: "paperwork",
    worker: "composer-paperwork",
    repo: "https://github.com/loftwah/app-composer-paperwork",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: "paperwork.loftwah.com",
    annotationPrefix: "Paperwork ",
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "207a2858-4850-4b69-91e1-38e601459aa7",
      "51f96278b18732bbd2991f30eae36aaba30c9b16",
    ),
    nextAction: reviewRelease,
  },
  {
    app: "launch-kit",
    worker: "composer-launch-kit",
    repo: "https://github.com/loftwah/app-composer-launch-kit",
    manifest: "wrangler.jsonc",
    environment: "production",
    domain: null,
    annotationPrefix: "Launch Kit ",
    receipt: receipt(
      "GitHub #11 consumer release, 2026-10-24",
      "01a3a0c7-f15e-486e-a1c0-1b673a35d50f",
      "1ce11132af0c1758cc439b02eb8c979d19448178",
    ),
    nextAction: reviewRelease,
  },
] as const;

/** The documented workers.dev hostname is the app name under the account subdomain. */
export const WORKERS_DEV_SUBDOMAIN = "loftwah";

export function firstPartyWorkerNames(): string[] {
  return APP_WORKER_IDENTITIES.map((identity) => identity.worker);
}

export interface AppStorageIdentityRecord {
  app: string;
  kind: "d1" | "r2" | "kv";
  name: string;
  id: string;
  environment: "production";
  repo: string;
  manifest: string;
}

/**
 * Storage declared by a first-party app's own committed Wrangler manifest.
 * These are app-owned, not part of Composer's composition state; the check
 * still records them so they are not silently counted as undeclared account
 * resources. Exact IDs/names come from the app repository, not from a
 * similarity in a name or tag.
 */
export const APP_STORAGE_IDENTITIES: readonly AppStorageIdentityRecord[] = [
  {
    app: "guestbook",
    kind: "d1",
    name: "composer-guestbook",
    id: "1b7862f8-35ca-46cc-a37d-e21142f81e21",
    environment: "production",
    repo: "https://github.com/loftwah/app-composer-guestbook",
    manifest: "wrangler.jsonc",
  },
  {
    app: "guestbook",
    kind: "r2",
    name: "composer-guestbook-photos",
    id: "composer-guestbook-photos",
    environment: "production",
    repo: "https://github.com/loftwah/app-composer-guestbook",
    manifest: "wrangler.jsonc",
  },
  {
    app: "showcase",
    kind: "d1",
    name: "composer-showcase",
    id: "c366203f-d880-4afc-a78e-d3e607146469",
    environment: "production",
    repo: "https://github.com/loftwah/app-composer-showcase",
    manifest: "wrangler.jsonc",
  },
] as const;
