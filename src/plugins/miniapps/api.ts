import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { AppID } from "./types";
export async function call(
  app: AppID,
  action: string,
  fields: Record<string, unknown> = {},
) {
  const read =
    action === "snapshot" ||
    action === "preview" ||
    (action === "share-card" && fields.operation === "snapshot") ||
    (action === "profile-settings" && fields.operation === "export");
  const values = { app, action, ...fields };
  const route =
    "/_emdash/api/plugins/composer-miniapps/" +
    (read
      ? "read?" + new URLSearchParams(values as Record<string, string>)
      : "write");
  const response = await apiFetch(
    route,
    read
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
  );
  const data = await parseApiResponse<any>(
    response,
    "Composer could not complete this request. Refresh before retrying.",
  );
  if (!data?.ok)
    throw Object.assign(
      Error(data?.message || "The connected app is unavailable."),
      { code: data?.code },
    );
  return data;
}
