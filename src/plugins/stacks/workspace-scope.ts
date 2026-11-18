// The URL selects a view only. Server-side membership authorizes every request.
export function workspaceSelection(search: string): string | undefined {
  const values = new URLSearchParams(search).getAll("workspace");
  if (!values.length) return;
  if (values.length !== 1 || !/^[a-z0-9-]{6,64}$/.test(values[0]))
    throw Error(
      "Choose a workspace from Workspace access before opening its stacks.",
    );
  return values[0];
}

export function confirmWorkspace(
  expected: string | undefined,
  actual: string | undefined,
): string {
  if (!actual || (expected && actual !== expected))
    throw Error(
      "The server did not confirm the selected workspace. Keep your edits and reopen its stacks from Workspace access.",
    );
  return actual;
}

/**
 * Resolve which authorized stack a Creator stacks URL selects. The list comes
 * from the signed-in workspace read, so a requested stack that is absent there
 * is stale, foreign or no longer readable: refuse it rather than silently
 * opening another stack. With no explicit request, keep the editor's current
 * stack or open the workspace's first one as before.
 */
export function stackSelection(
  authorizedStackIds: readonly string[],
  options: { requested?: string | null; current?: string },
): { stackId: string | undefined; refused: boolean } {
  const { requested, current } = options;
  if (requested)
    return authorizedStackIds.includes(requested)
      ? { stackId: requested, refused: false }
      : { stackId: undefined, refused: true };
  if (current && authorizedStackIds.includes(current))
    return { stackId: current, refused: false };
  return { stackId: authorizedStackIds[0], refused: false };
}
