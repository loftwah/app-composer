import type { D1Database } from "@cloudflare/workers-types";
import { isBlueskyDid } from "./bluesky-account.ts";
import {
  blueskyObservationGraceHours,
  blueskyObservationSchema,
  blueskyObservationWindows,
  type BlueskyObservation,
} from "./bluesky-observation-contract.ts";
import { readBoundedJson } from "./share-catalogue-asset.ts";

const hour = 3_600_000;
const maxAttempts = 3;
const maxPerTick = 8;
const leaseDuration = 5 * 60_000;
const nextRetryDelay = [15, 45].map((minutes) => minutes * 60_000);
const latestWindow = blueskyObservationWindows.at(-1)!;
const appView = "https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts";

type Candidate = {
  delivery_key: string;
  window_hours: number;
  due_at: string;
  provider_uri: string;
  provider_cid: string;
  account_did: string;
  rkey: string;
};
type Claimed = Candidate & { claim: string; attempts: number };
type Failure = NonNullable<BlueskyObservation["lastFailure"]>;
type Counters = Pick<
  BlueskyObservation,
  "likes" | "replies" | "reposts" | "quotes"
>;
type ObservationResult = { counters: Counters } | { failure: Failure };

const getCounter = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

type PublicPost = {
  uri?: unknown;
  cid?: unknown;
  likeCount?: unknown;
  replyCount?: unknown;
  repostCount?: unknown;
  quoteCount?: unknown;
};

async function readAppView(records: Claimed[], fetcher: typeof fetch) {
  const url = new URL(appView);
  for (const uri of new Set(records.map((record) => record.provider_uri)))
    url.searchParams.append("uris", uri);
  const signal = AbortSignal.timeout(6_000);
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "error",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw Error("AppView unavailable");
  }
  const payload = (await readBoundedJson(response, signal, 524_288)) as {
    posts?: unknown;
  } | null;
  if (!Array.isArray(payload?.posts) || payload.posts.length > maxPerTick)
    throw Error("Invalid AppView response");
  return (payload.posts as unknown[]).filter((post): post is PublicPost =>
    Boolean(post && typeof post === "object" && "uri" in post && "cid" in post),
  );
}

function matchResult(record: Claimed, posts: PublicPost[]): ObservationResult {
  const post = posts.find((entry) => entry.uri === record.provider_uri);
  if (!post) return { failure: "post_missing" };
  if (post.cid !== record.provider_cid) return { failure: "revision_changed" };
  return {
    counters: {
      likes: getCounter(post.likeCount),
      replies: getCounter(post.replyCount),
      reposts: getCounter(post.repostCount),
      quotes: getCounter(post.quoteCount),
    },
  };
}

