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
      if (!selected?.shared || !selected.configuration) return instance;
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

// Reconciliation first observes the saved token: an interrupted write can have
// committed without reaching the editor. This read never adopts server fields.
export function observeResourceRevision(
  session: EditorSession,
  checkpoint: EditCheckpoint,
  saved: Stack,
  local: StackDocument | undefined,
): boolean {
  if (
    saved.id !== checkpoint.stack ||
    (!session.acknowledgeUnchanged(checkpoint, saved.revision) &&
      !session.acknowledge(checkpoint, saved.revision))
  ) return false;
  if (!session.dirty && JSON.stringify(local) !== JSON.stringify(saved.draft))
    session.edit();
  return true;
}
