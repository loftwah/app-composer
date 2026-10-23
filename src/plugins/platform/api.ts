import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { confirmWorkspace } from "../stacks/workspace-scope";
import { decodePlatformList, decodePlatformMutation } from "./protocol";

const base = "/_emdash/api/plugins/composer-stacks/";
export async function readPlatform(workspace?: string) {
  const query = new URLSearchParams({
    action: "list",
    ...(workspace ? { workspace } : {}),
  });
  const response = await apiFetch(base + "platformRead?" + query, {
    cache: "no-store",
  });
  const value = decodePlatformList(
    await parseApiResponse<unknown>(
      response,
      "The platform could not be loaded. Your entries are still here; try Refresh.",
    ),
  );
  confirmWorkspace(workspace, value.workspace.id);
  return value;
}
export async function writePlatform(
  action:
    | "configure"
    | "submit"
    | "review"
    | "run"
    | "revise"
    | "update"
    | "reconcile",
  workspace: string,
  fields: Record<string, unknown>,
) {
  const response = await apiFetch(base + "platformWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, action, workspace }),
  });
  const value = decodePlatformMutation(
    await parseApiResponse<unknown>(
      response,
      "The operation could not be confirmed. Refresh requests before retrying; your entries are still here.",
    ),
  );
  if (value.workspace) confirmWorkspace(workspace, value.workspace.id);
  return value;
}
