import reference from "../../config/creator-hub-reference.json" with { type: "json" };

const cacheMs = 60_000;
const revisionPattern = /^[a-f0-9]{40}$/;
type App = keyof typeof reference.apps;
type Observation = {
  checkedAt: number;
  revisions: Record<App, string | null>;
};

let latest: Observation | undefined;

async function readRevision(app: App, request: typeof fetch) {
  try {
    const response = await request(new URL("/build.json", reference.apps[app].origin), {
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0 (App Composer case study)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const identity = await response.json() as { app?: unknown; revision?: unknown };
    return identity?.app === app &&
      typeof identity.revision === "string" &&
      revisionPattern.test(identity.revision)
      ? identity.revision
      : null;
  } catch {
    return null;
  }
}

export async function readCreatorHubRelease(request = fetch, now = Date.now) {
  const checkedAt = now();
  if (latest && checkedAt - latest.checkedAt < cacheMs) return latest;

  const [showcase, guestbook] = await Promise.all([
    readRevision("showcase", request),
    readRevision("guestbook", request),
  ]);
  const observation = { checkedAt, revisions: { showcase, guestbook } };

  // Share completed data only. Each Worker request owns its fetch operations.
  if (!latest || latest.checkedAt <= checkedAt) latest = observation;
  return latest;
}
