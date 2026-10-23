// A URL selects a member view only. The server still checks every permission.
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
