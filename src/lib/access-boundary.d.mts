import type { D1Database } from "@cloudflare/workers-types";
export interface AccessRuntime {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUDIENCE?: string;
  CF_ACCESS_SUBJECT_BINDING?: string;
  DB?: D1Database;
}
export function protectAdministration(
  request: Request,
  runtime: AccessRuntime,
): Promise<Response | null>;

export function protectResolvedAdministration(
  request: Request,
  user: { id: string; email: string; role: number } | null | undefined,
  runtime: AccessRuntime,
  session?: { delete(key: string): void },
): Promise<Response | null>;