export async function runScheduledBlueskyObservations(
  db: D1Database,
  now: Date,
  fetcher = globalThis.fetch,
  clock = () => new Date(),
) {
  const startedAt = now.toISOString();
  const baselineBefore = new Date(
    now.getTime() - (latestWindow + blueskyObservationGraceHours) * hour,
  );
  const { results: candidates } = await db
    .prepare(
      `WITH windows(window_hours) AS (VALUES (0),(24),(72),(168)),
     targets AS (
       SELECT d.idempotency_key AS delivery_key, w.window_hours,
         CASE
           WHEN w.window_hours = 0 THEN COALESCE(o.due_at, ?1)
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', d.published_at, '+' || w.window_hours || ' hours')
         END AS due_at,
         d.provider_uri,d.provider_cid,d.account_did,d.rkey
       FROM creator_share_deliveries d CROSS JOIN windows w
       LEFT JOIN creator_share_bluesky_observations o
         ON (o.delivery_key,o.window_hours)=(d.idempotency_key,w.window_hours)
       WHERE d.state='published' AND d.published_at <= ?1
         AND o.observed_at IS NULL AND COALESCE(o.attempts,0) < ?3
         AND (o.delivery_key IS NULL OR o.retry_at <= ?1 OR o.lease_until <= ?1)
         AND (
           (w.window_hours > 0 AND d.published_at >= ?2)
           OR (w.window_hours = 0 AND d.published_at < ?2 AND NOT EXISTS (
             SELECT 1 FROM creator_share_bluesky_observations
             WHERE delivery_key=d.idempotency_key AND window_hours > 0
           ))
         )
     )
     SELECT * FROM targets
     WHERE due_at <= ?1 AND (
       window_hours = 0 OR strftime('%Y-%m-%dT%H:%M:%fZ',due_at,'+' || ?4 || ' hours') > ?1
     )
     ORDER BY window_hours = 0, due_at, delivery_key LIMIT ?5`,
    )
    .bind(
      startedAt,
      baselineBefore.toISOString(),
      maxAttempts,
      blueskyObservationGraceHours,
      maxPerTick,
    )
    .all<Candidate>();
  if (!candidates.length) return { observed: 0, failed: 0 };

  const leaseUntil = new Date(now.getTime() + leaseDuration).toISOString();
  const claimed: Claimed[] = [];
  for (const candidate of candidates) {
    const claim = crypto.randomUUID();
    const row = await db
      .prepare(
        `INSERT INTO creator_share_bluesky_observations (
         delivery_key,window_hours,due_at,attempted_at,lease_until,claim,attempts
       ) VALUES (?1,?2,?3,?4,?5,?6,1)
       ON CONFLICT(delivery_key,window_hours) DO UPDATE SET attempted_at=excluded.attempted_at,
         lease_until=excluded.lease_until,claim=excluded.claim,retry_at=NULL,attempts=attempts+1
       WHERE observed_at IS NULL AND attempts < ?7 AND (retry_at <= ?4 OR lease_until <= ?4)
       RETURNING attempts`,
      )
      .bind(
        candidate.delivery_key,
        candidate.window_hours,
        candidate.due_at,
        startedAt,
        leaseUntil,
        claim,
        maxAttempts,
      )
      .first<{ attempts: number }>();
    if (row) claimed.push({ ...candidate, claim, attempts: row.attempts });
  }

  if (!claimed.length) return { observed: 0, failed: 0 };
  const valid = claimed.filter(
    ({ account_did, rkey, provider_uri, provider_cid }) =>
      isBlueskyDid(account_did) &&
      /^[a-zA-Z0-9._:~-]{1,512}$/.test(rkey) &&
      provider_uri === `at://${account_did}/app.bsky.feed.post/${rkey}` &&
      /^[a-zA-Z0-9]{8,256}$/.test(provider_cid),
  );
  const posts = valid.length
    ? await readAppView(valid, fetcher).catch(() => null)
    : [];
  const finished = clock();
  const finishedAt = finished.toISOString();
  const results = claimed.map((record) => ({
    record,
    outcome: !valid.includes(record)
      ? { failure: "revision_changed" as const }
      : posts
        ? matchResult(record, posts)
        : { failure: "appview_unavailable" as const },
  }));

  await db.batch(
    results.map(({ record, outcome }) => {
      if ("counters" in outcome) {
        const { likes, replies, reposts, quotes } = outcome.counters;
        return db
          .prepare(
            `UPDATE creator_share_bluesky_observations SET observed_at=?1,likes=?2,replies=?3,
         reposts=?4,quotes=?5,claim=NULL,lease_until=NULL,retry_at=NULL
         WHERE delivery_key=?6 AND window_hours=?7 AND claim=?8`,
          )
          .bind(
            finishedAt,
            likes,
            replies,
            reposts,
            quotes,
            record.delivery_key,
            record.window_hours,
            record.claim,
          );
      }
      const retryAt = new Date(
        finished.getTime() + (nextRetryDelay[record.attempts - 1] ?? 0),
      );
      const canRetry =
        outcome.failure !== "revision_changed" &&
        record.attempts < maxAttempts &&
        (record.window_hours === 0 ||
          retryAt.getTime() <
            Date.parse(record.due_at) + blueskyObservationGraceHours * hour);
      return db
        .prepare(
          `UPDATE creator_share_bluesky_observations SET last_failure=?1,failed_at=?2,
       retry_at=?3,claim=NULL,lease_until=NULL WHERE delivery_key=?4 AND window_hours=?5 AND claim=?6`,
        )
        .bind(
          outcome.failure,
          finishedAt,
          canRetry ? retryAt.toISOString() : null,
          record.delivery_key,
          record.window_hours,
          record.claim,
        );
    }),
  );

  return {
    observed: results.filter(({ outcome }) => "counters" in outcome).length,
    failed: results.filter(({ outcome }) => "failure" in outcome).length,
  };
}

export async function listBlueskyObservations(
  db: D1Database,
  workspaceId: string,
) {
  const { results } = await db
    .prepare(
      `SELECT d.item_id AS itemId,d.approval_revision AS approvalRevision,o.window_hours AS windowHours,
      o.due_at AS dueAt,o.attempted_at AS attemptedAt,o.retry_at AS retryAt,o.lease_until AS leaseUntil,
      o.observed_at AS observedAt,o.attempts,o.likes,o.replies,o.reposts,o.quotes,
      o.last_failure AS lastFailure,o.failed_at AS failedAt
     FROM creator_share_bluesky_observations o
     JOIN creator_share_deliveries d ON d.idempotency_key=o.delivery_key
     WHERE d.workspace_id=? AND d.state='published'
     ORDER BY o.attempted_at DESC,d.idempotency_key,o.window_hours LIMIT 800`,
    )
    .bind(workspaceId)
    .all<BlueskyObservation>();
  return blueskyObservationSchema.array().parse(results);
}
