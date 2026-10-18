// This is the existing EmDash contributor permission, not a new global grant.
// The native route still resolves membership and checks the workspace capability.
export const creatorPermission = "content:read_drafts" as const;

export function isCreatorRole(role: unknown): role is 20 | 30 | 40 | 50 {
  return role === 20 || role === 30 || role === 40 || role === 50;
}
