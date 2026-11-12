// Bounded, read-only aggregator discovery for the scheduled Plugin Trust watch.
// Only the two fixed GET methods are reachable; there is no credential, no
// redirect following, no unbounded body and no caller-supplied URL.
import type { Discovery } from "./plugin-trust-refresh.ts";

const aggregator = "https://registry.emdashcms.com";
const maximumBytes = 512 * 1024;
const timeoutMs = 10000;

async function boundedText(response: Response) {
  if (!response.ok || !response.body) throw Error("Discovery unavailable");
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maximumBytes)
    throw Error("Discovery response too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      length += value.byteLength;
      if (length > maximumBytes) throw Error("Discovery response too large");
      chunks.push(value);
    }
  } finally {
    if (!complete) void reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function xrpc(
  method: string,
  params: Record<string, string>,
  fetcher: typeof fetch,
) {
  const url = new URL("/xrpc/com.emdashcms.experimental.aggregator." + method, aggregator);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const response = await fetcher(url, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await boundedText(response);
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw Error("Discovery response is not an object");
  return parsed as Record<string, unknown>;
}

export function workerDiscovery(fetcher: typeof fetch = fetch): Discovery {
  return {
    async getPackage({ did, slug }) {
      const value = await xrpc("getPackage", { did, slug }, fetcher);
      return {
        did: String(value.did ?? ""),
        slug: String(value.slug ?? ""),
        handle: typeof value.handle === "string" ? value.handle : null,
        cid: String(value.cid ?? ""),
        uri: String(value.uri ?? ""),
        profile:
          value.profile && typeof value.profile === "object"
            ? (value.profile as Record<string, unknown>)
            : null,
        releaseHistoryComplete: value.releaseHistoryComplete === true,
      };
    },
    async getLatestRelease({ did, package: slug }) {
      const value = await xrpc(
        "getLatestRelease",
        { did, package: slug },
        fetcher,
      );
      return {
        did: String(value.did ?? ""),
        package: String(value.package ?? ""),
        cid: String(value.cid ?? ""),
        uri: String(value.uri ?? ""),
        version: String(value.version ?? ""),
        indexedAt:
          typeof value.indexedAt === "string" ? value.indexedAt : undefined,
        release:
          value.release && typeof value.release === "object"
            ? (value.release as Record<string, unknown>)
            : null,
        labels: Array.isArray(value.labels) ? value.labels : [],
      };
    },
  };
}
