export type StacksLeadRole = "owner" | "editor" | "viewer";

export type StacksLeadStack = {
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  revision: number;
  publishedRevision: number | null;
};

export type StacksLeadInput = {
  /** The workspace and its creator/governed mode were both confirmed. */
  ready: boolean;
  lifecycle?: "creator" | "governed";
  role?: StacksLeadRole;
  stack?: StacksLeadStack;
  /** The saved revision the editor currently holds for this stack. */
  savedRevision?: number;
  dirty?: boolean;
  canCreate?: boolean;
  canSave?: boolean;
  canPublish?: boolean;
};

/** One existing state and its supported action. This selects presentation only;
 * it never saves, publishes, discards or creates a stack. */
export type StacksLead =
  | { kind: "governed" }
  | {
      kind: "read-only";
      reason: "viewer" | "no-create" | "archived";
      stack?: StacksLeadStack;
    }
  | { kind: "create" }
  | {
      kind: "unsaved";
      stack: StacksLeadStack;
      savedRevision: number;
      canSave: boolean;
    }
  | { kind: "draft"; stack: StacksLeadStack; canPublish: boolean }
  | { kind: "published"; stack: StacksLeadStack };

export function stacksLead(
  input: StacksLeadInput,
): StacksLead | undefined {
  if (!input.ready || !input.lifecycle) return undefined;
  if (input.lifecycle === "governed") return { kind: "governed" };
  if (input.role === "viewer")
    return { kind: "read-only", reason: "viewer", stack: input.stack };
  if (!input.stack)
    return input.canCreate
      ? { kind: "create" }
      : { kind: "read-only", reason: "no-create" };
  if (input.stack.status === "archived")
    return { kind: "read-only", reason: "archived", stack: input.stack };
  // An unsaved edit is always the next safe step, even on a published stack:
  // publishing or reloading first would discard or bypass the visible edits.
  if (input.dirty)
    return {
      kind: "unsaved",
      stack: input.stack,
      savedRevision: input.savedRevision ?? input.stack.revision,
      canSave: Boolean(input.canSave),
    };
  if (
    input.stack.status === "published" &&
    input.stack.publishedRevision !== null
  )
    return { kind: "published", stack: input.stack };
  return {
    kind: "draft",
    stack: input.stack,
    canPublish: Boolean(input.canPublish),
  };
}
