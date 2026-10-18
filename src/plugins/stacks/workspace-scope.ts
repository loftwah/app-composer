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
