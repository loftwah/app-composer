import { useEffect, useState } from "react";
import { reconcileFields, type FieldDraft } from "./draft-fields";

export function useFields<T extends Record<string, string>>(saved: T) {
  const [draft, setDraft] = useState<FieldDraft<T>>({
    baseline: saved,
    value: saved,
    conflicts: [],
  });
  const savedJSON = JSON.stringify(saved);
  useEffect(() => {
    setDraft((previous) => reconcileFields(previous, saved));
  }, [savedJSON]);
  return {
    value: draft.value,
    edit: (value: T) => setDraft((previous) => ({ ...previous, value })),
    useSaved: () => setDraft({ baseline: saved, value: saved, conflicts: [] }),
    keepEdits: () =>
      setDraft((previous) => ({ ...previous, baseline: saved, conflicts: [] })),
    conflicts: draft.conflicts,
    dirty: Object.keys(draft.value).some(
      (key) => draft.value[key] !== saved[key],
    ),
    saved,
  };
}
