// Public finite labels only; shared by the browser and server, with no runtime bindings.
export const resourceIds = [
  "change",
  "incident",
  "pipeline",
  "hook",
  "operating-kit",
] as const;
export const resourceActions = [
  "choice",
  "copy",
  "download",
  "example_open",
] as const;
export type ResourceId = (typeof resourceIds)[number];
export type ResourceAction = (typeof resourceActions)[number];

// Any QA parameter is an exclusion, including empty, repeated or invalid labels.
// Only bounded public labels may be forwarded through native navigation.
export function resourceTrafficExcluded(parameters: URLSearchParams) {
  return parameters.getAll("analytics").includes("off") || parameters.has("qa");
}
export function resourceQaLabel(parameters: URLSearchParams) {
  return parameters
    .getAll("qa")
    .find((value) => /^[A-Za-z0-9._-]{1,64}$/.test(value));
}

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
