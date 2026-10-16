import { useState } from "react";
import { appSettings } from "../../lib/app-settings.mjs";
import type { Item, LinkValues, LinkDraft, StyleDraft } from "./types";
export function LinkEditor({
  item,
  edit,
  onEdit,
  busy,
  save,
  removed = false,
}: {
  item: Item;
  edit?: LinkDraft;
  onEdit: (value?: LinkDraft) => void;
  busy: boolean;
  save: (
    fields: Record<string, unknown>,
    failed?: (message: string) => void,
  ) => Promise<boolean>;
  removed?: boolean;
}) {
  const current: LinkValues = {
    title: item.title ?? "",
    description: item.description ?? "",
    url: item.url ?? "",
    status: item.status,
  };
  const [status, setStatus] = useState(""),
    [preview, setPreview] = useState(false);
  const value = edit?.value ?? current;
  const same = (a: LinkValues, b: LinkValues) =>
    (["title", "description", "url", "status"] as const).every(
      (key) => a[key] === b[key],
    );
  const dirty = !same(value, current),
    stale = !!edit && !same(edit.from, current);
  const change = (patch: Partial<LinkValues>) => {
    setStatus("");
    onEdit({ from: edit?.from ?? current, value: { ...value, ...patch } });
  };
  let destination: string | undefined;
  try {
    const url = new URL(value.url);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.href.length <= 2048
    )
      destination = url.href;
  } catch {}
  const valid = !!value.title.trim() && !!destination;
  return (
    <details
      className="ca-disclosure ca-link-editor"
      open={removed ? true : undefined}
    >
      <summary>
        {removed ? "Retained edit of a removed link" : "Edit link"}
        {dirty && !removed && " · Unsaved changes"}
      </summary>
      <form
        className="ca-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (stale || removed) return;
          if (!valid) {
            setStatus(
              "Use a title and a full HTTPS address without embedded credentials.",
            );
            return;
          }
          setStatus("Saving link…");
          if (
            await save(
              { id: item.id, ...value, expected: edit?.from ?? current },
              setStatus,
            )
          ) {
            onEdit();
            setStatus("Link saved.");
          }
        }}
      >
        {removed && (
          <p role="status">
            This link was removed. Your unsaved text is retained here to copy.
          </p>
        )}
        <label>
          Link title
          <input
            name="title"
            value={value.title}
            disabled={busy}
            required
            maxLength={100}
            onChange={(event) => change({ title: event.target.value })}
          />
        </label>
        <label>
          Link description
          <textarea
            name="description"
            value={value.description}
            disabled={busy}
            maxLength={240}
            rows={3}
            onChange={(event) => change({ description: event.target.value })}
          />
        </label>
        <label>
          HTTPS destination
          <input
            name="url"
            type="url"
            pattern="https://.*"
            value={value.url}
            disabled={busy}
            required
            maxLength={2048}
            aria-invalid={!!value.url && !destination}
            aria-describedby={"link-url-" + item.id}
            onChange={(event) => change({ url: event.target.value })}
          />
        </label>
        <p id={"link-url-" + item.id} className="ca-muted">
          {value.url && !destination
            ? "Use a shorter HTTPS destination, up to 2,048 characters, without embedded credentials."
            : "A full HTTPS address, up to 2,048 characters."}
        </p>
        <label>
          Visibility
          <select
            name="status"
            value={value.status}
            disabled={busy || removed}
            onChange={(event) => change({ status: event.target.value })}
          >
            <option value="draft">Draft · private</option>
            <option value="published">Published · public</option>
            <option value="hidden">Hidden · private</option>
          </select>
        </label>
        {!removed && (
          <p className="ca-muted">
            {value.status === "published"
              ? "Saving updates the published link in both live views."
              : "Draft and hidden links stay out of the public collection."}{" "}
            Preview does not save or fetch the destination.
          </p>
        )}
        {stale && !removed && (
          <div className="ca-link-conflict">
            <p role="status">
              The saved link changed. Your edits are still here. Compare before
              choosing which version to save.
            </p>
            <dl>
              <dt>Saved title</dt>
              <dd>{current.title}</dd>
              <dt>Saved description</dt>
              <dd>{current.description || "No description"}</dd>
              <dt>Saved destination</dt>
              <dd>{current.url}</dd>
              <dt>Saved visibility</dt>
              <dd>{current.status}</dd>
            </dl>
            <div className="ca-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onEdit();
                  setStatus("Using the saved link.");
                }}
              >
                Use saved link
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onEdit({ from: current, value });
                  setStatus(
                    "Your edits are kept. Check the visibility before saving.",
                  );
                }}
              >
                Keep my edits
              </button>
            </div>
          </div>
        )}
        <div className="ca-actions">
          <button type="submit" disabled={busy || stale || removed || !dirty}>
            Save link
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => setPreview((open) => !open)}
          >
            {preview ? "Close preview" : "Preview without saving"}
          </button>
          {edit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onEdit();
                setStatus("Edit discarded.");
              }}
            >
              Discard edit
            </button>
          )}
        </div>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {preview && (
          <div className="ca-link-preview">
            <p className="ca-muted">
              Preview · {dirty || removed ? "not saved" : "saved link"}
            </p>
            {destination ? (
              <a href={destination} target="_blank" rel="noopener noreferrer">
                <strong>{value.title}</strong>
                {value.description && <span>{value.description}</span>}
                <small>{destination}</small>
              </a>
            ) : (
              <p>Enter a safe HTTPS destination to preview this link.</p>
            )}
          </div>
        )}
      </form>
    </details>
  );
}
export function LinkStyle({
  item,
  busy,
  save,
  edit,
  onEdit,
}: {
  item: Item;
  busy: boolean;
  save: (
    fields: Record<string, unknown>,
    failed?: (message: string) => void,
  ) => Promise<boolean>;
  edit?: StyleDraft;
  onEdit: (value?: StyleDraft) => void;
}) {
  const [status, setStatus] = useState("");
  const current = {
    icon: item.icon ?? "link",
    pinned: item.pinned ?? false,
    ...(appSettings.showcase.cardCollection ? { group: item.group ?? "" } : {}),
  };
  const value = edit?.value ?? current,
    stale =
      !!edit &&
      (edit.from.icon !== current.icon ||
        edit.from.pinned !== current.pinned ||
        edit.from.group !== current.group);
  const change = (patch: Partial<typeof current>) => {
    setStatus("");
    onEdit({ from: edit?.from ?? current, value: { ...value, ...patch } });
  };
  return (
    <form
      className="ca-link-style"
      onSubmit={async (event) => {
        event.preventDefault();
        if (stale) return;
        setStatus("Saving link style…");
        if (await save({ id: item.id, ...value }, setStatus)) {
          onEdit();
          setStatus("Link style saved.");
        }
      }}
    >
      <label>
        Link icon
        <select
          name="icon"
          disabled={busy}
          value={value.icon}
          onChange={(event) => change({ icon: event.target.value })}
        >
          {(appSettings.showcase.cardPresentation?.icons ?? ["link"]).map(
            (icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ),
          )}
        </select>
      </label>
      {appSettings.showcase.cardCollection && (
        <label>
          Link group
          <select
            name="group"
            disabled={busy}
            value={value.group ?? ""}
            onChange={(event) => change({ group: event.target.value })}
          >
            <option value="">Other links</option>
            {appSettings.showcase.cardCollection.groups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
        </label>
      )}
      <label className="ca-check">
        <input
          name="pinned"
          type="checkbox"
          disabled={busy}
          checked={value.pinned}
          onChange={(event) => change({ pinned: event.target.checked })}
        />
        {appSettings.showcase.cardCollection
          ? "Feature in the top eight"
          : "Pin before other links"}
      </label>
      <button disabled={busy || stale} type="submit">
        Save link style
      </button>
      {status && (
        <p role="status" aria-live="polite">
          {status}
        </p>
      )}
      {stale && (
        <>
          <p role="status">
            The saved style changed. Review the current saved style before
            editing again.
          </p>
          <button type="button" disabled={busy} onClick={() => onEdit()}>
            Use saved style
          </button>
        </>
      )}
    </form>
  );
}
