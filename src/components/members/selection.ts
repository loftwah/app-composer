// A URL selects a member view only. The server still checks every permission.
export function memberScopeBlocked(
  profileDirty: boolean,
  operationPending: boolean,
  appDrafts: Record<string, boolean>,
) {
  return (
    profileDirty || operationPending || Object.values(appDrafts).some(Boolean)
  );
}
export async function acceptInvitationPreservingScope(
  blocked: () => boolean,
  accept: () => Promise<void>,
  select: () => Promise<void>,
) {
  if (blocked())
    throw Error(
      "Finish or check the current work before accepting this workspace invitation.",
    );
  await accept();
  // Membership acceptance cannot discard work started during its network wait.
  if (blocked()) return false;
  await select();
  return true;
}
export function memberPageSelection(search: string) {
  const parameters = new URLSearchParams(search);
  const views = parameters.getAll("view"),
    workspaces = parameters.getAll("workspace");
  if (
    views.length > 1 ||
    (views.length === 1 && !["profile", "apps", "platform"].includes(views[0]))
  )
    throw Error("Choose one supported member view before continuing.");
  if (
    workspaces.length > 1 ||
    (workspaces.length === 1 && !/^[a-z0-9-]{6,64}$/.test(workspaces[0]))
  )
    throw Error(
      "Choose one valid workspace. This address cannot select ambiguous workspace access.",
    );
  return {
    view: (views[0] ?? "profile") as "profile" | "apps" | "platform",
    workspace: workspaces[0],
  };
}
