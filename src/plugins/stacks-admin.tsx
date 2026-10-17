import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PluginAdminExports } from "emdash";
import { call, type Role, type Stack, type StackDocument, type Workspace } from "./stacks/api";
import "./stacks-admin.css";

// The reviewed apps a stack can reference. Keep in step with src/lib/stacks.mjs.
const APPS: { id: string; name: string; purpose: string }[] = [
  { id: "guestbook", name: "Here / there", purpose: "Collect photos and messages with owner review." },
  { id: "showcase", name: "Linkarooie", purpose: "Curate links and approved photos into one page." },
  { id: "linkcheck", name: "Link Check", purpose: "Inspect a page's icons, sharing and search metadata." },
  { id: "hello", name: "Hello World", purpose: "Prove a first deployment over HTTPS." },
  { id: "state", name: "Carry / forward", purpose: "Fictional portable assistant memory." },
];
const ROLE_COPY: Record<Role, string> = {
  owner: "Owner — full control, including deleting a stack.",
  editor: "Editor — create, configure, publish and duplicate.",
  viewer: "Viewer — read and export only.",
};
const newInstance = (app: string) => ({
  id: crypto.randomUUID(),
  app,
  label: APPS.find(entry => entry.id === app)?.name ?? app,
  caption: "",
  visible: true,
});

