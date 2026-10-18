import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { decodeStackReply } from "./protocol";

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
  resource?: {
    id: string;
    configurationRevision: number;
    digest: string;
    source: string;
    path: string;
    shared: boolean;
  };
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
export interface StackExport {
  format: string;
  stack: string;
  revision: number;
  document: StackDocument;
  configuration: {
    instance: string;
    app: string;
    mode: string;
    shareOf: string | null;
    settings: Record<string, string>;
  }[];
  covers: Record<string, boolean>;
}
export interface StackImportSummary {
  name: string;
  instances: number;
  shared: number;
  configured: number;
  apps: string[];
  covers: Record<string, boolean>;
}
export interface ActivationEntry {
  instanceId: string;
  app: string;
  name: string;
  configurable: boolean;
  reason?: string;
  settings?: {
    key: string;
    label: string;
    value: string;
    overridden: boolean;
  }[];
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
    action === "configuration" ||
    action === "resources" ||
    action === "resourceContent" ||
    action === "resourceMedia";
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
  const data = await parseApiResponse<unknown>(
    response,
    "Composer could not complete this request. Your draft is still here; check the saved version before retrying.",
  );
  return decodeStackReply(action, data);
}
