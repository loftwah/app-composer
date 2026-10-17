import type { Stack, StackDocument } from "./api";
import type { EditorSession, EditCheckpoint } from "./editor-session";
import type { ResourceBinding } from "./protocol";

export function resourcePreview(
  document: StackDocument,
  resources: ResourceBinding[],
): StackDocument {
  return {
    ...document,
    instances: document.instances.map((instance) => {
      const selected = resources.find((entry) => entry.instance === instance.id);
      if (instance.binding.mode === "shared" || !selected?.shared || !selected.configuration)
        return instance;
      const configuration = selected.configuration;
      return {
        ...instance,
        config: { ...configuration.values },
        resource: {
          id: selected.resource,
          configurationRevision: configuration.revision,
          digest: configuration.digest,
          source: configuration.source,
          path: configuration.path,
          shared: true,
        },
      };
    }),
  };
}

// Shared configuration comes from the app-confirmed binding. Projection keeps
// all other locally authored fields and never grants resource authority.
export function resourceDraft(
  document: StackDocument,
  resources: ResourceBinding[],
): StackDocument {
  return {
    ...document,
    instances: document.instances.map((instance) => {
      const selected = resources.find((entry) => entry.instance === instance.id);
      if (instance.binding.mode === "shared" || !selected?.shared || !selected.configuration)
        return instance;
      return { ...instance, config: { ...selected.configuration.values } };
    }),
  };
}

export function resourceEditsDuringReuse(
  local: StackDocument,
  submitted: StackDocument,
  resources: ResourceBinding[],
) {
  return local.instances.flatMap((instance) => {
    const selected = resources.find((entry) => entry.instance === instance.id);
    const before = submitted.instances.find((entry) => entry.id === instance.id);
    if (!selected?.shared || !selected.configuration || !before ||
        JSON.stringify(instance.config) === JSON.stringify(before.config) ||
        JSON.stringify(instance.config) === JSON.stringify(selected.configuration.values))
      return [];
    return [{ instance: instance.id, config: { ...instance.config } }];
  });
}

// Reconciliation first observes the saved token: an interrupted write can have
// committed without reaching the editor. This read never adopts server fields.
export function observeResourceRevision(
  session: EditorSession,
  checkpoint: EditCheckpoint,
  saved: Stack,
  acknowledged: StackDocument,
): boolean {
  if (
    saved.id !== checkpoint.stack ||
    JSON.stringify(saved.draft) !== JSON.stringify(acknowledged) ||
    (!session.acknowledgeUnchanged(checkpoint, saved.revision) &&
      !session.acknowledge(checkpoint, saved.revision))
  ) return false;
  return true;
}
