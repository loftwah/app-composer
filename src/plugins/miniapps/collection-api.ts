import { z } from "zod";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  collectionSourcesReply,
  collectionItemsReply,
  collectionReceipt,
} from "../../lib/miniapp-collection-contract";

export type CollectionAction =
  | "collection-sources"
  | "collection-items"
  | "collection-check"
  | "feature-resource";
export type CollectionRequest = (
  action: CollectionAction,
  fields?: Record<string, unknown>,
) => Promise<unknown>;
export const callCollection: CollectionRequest = async (
  action,
  fields = {},
) => {
  const reading = action !== "feature-resource",
    values = { app: "showcase", action, ...fields };
  const query = new URLSearchParams(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-miniapps/" +
      (reading ? "read?" + query : "write"),
    reading
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
  );
  const data = await parseApiResponse<unknown>(
    response,
    "The collection response could not be confirmed. Keep this selection and check its saved reference.",
  );
  const failure = z
    .object({
      ok: z.literal(false),
      code: z.enum([
        "INVALID",
        "FORBIDDEN",
        "CONFLICT",
        "SOURCE",
        "UNSUPPORTED",
        "UNAVAILABLE",
        "NOT_FOUND",
      ]),
      message: z.string().min(1).max(500),
    })
    .safeParse(data);
  if (failure.success)
    throw Object.assign(Error(failure.data.message), {
      code: failure.data.code,
    });
  return (
    action === "collection-sources"
      ? collectionSourcesReply
      : action === "collection-items"
        ? collectionItemsReply
        : collectionReceipt
  ).parse(data);
};
