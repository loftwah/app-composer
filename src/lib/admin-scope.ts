// One scope grammar for native administration. The URL selects a view only;
// the server rechecks membership, account and environment for every request.
export const WORKSPACE_ID = /^[a-z0-9-]{6,64}$/;
export const ENVIRONMENT_ID = /^[a-z0-9-]{1,40}$/;
export const APP_ID = /^[a-z0-9-]{2,40}$/;

export interface ScopeSelection {
  workspace?: string;
  environment?: string;
  app?: string;
}
export interface ConfirmedScope {
  workspace: string;
  environment: string;
  app: string | null;
}
export type ScopeKey = keyof ScopeSelection;

const LABELS: Record<string, string> = { guestbook: "Guestbook" };

export function appLabel(id: string): string {
  return LABELS[id] ?? id;
}

function once(search: string, key: string, pattern: RegExp): string | undefined {
  const values = new URLSearchParams(search).getAll(key);
  if (!values.length) return;
  if (values.length !== 1 || !pattern.test(values[0]))
    throw Error(
      key === "workspace"
        ? "Choose one workspace from Workspace access before opening this screen."
        : key === "environment"
          ? "Choose one environment this workspace records. Duplicate or malformed values are refused."
          : "Choose one recorded app. Duplicate or malformed values are refused.",
    );
  return values[0];
}

// A repeated or malformed scope parameter is refused instead of guessed.
export function parseScopeSelection(search: string): ScopeSelection {
  return {
    workspace: once(search, "workspace", WORKSPACE_ID),
    environment: once(search, "environment", ENVIRONMENT_ID),
    app: once(search, "app", APP_ID),
  };
}

export function scopeQuery(scope: ConfirmedScope): string {
  const params = new URLSearchParams({
    workspace: scope.workspace,
    environment: scope.environment,
  });
  if (scope.app) params.set("app", scope.app);
  return params.toString();
}

// Drill-down links keep their record anchor and gain the exact scope.
export function withScope(href: string, scope: ConfirmedScope): string {
  const url = new URL(href, "https://composer.invalid");
  url.searchParams.set("workspace", scope.workspace);
  url.searchParams.set("environment", scope.environment);
  if (scope.app) url.searchParams.set("app", scope.app);
  else url.searchParams.delete("app");
  return url.pathname + "?" + url.searchParams.toString() + url.hash;
}

export function moveScope(
  scope: ConfirmedScope,
  key: ScopeKey,
  value: string,
): ConfirmedScope {
  return {
    workspace: key === "workspace" ? value : scope.workspace,
    environment: key === "environment" ? value : scope.environment,
    app:
      key === "app"
        ? value || null
        : key === "environment" || key === "workspace"
          ? null
          : scope.app,
  };
}

// The server always confirms the scope it actually read. A mismatch is an
// error state, never a silent substitution.
export function confirmScope(
  requested: ScopeSelection,
  confirmed: ConfirmedScope,
): ConfirmedScope {
  if (requested.workspace && requested.workspace !== confirmed.workspace)
    throw Error(
      "The server did not confirm the selected workspace. Refresh and choose it again from Workspace access.",
    );
  if (requested.environment && requested.environment !== confirmed.environment)
    throw Error(
      "The server did not confirm the selected environment. Refresh before reading these records.",
    );
  if (requested.app && requested.app !== confirmed.app)
    throw Error(
      "The server did not confirm the selected app. Refresh and choose a recorded app again.",
    );
  return confirmed;
}
