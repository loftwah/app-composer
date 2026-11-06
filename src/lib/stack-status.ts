// Plugin replies map a StackError code to HTTP once. The member plugin and Team
// Hub expose different routes but must not answer the same failure differently.
export function stackStatus(code: string | undefined): number {
  if (code === "FORBIDDEN") return 403;
  if (code === "CONFLICT") return 409;
  if (code === "UNAVAILABLE" || code === "UNQUALIFIED") return 503;
  return 400;
}
