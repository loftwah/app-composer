export interface FieldDraft<T extends Record<string, string>> {
  baseline: T;
  value: T;
  conflicts: string[];
}
// Refresh untouched fields, preserve authored changes and explicitly mark
// overlapping external edits before using a newer server CAS revision.
export function reconcileFields<T extends Record<string, string>>(
  draft: FieldDraft<T>,
  saved: T,
): FieldDraft<T> {
  const value = { ...saved };
  const conflicts: string[] = [];
  for (const key of Object.keys(draft.value)) {
    if (draft.value[key] !== draft.baseline[key]) {
      value[key as keyof T] = draft.value[key as keyof T];
      if (saved[key] !== draft.baseline[key] && saved[key] !== draft.value[key])
        conflicts.push(key);
    }
  }
  return {
    baseline: saved,
    value,
    conflicts: [
      ...new Set([
        ...draft.conflicts.filter((key) => value[key] !== saved[key]),
        ...conflicts,
      ]),
    ],
  };
}
