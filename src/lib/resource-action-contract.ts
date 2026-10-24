// Public finite labels only; shared by the browser and server, with no runtime bindings.
export const resourceIds = [
  "change",
  "incident",
  "pipeline",
  "hook",
  "kit",
] as const;
export const resourceActions = [
  "choice",
  "copy",
  "download",
  "example_open",
] as const;
export type ResourceId = (typeof resourceIds)[number];
export type ResourceAction = (typeof resourceActions)[number];

export function resourceActionPayload(resource: unknown, action: unknown) {
  if (
    !resourceIds.includes(resource as ResourceId) ||
    !resourceActions.includes(action as ResourceAction)
  )
    return null;
  return {
    contract: 1,
    resource: resource as ResourceId,
    action: action as ResourceAction,
  };
}
