import { useEffect, useRef, useState } from "react";
import {
  blankTag,
  tagFields,
  tagValues,
  sameTag,
  tagKeys,
  TagFieldError,
  type TagValues,
  type TagCollection,
} from "../lib/miniapp-tag-fields.mjs";
export type TagDraft = {
  id: string | null;
  from: TagValues | null;
  value: TagValues;
  blocked?: "compare" | "ambiguous";
};
export const tagUnsaved = (draft: TagDraft | undefined) =>
  !!draft &&
  (!!draft.blocked || !sameTag(draft.value, draft.from ?? blankTag()));
type Props = {
  profileDraft?: boolean;
  collection: TagCollection | null;
  draft?: TagDraft;
  change: (draft?: TagDraft) => void;
  busy: boolean;
  save: (
    fields: Record<string, unknown>,
    failed?: (message: string, code?: string) => void,
  ) => Promise<boolean>;
};
export function Tags({
  collection,
  draft,
  change,
  busy,
  save,
  profileDraft = false,
}: Props) {
  const [status, setStatus] = useState(""),
    [preview, setPreview] = useState(false),
    form = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(!!draft),
    [referencesExpanded, setReferencesExpanded] = useState(
      !!(
        draft?.value.citationURL ||
        draft?.value.citationLabel ||
        draft?.value.relatedURL ||
        draft?.value.relatedLabel
      ),
    );
  const [editorOpen, setEditorOpen] = useState(!profileDraft || !!draft);
  const value = draft?.value ?? blankTag(),
    selected = draft?.id ?? null,
    current = collection?.items.find((item) => item.id === selected),
    dirty = tagUnsaved(draft),
    removed = !!selected && !!collection && !current,
    stale = !!selected && !!draft?.from && !sameTag(draft.from, current),
    blocked = !!draft?.blocked || stale || removed || !collection;
  const focus = (name: string) => {
    const control = form.current?.elements.namedItem(name);
    if (control instanceof HTMLElement) control.focus();
  };
  useEffect(() => {
    if (editorOpen) focus("label");
  }, [editorOpen, selected]);
  const choose = (item?: TagCollection["items"][number]) => {
    if (dirty || stale) {
      setStatus(
        "Save or discard the current edits before opening another tag.",
      );
      focus("label");
      return;
    }
    setExpanded(true);
    setEditorOpen(true);
    setReferencesExpanded(
      !!(
        item?.citationURL ||
        item?.citationLabel ||
        item?.relatedURL ||
        item?.relatedLabel
      ),
    );
    change(
      item
        ? { id: item.id, from: tagValues(item), value: tagValues(item) }
        : undefined,
    );
    setStatus("");
    setPreview(false);
    focus("label");
  };
  const edit = (patch: Partial<TagValues>) => {
    change({
      id: selected,
      from: draft?.from ?? (current ? tagValues(current) : null),
      value: { ...value, ...patch },
      ...(draft?.blocked ? { blocked: draft.blocked } : {}),
    });
    setStatus("");
    setPreview(false);
  };
  const action = async (fields: Record<string, unknown>, editing = false) => {
    if (!collection || busy) return;
    setStatus("Saving tag…");
    const success = await save(
      { ...fields, expectedRevision: collection.revision },
      (message, code) => {
        setStatus(message);
        if (code !== "INVALID")
          change({
            id: selected,
            from: draft?.from ?? (current ? tagValues(current) : null),
            value: { ...value },
            blocked: code === "CONFLICT" ? "compare" : "ambiguous",
          });
      },
    );
    if (success) {
      if (editing || fields.id === selected) {
        change();
        if (profileDraft) setEditorOpen(false);
      }
      setStatus(
        fields.operation === "create"
          ? profileDraft
            ? "Draft saved. Include it in the next profile publication when ready."
            : "Draft saved. Publish it from the list when ready."
          : fields.operation === "delete"
            ? "Tag removed."
            : "Tag saved.",
      );
      setPreview(false);
    }
  };
  let checked: TagValues | undefined,
    validation: { field: string; message: string } | undefined;
  try {
    checked = tagFields(value);
  } catch (error) {
    validation = {
      field: error instanceof TagFieldError ? error.field : "form",
      message:
        error instanceof Error
          ? error.message
          : "Check the tag fields before saving.",
    };
  }
  const showValidation = !!draft && (!sameTag(value, blankTag()) || !!selected),
    problem = (key: string) =>
      showValidation && validation?.field === key
        ? validation.message
        : undefined;
  const referenceProblem =
    showValidation &&
    validation &&
    ["citationURL", "citationLabel", "relatedURL", "relatedLabel"].includes(
      validation.field,
    )
      ? validation.message
      : undefined;
  const field = (
    key:
      "label" | "citationURL" | "citationLabel" | "relatedURL" | "relatedLabel",
    label: string,
    max: number,
    url = false,
  ) => (
    <>
      <label>
        {label}
        <input
          name={key}
          type={url ? "url" : "text"}
          pattern={url ? "https://.*" : undefined}
          maxLength={max}
          required={key === "label"}
          disabled={busy}
          value={value[key]}
          aria-invalid={!!problem(key)}
          aria-describedby={
            problem(key) ? "ca-tag-" + key + "-help" : undefined
          }
          onChange={(event) => edit({ [key]: event.target.value })}
        />
      </label>
      {problem(key) && (
        <p id={"ca-tag-" + key + "-help"} role="status">
          {problem(key)}
        </p>
      )}
    </>
  );
  if (!collection)
    return (
      <details
        className="ca-disclosure ca-tags"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>Tags &amp; context</summary>
        <p role="status">
          Saved tags need owner review or the connection is unavailable. Nothing
          was changed. Refresh apps to check again.
        </p>
        {draft && (
          <>
            <p>Your unsaved tag: {draft.value.label}</p>
            {tagKeys
              .filter((key) => key !== "label")
              .map((key) => (
                <p className="ca-retained-text" key={key}>
                  {draft.value[key]}
                </p>
              ))}
            <button type="button" disabled={busy} onClick={() => change()}>
              Discard retained tag edit
            </button>
          </>
        )}
      </details>
    );
  return (
    <details
      className="ca-disclosure ca-tags"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Tags &amp; context ({collection.items.length})</summary>
      <p className="ca-muted">
        Up to twelve short labels. Add an explanation, source or related work
        when it helps; plain tags stay simple.
      </p>
      {collection.items.length === 0 && (
        <p>No tags yet. Start with a short private draft.</p>
      )}
      {collection.items.map((item, index) => (
        <article className="ca-achievement-row" key={item.id}>
          <h3>{item.label}</h3>
          <p className="ca-muted">
            {profileDraft
              ? item.status === "published"
                ? "Included in next publication"
                : "Excluded from next publication"
              : item.status}
          </p>
          <div className="ca-actions">
            <button
              type="button"
              disabled={busy}
              aria-label={"Edit tag " + item.label}
              onClick={() => choose(item)}
            >
              Edit
            </button>
            {item.status !== "published" && (
              <button
                type="button"
                disabled={busy || blocked || (selected === item.id && dirty)}
                onClick={() =>
                  void action({
                    operation: "visibility",
                    id: item.id,
                    status: "published",
                  })
                }
              >
                {profileDraft ? "Include in next publication" : "Publish tag"}
              </button>
            )}
            {item.status !== "hidden" && (
              <button
                type="button"
                disabled={busy || blocked || (selected === item.id && dirty)}
                onClick={() =>
                  void action({
                    operation: "visibility",
                    id: item.id,
                    status: "hidden",
                  })
                }
              >
                {profileDraft ? "Exclude from next publication" : "Hide tag"}
              </button>
            )}
            {(["up", "down"] as const).map((direction) => (
              <button
                type="button"
                key={direction}
                disabled={
                  busy ||
                  blocked ||
                  (direction === "up"
                    ? index === 0
                    : index === collection.items.length - 1)
                }
                aria-label={"Move tag " + item.label + " " + direction}
                onClick={() => {
                  const ids = collection.items.map((item) => item.id),
                    next = direction === "up" ? index - 1 : index + 1;
                  [ids[index], ids[next]] = [ids[next], ids[index]];
                  void action({ operation: "reorder", ids });
                }}
              >
                Move {direction}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || blocked || (selected === item.id && dirty)}
              onClick={() => {
                if (confirm("Remove “" + item.label + "” from your tags?"))
                  void action({ operation: "delete", id: item.id });
              }}
            >
              Remove tag
            </button>
          </div>
        </article>
      ))}
      <button type="button" disabled={busy} onClick={() => choose()}>
        Add another tag
      </button>
      <div hidden={profileDraft && !editorOpen && !draft}>
        <form
          ref={form}
          className="ca-form ca-tag-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked || !checked) return;
            void action(
              selected
                ? { operation: "edit", item: { id: selected, ...checked } }
                : {
                    operation: "create",
                    item: { ...checked, status: "draft" },
                  },
              true,
            );
          }}
        >
          <h3>{selected ? "Edit tag" : "Add a tag"}</h3>
          {removed && (
            <p role="status">
              This tag was removed. Your text is kept here to copy; discard the
              edit to continue.
            </p>
          )}
          {field("label", "Tag label", 40)}
          <label>
            Explanation (optional)
            <textarea
              name="description"
              maxLength={240}
              rows={3}
              disabled={busy}
              value={value.description}
              aria-invalid={!!problem("description")}
              aria-describedby={
                problem("description") ? "ca-tag-description-help" : undefined
              }
              onChange={(event) => edit({ description: event.target.value })}
            />
          </label>
          {problem("description") && (
            <p id="ca-tag-description-help" role="status">
              {problem("description")}
            </p>
          )}
          <details
            className="ca-disclosure ca-tag-references"
            open={referencesExpanded}
            onToggle={(event) =>
              setReferencesExpanded(event.currentTarget.open)
            }
          >
            <summary>Source &amp; related work (optional)</summary>
            {field("citationURL", "Source URL", 2048, true)}
            {field("citationLabel", "Source link text", 100)}
            {field("relatedURL", "Related work URL", 2048, true)}
            {field("relatedLabel", "Related work link text", 100)}
            <p className="ca-muted">
              Use full HTTPS addresses without embedded credentials.
              Destinations are never fetched for a preview.
            </p>
          </details>
          {referenceProblem && (
            <p role="status" data-tag-reference-error>
              {referenceProblem} Open Source &amp; related work to correct it.
            </p>
          )}
          <label>
            Tag visibility
            <select
              name="status"
              disabled={busy || !selected}
              value={value.status}
              onChange={(event) =>
                edit({ status: event.target.value as TagValues["status"] })
              }
            >
              <option value="draft">Draft · private</option>
              <option value="published">
                {profileDraft
                  ? "Include in profile publication"
                  : "Published · public"}
              </option>
              <option value="hidden">Hidden · private</option>
            </select>
          </label>
          <p className="ca-muted">
            {!selected
              ? "New tags are saved as private drafts."
              : value.status === "published"
                ? profileDraft
                  ? "Saving includes these changes in your next profile publication."
                  : "Saving publishes these changes immediately."
                : "Draft and hidden tags stay out of your public profile."}
          </p>
          {(stale || draft?.blocked) && !removed && (
            <div className="ca-link-conflict">
              <p role="status">
                {!selected && draft?.blocked === "ambiguous"
                  ? "The draft save could not be confirmed. Check the saved list before adding it again. Your text remains here to copy; discard it before continuing."
                  : "Compare the saved tag before saving again. Your edits are kept here; nothing was resubmitted."}
              </p>
              {current && (
                <dl>
                  {tagKeys.map((key) => (
                    <div key={key}>
                      <dt>Saved {key}</dt>
                      <dd>{current[key] || "Not set"}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {(selected || draft?.blocked !== "ambiguous") && (
                <div className="ca-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      change(
                        current
                          ? {
                              id: current.id,
                              from: tagValues(current),
                              value: tagValues(current),
                            }
                          : undefined,
                      );
                      setStatus("Using the saved version.");
                      setPreview(false);
                      focus("label");
                    }}
                  >
                    Use saved version
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      change({
                        id: selected,
                        from: current ? tagValues(current) : null,
                        value,
                      });
                      setStatus(
                        "Your edits are kept. Check visibility before saving again.",
                      );
                      focus(selected ? "status" : "label");
                    }}
                  >
                    Keep my edits
                  </button>
                </div>
              )}
            </div>
          )}
          {showValidation &&
            validation &&
            !tagKeys.includes(validation.field as keyof TagValues) && (
              <p role="status">{validation.message}</p>
            )}
          <div className="ca-actions">
            <button
              type="submit"
              disabled={
                busy ||
                blocked ||
                !checked ||
                (!selected && collection.items.length >= 12)
              }
            >
              {selected
                ? value.status === "published"
                  ? profileDraft
                    ? "Save included changes"
                    : "Save published changes"
                  : "Save tag"
                : "Save draft"}
            </button>
            <button
              type="button"
              disabled={busy || !checked}
              onClick={() => {
                setPreview((open) => !open);
                setStatus("Preview does not save or fetch a destination.");
              }}
            >
              {preview ? "Close preview" : "Preview without saving"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                change(
                  current
                    ? {
                        id: current.id,
                        from: tagValues(current),
                        value: tagValues(current),
                      }
                    : undefined,
                );
                setPreview(false);
                setStatus("Edits discarded. The saved version is shown.");
                focus("label");
              }}
            >
              Discard edits
            </button>
          </div>
          <p role="status" aria-live="polite">
            {status}
          </p>
          {preview && checked && (
            <div className="ca-link-preview">
              <p className="ca-muted">Preview · not saved</p>
              <h3>{checked.label}</h3>
              {checked.description.trim() && (
                <p className="ca-retained-text">{checked.description}</p>
              )}
              {(
                [
                  [checked.citationURL, checked.citationLabel, "Source"],
                  [checked.relatedURL, checked.relatedLabel, "Related work"],
                ] as const
              )
                .filter(([url]) => url)
                .map(([url, label, prefix]) => (
                  <p key={prefix}>
                    {prefix}:{" "}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {label || new URL(url).hostname}
                    </a>
                  </p>
                ))}
            </div>
          )}
        </form>
      </div>
      {profileDraft && !editorOpen && !draft && (
        <p role="status" aria-live="polite">
          {status}
        </p>
      )}
    </details>
  );
}