function StudioPage() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selected, setSelected] = useState<string>();
  const [document, setDocument] = useState<StackDocument>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const revision = useRef(0);

  const current = useMemo(() => stacks.find(stack => stack.id === selected), [stacks, selected]);

  const load = useCallback(
    async (keepSelection?: string) => {
      const data = await call("list");
      setWorkspace(data.workspace);
      setStacks(data.stacks ?? []);
      const next = keepSelection ?? selected ?? data.stacks?.[0]?.id;
      if (next) {
        const stack = data.stacks?.find(entry => entry.id === next) ?? data.stacks?.[0];
        if (stack) {
          setSelected(stack.id);
          setDocument(structuredClone(stack.draft));
          revision.current = stack.revision;
          setDirty(false);
        }
      } else {
        setSelected(undefined);
        setDocument(undefined);
      }
    },
    [selected],
  );

  useEffect(() => {
    let live = true;
    load()
      .catch(cause => {
        if (live) setError(cause instanceof Error ? cause.message : "The workspace could not be loaded.");
      })
      .finally(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const note = await work();
      setMessage(note);
    } catch (cause: any) {
      setError(cause?.message || "The action did not complete.");
    } finally {
      setBusy(false);
    }
  };

  const openStack = async (id: string) => {
    if (dirty && !confirm("This stack has unsaved edits. Open another stack and lose them?")) return;
    setBusy(true);
    setError("");
    try {
      const data = await call("open", { stack: id });
      if (data.stack) {
        setSelected(data.stack.id);
        setDocument(structuredClone(data.stack.draft));
        revision.current = data.stack.revision;
        setDirty(false);
        setMessage(`Opened ${data.stack.name} at revision ${data.stack.revision}.`);
      }
    } catch (cause: any) {
      setError(cause?.message || "That stack could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const update = (patch: Partial<StackDocument>) => {
    setDocument(current => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setMessage("");
  };
  const updateInstance = (id: string, patch: Partial<StackDocument["instances"][number]>) => {
    if (!document) return;
    update({ instances: document.instances.map(instance => (instance.id === id ? { ...instance, ...patch } : instance)) });
  };
  const move = (index: number, delta: number) => {
    if (!document) return;
    const next = [...document.instances];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ instances: next });
  };

  const create = () =>
    run(async () => {
      const data = await call("create", { name: newName });
      setNewName("");
      await load(data.stack?.id);
      return `Created ${data.stack?.name}. It starts as a draft at /s/${data.stack?.slug}.`;
    });

  const save = () =>
    run(async () => {
      if (!document || !current) throw Error("Open a stack first.");
      const data = await call("save", { stack: current.id, document, expectedRevision: revision.current });
      if (data.stack) {
        setStacks(stacks => stacks.map(entry => (entry.id === data.stack!.id ? data.stack! : entry)));
        revision.current = data.stack.revision;
        setDirty(false);
        return `Saved draft revision ${data.stack.revision}.`;
      }
      return "Saved.";
    });

  const publish = () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const saved = document && dirty
        ? await call("save", { stack: current.id, document, expectedRevision: revision.current })
        : undefined;
      if (saved?.stack) revision.current = saved.stack.revision;
      const data = await call("publish", { stack: current.id, expectedRevision: revision.current });
      if (data.stack) {
        setStacks(stacks => stacks.map(entry => (entry.id === data.stack!.id ? data.stack! : entry)));
        revision.current = data.stack.revision;
        setDirty(false);
      }
      return `Published revision ${data.stack?.publishedRevision}. Public at /s/${current.slug}.`;
    });

  const simple = (action: string, note: (data: any) => string) => () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const data = await call(action, { stack: current.id });
      await load(action === "delete" ? undefined : current.id);
      return note(data);
    });

  const exportDocument = () => {
    if (!document || !current) return;
    const blob = new Blob([JSON.stringify({ stack: current.slug, revision: revision.current, document }, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = current.slug + ".stack.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${current.slug}.stack.json. It contains configuration only — no app records, media or credentials.`);
  };

  const copyShare = async () => {
    if (!current) return;
    const url = new URL("/s/" + current.slug, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Copied ${url}.`);
    } catch {
      setMessage(`Share address: ${url}`);
    }
  };

  const shareUrl = current ? `/s/${current.slug}` : "";

  return (
    <section className="composer-admin ca-stacks">
      <div className="ca-heading">
        <div>
          <h1>Creator stacks</h1>
          <p>
            Save a named composition of reviewed mini-apps, keep it as a draft,
            preview it and publish one shareable page. The apps keep their own
            records and media.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void load()}>
          Refresh workspace
        </button>
      </div>
      {workspace && (
        <p className="ca-muted">
          Workspace <strong>{workspace.name}</strong> · {ROLE_COPY[workspace.role]}
        </p>
      )}
      <p role="status" aria-live="polite" className="ca-message">
        {message}
      </p>
      {error && (
        <div role="alert" className="ca-stack-error">
          <p>{error}</p>
        </div>
      )}
      <div className="ca-workspace">
        <div className="ca-main">
          <div className="ca-stack-create">
            <label>
              New stack name
              <input value={newName} maxLength={80} onChange={event => setNewName(event.target.value)} placeholder="Loftwah front page" />
            </label>
            <button type="button" disabled={busy || !newName.trim()} onClick={() => void create()}>
              Create stack
            </button>
          </div>
          {!document && <p className="ca-muted">No stack yet. Name one above to start.</p>}
          {document && current && (
            <>
              <div className="ca-stack-state">
                <span className={`ca-status ca-status-${current.status}`}>{current.status}</span>
                <span className="ca-muted">
                  Draft revision {revision.current}
                  {current.publishedRevision ? ` · published revision ${current.publishedRevision}` : " · not published"}
                  {dirty ? " · unsaved edits" : ""}
                </span>
              </div>
              <div className="ca-form ca-stack-form">
                <label>
                  Name
                  <input value={document.name} maxLength={80} onChange={event => update({ name: event.target.value })} />
                </label>
                <label>
                  Description
                  <textarea rows={2} maxLength={240} value={document.description} onChange={event => update({ description: event.target.value })} />
                </label>
                <label>
                  Theme
                  <select value={document.theme} onChange={event => update({ theme: event.target.value })}>
                    <option value="midnight">Midnight</option>
                    <option value="daylight">Daylight</option>
                  </select>
                </label>
              </div>
              <h2>App instances</h2>
              <p className="ca-muted">
                Up to {12} instances. Two instances of the same app keep separate labels and captions;
                the app itself keeps one set of records.
              </p>
              {document.instances.map((instance, index) => (
                <div className="ca-card-row ca-stack-instance" key={instance.id}>
                  <div>
                    <h3>{APPS.find(entry => entry.id === instance.app)?.name ?? instance.app}</h3>
                    <label>
                      Label
                      <input value={instance.label} maxLength={60} onChange={event => updateInstance(instance.id, { label: event.target.value })} />
                    </label>
                    <label>
                      Caption
                      <input value={instance.caption} maxLength={200} onChange={event => updateInstance(instance.id, { caption: event.target.value })} />
                    </label>
                    <label className="ca-check">
                      <input type="checkbox" checked={instance.visible} onChange={event => updateInstance(instance.id, { visible: event.target.checked })} /> Visible on the published page
                    </label>
                  </div>
                  <div className="ca-actions">
                    <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)}>Move up</button>
                    <button type="button" disabled={busy || index === document.instances.length - 1} onClick={() => move(index, 1)}>Move down</button>
                    <button type="button" disabled={busy} onClick={() => update({ instances: document.instances.filter(entry => entry.id !== instance.id) })}>Remove</button>
                  </div>
                </div>
              ))}
              <div className="ca-stack-add">
                {APPS.map(app => (
                  <button
                    key={app.id}
                    type="button"
                    disabled={busy || document.instances.length >= 12 || document.instances.some(entry => entry.app === app.id)}
                    title={document.instances.some(entry => entry.app === app.id) ? "Already in this stack" : app.purpose}
                    onClick={() => update({ instances: [...document.instances, newInstance(app.id)] })}
                  >
                    Add {app.name}
                  </button>
                ))}
              </div>
              <div className="ca-stack-actions">
                <button type="button" disabled={busy || !dirty} onClick={() => void save()}>Save draft</button>
                <button type="button" disabled={busy} onClick={() => void publish()}>Publish</button>
                {current.status === "published" && (
                  <button type="button" disabled={busy} onClick={simple("unpublish", () => "Unpublished. The public address now returns 404 until you publish again.")}>
                    Unpublish
                  </button>
                )}
                <button type="button" disabled={busy} onClick={simple("duplicate", data => `Duplicated as ${data.stack?.name}.`)}>Duplicate</button>
                <button type="button" disabled={busy} onClick={exportDocument}>Export JSON</button>
                {current.status !== "archived" ? (
                  <button type="button" disabled={busy} onClick={simple("archive", () => "Archived. It stays out of the public address until restored.")}>Archive</button>
                ) : (
                  <button type="button" disabled={busy} onClick={simple("restore", () => "Restored as a draft.")}>Restore</button>
                )}
                {workspace?.role === "owner" && (
                  <button type="button" disabled={busy} onClick={simple("delete", data => `Deleted ${data.deleted?.name}. App records were not touched.`)}>
                    Delete stack
                  </button>
                )}
              </div>
              <section className="ca-stack-preview" aria-labelledby="stack-preview-title">
                <h2 id="stack-preview-title">Preview</h2>
                <p className="ca-muted">
                  This is the draft as the public page would read it. A preview never publishes anything.
                </p>
                <div className={`ca-preview-page ca-preview-${document.theme}`}>
                  <h3>{document.name}</h3>
                  {document.description && <p>{document.description}</p>}
                  {document.instances.filter(instance => instance.visible).length === 0 && <p className="ca-muted">No visible instances yet.</p>}
                  {document.instances.filter(instance => instance.visible).map(instance => (
                    <article key={instance.id}>
                      <h4>{instance.label}</h4>
                      {instance.caption && <p>{instance.caption}</p>}
                      <p className="ca-muted">{APPS.find(entry => entry.id === instance.app)?.purpose}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
        <aside className="ca-aside">
          <h2>Saved stacks</h2>
          <ul className="ca-stack-list">
            {stacks.map(stack => (
              <li key={stack.id}>
                <button type="button" aria-pressed={stack.id === selected} disabled={busy} onClick={() => void openStack(stack.id)}>
                  <strong>{stack.name}</strong>
                  <span className={`ca-status ca-status-${stack.status}`}>{stack.status}</span>
                  <small>revision {stack.revision} · /s/{stack.slug}</small>
                </button>
              </li>
            ))}
            {!stacks.length && <li className="ca-muted">No stacks yet.</li>}
          </ul>
          {current && (
            <div className="ca-resource-note">
              <h2>Share and ownership</h2>
              <p>
                Public address: <a href={shareUrl} target="_blank" rel="noopener noreferrer">{shareUrl} ↗</a>
              </p>
              <button type="button" disabled={busy} onClick={() => void copyShare()}>Copy share link</button>
              <p className="ca-muted">
                Drafts are never served at this address. Publishing stores a revision; later edits stay private
                until you publish again. Export contains configuration only — app records, media and credentials
                stay with the apps.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
export const pages: PluginAdminExports["pages"] = { "/stacks": StudioPage };
