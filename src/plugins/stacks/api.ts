import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

export type Role = "owner" | "editor" | "viewer";
export interface Workspace {
  id: string;
  name: string;
  role: Role;
}
export interface StackBinding {
  mode: "own" | "shared";
  shareOf: string | null;
}
export interface StackInstance {
  id: string;
  app: string;
  label: string;
  caption: string;
  visible: boolean;
  binding: StackBinding;
  config: Record<string, string>;
}
export interface StackDocument {
  version: number;
  name: string;
  description: string;
  theme: string;
  instances: StackInstance[];
}
export interface Stack {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  revision: number;
  publishedRevision: number | null;
  updatedAt: string;
  publishedAt: string | null;
  draft: StackDocument;
  published: StackDocument | null;
}
export interface StackPublication {
  revision: number;
  publishedAt: string;
  document: StackDocument | null;
}
export interface DeclaredField {
  key: string;
  label: string;
  type: string;
  default: string;
  maxLength: number | null;
  options: string[] | null;
}
export interface InstanceConfiguration {
  app: string;
  name: string;
  mode: "own" | "shared";
  shareOf: string | null;
  declared: DeclaredField[];
  capabilities: string[];
  config: Record<string, string>;
  source: Record<string, string> | null;
}
export interface ActivationEntry {
  instanceId: string;
  app: string;
  name: string;
  configurable: boolean;
  reason?: string;
  settings?: { key: string; label: string; value: string; overridden: boolean }[];
}

// One call shape for reads and writes, matching the other native plugin pages.
export async function call(
  action: string,
  fields: Record<string, unknown> = {},
) {
  const read =
    action === "list" ||
    action === "open" ||
    action === "export" ||
    action === "publications" ||
    action === "configuration";
  const values = { action, ...fields };
  const route =
    "/_emdash/api/plugins/composer-stacks/" +
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
  const data = await parseApiResponse<{
    ok: boolean;
    code?: string;
    message?: string;
    workspace?: Workspace;
    stacks?: Stack[];
    stack?: Stack;
    deleted?: { id: string; name: string; slug?: string; removedPublications?: boolean };
    publications?: StackPublication[];
    instances?: InstanceConfiguration[];
    configuration?: { entries: ActivationEntry[]; shared: { instanceId: string; app: string; name: string; shareOf: string | null }[] };
  }>(response, "Composer could not complete this request. Refresh before retrying.");
  if (!data?.ok)
    throw Object.assign(
      Error(data?.message || "The creator workspace is unavailable."),
      { code: data?.code },
    );
  return data;
}
