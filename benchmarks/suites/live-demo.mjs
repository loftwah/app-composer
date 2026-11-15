// The live half of the proof: the deployed /demo pages must answer with the
// marker text the sandbox renders. A missing response is blocked, never a pass,
// so an offline machine cannot look like a working deployment.
const TIMEOUT_MS = 10000;

const TARGETS = [
  {
    id: "demo-home",
    name: "GET /demo",
    url: "https://composer.loftwah.com/demo",
    marker: "Build something people can use",
  },
  {
    id: "demo-connected-apps",
    name: "GET /demo/connected-apps",
    url: "https://composer.loftwah.com/demo/connected-apps",
    marker: "A guestbook and a showcase",
  },
];

export const id = "live-demo";
export const name = "Live /demo sandbox";

function describe(error) {
  if (!(error instanceof Error)) return String(error);
  const code = error.cause && typeof error.cause === "object" ? error.cause.code : undefined;
  return `${error.name}: ${error.message}${code ? ` (${code})` : ""}`;
}

async function probe(target) {
  const started = Date.now();
  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      headers: { "user-agent": "app-composer-benchmarks/1" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    const bytes = Buffer.byteLength(body);
    const elapsed = Date.now() - started;
    const found = body.includes(target.marker);
    return {
      id: target.id,
      name: target.name,
      status: response.ok && found ? "pass" : "fail",
      detail: found
        ? `HTTP ${response.status}, ${bytes} bytes, ${elapsed}ms; marker present: “${target.marker}”.`
        : `HTTP ${response.status}, ${bytes} bytes, ${elapsed}ms; marker missing: “${target.marker}”.`,
    };
  } catch (error) {
    return {
      id: target.id,
      name: target.name,
      status: "blocked",
      detail: `No HTTP status after ${Date.now() - started}ms (network, DNS or timeout): ${describe(error)}.`,
    };
  }
}

export async function run() {
  const checks = [];
  for (const target of TARGETS) checks.push(await probe(target));
  return checks;
}
