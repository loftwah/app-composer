import type {
  HTMLRewriter as WorkerHTMLRewriter,
  Response as WorkerResponse,
} from "@cloudflare/workers-types";
import reference from "../../config/creator-hub-reference.json" with { type: "json" };

export const postcardJourney = {
  format: "composer.journey-observation/v1",
  definition: "creator-hub.postcard-form/v1",
  site: "creator-hub",
  app: "guestbook",
  environment: "production",
  url: reference.apps.guestbook.origin + "/contribute",
  method: "synthetic-http-get",
} as const;

const outcomes = {
  "form-present": {
    outcome: "passed",
    label: "Postcard form served",
    next: "Open the public form to inspect it in a browser.",
  },
  "form-missing": {
    outcome: "failed",
    label: "Postcard form missing from the page",
    next: "Check that guest postcards are enabled, then open the public form.",
  },
  "route-failed": {
    outcome: "failed",
    label: "Postcard page returned an error",
    next: "Open the public form and check the Guestbook deployment.",
  },
  "response-unverified": {
    outcome: "unavailable",
    label: "Could not verify the postcard form",
    next: "Open the public form in a browser and run the check again.",
  },
} as const;

type Reason = keyof typeof outcomes;

export type PostcardObservation = typeof postcardJourney & {
  checkedAt: string;
  reason: Reason;
} & (typeof outcomes)[Reason];

function observation(reason: Reason, checkedAt: string): PostcardObservation {
  return {
    ...postcardJourney,
    checkedAt,
    reason,
    ...outcomes[reason],
  };
}

// Check the exact fixed scope before making the downloadable derivative. No
// page contents, credential-bearing fields or extra metadata are copied.
export function readPostcardObservation(value: unknown): PostcardObservation {
  if (!value || typeof value !== "object")
    throw Error("The postcard check returned no observation.");
  const raw = value as Record<string, unknown>;
  const { reason, checkedAt } = raw;
  if (
    !Object.entries(postcardJourney).every(
      ([key, expected]) => raw[key] === expected,
    ) ||
    typeof reason !== "string" ||
    !Object.hasOwn(outcomes, reason) ||
    typeof checkedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(checkedAt) ||
    !Number.isFinite(Date.parse(checkedAt)) ||
    new Date(checkedAt).toISOString() !== checkedAt ||
    raw.outcome !== outcomes[reason as Reason].outcome
  )
    throw Error("The postcard check returned an unconfirmed observation.");
  return observation(reason as Reason, checkedAt);
}

async function inspectForm(body: ReadableStream<Uint8Array>): Promise<boolean> {
  const Rewriter = (
    globalThis as unknown as { HTMLRewriter: typeof WorkerHTMLRewriter }
  ).HTMLRewriter;
  const form =
    'form#guest-postcard[method="post"][action="/api/guest-postcard"]';
  const fields = new Set<string>();
  const required = [
    'input[name="code"][required]',
    'textarea[name="caption"][required]',
    'input[type="checkbox"][name="consent"][required]',
    "button",
  ];
  const rewriter = new Rewriter();
  for (const field of required) {
    rewriter.on(form + " " + field, {
      element() {
        fields.add(field);
      },
    });
  }
  let bytes = 0;
  const limited = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.length;
        if (bytes > 128 * 1024)
          throw Error("Postcard response exceeds the check limit.");
        controller.enqueue(chunk);
      },
    }),
  );
  const scanned = rewriter.transform(
    new Response(limited) as unknown as WorkerResponse,
  ) as unknown as Response;
  await scanned.body!.pipeTo(new WritableStream());
  return fields.size === required.length;
}

export async function checkPostcardJourney(
  request: typeof fetch = fetch,
): Promise<PostcardObservation> {
  let reason: Reason = "response-unverified";
  try {
    const response = await request(postcardJourney.url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (App Composer verification)" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.headers.get("cf-mitigated") === "challenge") {
      await response.body?.cancel();
    } else if (
      response.status === 404 ||
      response.status === 410 ||
      response.status >= 500
    ) {
      reason = "route-failed";
      await response.body?.cancel();
    } else if (
      response.status === 200 &&
      response.body &&
      response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() === "text/html"
    ) {
      reason = (await inspectForm(response.body))
        ? "form-present"
        : "form-missing";
    } else {
      await response.body?.cancel();
    }
  } catch {
    // A blocked or incomplete probe is an unavailable observation.
  }
  return observation(reason, new Date().toISOString());
}
