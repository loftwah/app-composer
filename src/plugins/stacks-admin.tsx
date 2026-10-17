import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PluginAdminExports } from "emdash";
import {
  call,
  type ActivationEntry,
  type InstanceConfiguration,
  type Role,
  type Stack,
  type StackDocument,
  type StackPublication,
  type Workspace,
} from "./stacks/api";
import { CAPABILITIES, STACK_APPS } from "../lib/stacks.mjs";
import { StackView } from "../components/StackView";
import "./stacks-admin.css";

// The reviewed apps a stack can reference. Keep in step with src/lib/stacks.mjs.
const APPS: { id: string; name: string; purpose: string }[] = Object.entries(
  STACK_APPS as Record<string, { name: string; purpose: string }>,
).map(([id, app]) => ({ id, name: app.name, purpose: app.purpose }));
const ROLE_COPY: Record<Role, string> = {
  owner: "Owner — full control, including deleting a stack.",
  editor: "Editor — create, configure, publish and duplicate.",
  viewer: "Viewer — read and export only. You can open, preview and export, but nothing here changes the workspace.",
};
const can = (role: Role | undefined, action: string) =>
  Boolean(role && (CAPABILITIES as Record<string, string[]>)[role]?.includes(action));
const newInstance = (app: string) => ({
  id: crypto.randomUUID(),
  app,
  label: APPS.find(entry => entry.id === app)?.name ?? app,
  caption: "",
  visible: true,
  binding: { mode: "own" as const, shareOf: null },
  config: {},
});

type Draft = { document: StackDocument; generation: number };

function StudioPage() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{ message: string; stack?: string }>();
  const [publications, setPublications] = useState<StackPublication[]>([]);
  const [instances, setInstances] = useState<InstanceConfiguration[]>([]);
  const [activation, setActivation] = useState<ActivationEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [fallback, setFallback] = useState("");
  // The revision the server last acknowledged for this editor. Any local edit
  // bumps the generation; a response only marks the editor clean when the
  // generation it was sent for is still the current one.
  const savedRevision = useRef(0);
  const generation = useRef(0);

  const current = useMemo(() => stacks.find(stack => stack.id === selected), [stacks, selected]);
  const document = draft?.document;
  const role = workspace?.role;
  const editable = can(role, "save");

  const adopt = useCallback((stack: Stack) => {
    generation.current += 1;
    savedRevision.current = stack.revision;
    setSelected(stack.id);
    setDraft({ document: structuredClone(stack.draft), generation: generation.current });
    setDirty(false);
    setConflict(undefined);
  }, []);

  const load = useCallback(
    async (keepSelection?: string, { force = false } = {}) => {
      if (!force && dirty && !confirm("This stack has unsaved edits. Reload and lose them?")) return;
      const data = await call("list");
      setWorkspace(data.workspace);
      setStacks(data.stacks ?? []);
      const next = keepSelection ?? selected ?? data.stacks?.[0]?.id;
      const stack = data.stacks?.find(entry => entry.id === next) ?? data.stacks?.[0];
      if (stack) adopt(stack);
      else {
        setSelected(undefined);
        setDraft(undefined);
        setDirty(false);
        savedRevision.current = 0;
      }
    },
    [adopt, dirty, selected],
  );

  useEffect(() => {
    let live = true;
    load(undefined, { force: true })
      .catch(cause => {
        if (live) setError(cause instanceof Error ? cause.message : "The workspace could not be loaded.");
      })
      .finally(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A browser refresh, a closed tab or a jump away is a draft-replacing action
  // too, so it gets the same protection as switching stacks.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const note = await work();
      setMessage(note);
    } catch (cause: any) {
      if (cause?.code === "CONFLICT") {
        setConflict({ message: cause.message, stack: selected });
      } else {
        setError(cause?.message || "The action did not complete. Your draft is still here.");
      }
    } finally {
      setBusy(false);
    }
  };

  const loadSidecars = useCallback(async (stackId: string) => {
    const [history, configuration] = await Promise.all([
      call("publications", { stack: stackId }),
      call("configuration", { stack: stackId }),
    ]);
    setPublications(history.publications ?? []);
    setInstances(configuration.instances ?? []);
    setActivation(configuration.configuration?.entries ?? []);
  }, []);

  useEffect(() => {
    if (!selected) {
      setPublications([]);
      setInstances([]);
      setActivation([]);
      return;
    }
    let live = true;
    loadSidecars(selected).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [selected, loadSidecars]);

  const openStack = async (id: string) => {
    if (id === selected) return;
    if (dirty && !confirm("This stack has unsaved edits. Open another stack and lose them?")) return;
    setBusy(true);
    setError("");
    try {
      const data = await call("open", { stack: id });
      if (data.stack) {
        adopt(data.stack);
        setMessage(`Opened ${data.stack.name} at revision ${data.stack.revision}.`);
      }
    } catch (cause: any) {
      setError(cause?.message || "That stack could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const update = (patch: Partial<StackDocument>) => {
    generation.current += 1;
    setDraft(current => (current ? { document: { ...current.document, ...patch }, generation: generation.current } : current));
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
      if (dirty && !confirm("Create a new stack and leave this draft unsaved?")) return "Nothing created.";
      const data = await call("create", { name: newName });
      setNewName("");
      await load(data.stack?.id, { force: true });
      return `Created ${data.stack?.name}. It starts as a draft at /s/${data.stack?.slug}.`;
    });

  // One save path. It records which local generation it is writing, and only a
  // response for the current generation may mark the editor clean.
  const writeDraft = async (): Promise<Stack> => {
    if (!document || !current) throw Error("Open a stack first.");
    const sent = generation.current;
    const payload = structuredClone(document);
    const data = await call("save", { stack: current.id, document: payload, expectedRevision: savedRevision.current });
    const stack = data.stack as Stack;
    setStacks(list => list.map(entry => (entry.id === stack.id ? stack : entry)));
    savedRevision.current = stack.revision;
    if (generation.current === sent) setDirty(false);
    return stack;
  };

  const save = () =>
    run(async () => {
      const stack = await writeDraft();
      if (dirty) return `Saved revision ${stack.revision}. Your newer edits are still unsaved.`;
      return `Saved draft revision ${stack.revision}.`;
    });

  const publish = () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      // Publishing always activates the revision the editor shows, so any
      // unsaved work is written first through the one save path.
      if (dirty) await writeDraft();
      const data = await call("publish", { stack: current.id, expectedRevision: savedRevision.current });
      const stack = data.stack as Stack;
      setStacks(list => list.map(entry => (entry.id === stack.id ? stack : entry)));
      savedRevision.current = stack.revision;
      await loadSidecars(current.id);
      if (stack.publishedRevision !== savedRevision.current) {
        return `Another window moved this stack while it published, so nothing changed. The public page still shows revision ${stack.publishedRevision}. Reload to publish the revision you want.`;
      }
      return `Published revision ${stack.publishedRevision}. Public at /s/${current.slug}.`;
    });

  const simple = (action: string, note: (data: any) => string, confirmText?: string) => () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      if (confirmText && !confirm(confirmText)) return "Nothing changed.";
      const data = await call(action, { stack: current.id, expectedRevision: savedRevision.current });
      if (action !== "delete") await load(current.id, { force: true });
      else await load(undefined, { force: true });
      return note(data);
    });

  const rollback = (action: "republish" | "restoreRevision", revision: number, label: string) =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const scope =
        action === "republish"
          ? `Make published revision ${revision} the public page again? The draft is left as it is.`
          : `Bring published revision ${revision} back into the draft as a new editable revision? The public page does not change.`;
      if (!confirm(`${scope}\n\nNeither action restores app records, media or deletions, because Composer never owned them.`)) return "Nothing changed.";
      const data = await call(action, { stack: current.id, revision, expectedRevision: savedRevision.current });
      const stack = data.stack as Stack;
      setStacks(list => list.map(entry => (entry.id === stack.id ? stack : entry)));
      setDraft({ document: structuredClone(stack.draft), generation: ++generation.current });
      savedRevision.current = stack.revision;
      setDirty(action === "restoreRevision");
      await loadSidecars(current.id);
      return label;
    });

  // Export asks the server for the canonical shape, so the file always carries
  // the statement of exactly what it does and does not contain.
  const exportDocument = () =>
    run(async () => {
      if (!current) throw Error("Open a stack first.");
      const data = await call("export", { stack: current.id });
      const payload = data.export ?? { format: "app-composer.stack/v1", stack: current.slug, revision: savedRevision.current, document };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = current.slug + ".stack.json";
      link.click();
      URL.revokeObjectURL(url);
      return `Exported ${current.slug}.stack.json. It contains the composition and declared instance settings only — no app records, media, credentials or publication history.`;
    });

  // Import always creates a new draft. It never overwrites a stack and never
  // publishes, so a restore cannot change what visitors already see.
  const importFile = async (file: File) => {
    const text = await file.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      setError(`${file.name} is not a JSON file exported from a stack.`);
      return;
    }
    if (
      !confirm(
        `Import ${file.name} as a new draft stack?\n\nImporting brings the composition and the declared instance settings. It does not bring app records, media, credentials or publication history, and it does not publish anything.`,
      )
    )
      return;
    await run(async () => {
      const data = await call("import", { payload });
      await load(data.stack?.id, { force: true });
      const imported = data.imported;
      if (!imported) return `Imported ${data.stack?.name} as a draft.`;
      return `Imported ${imported.name} as a draft: ${imported.instances} instance(s) across ${imported.apps.join(", ")}${imported.shared ? `, ${imported.shared} reusing another instance` : ""}${imported.configured ? `, ${imported.configured} with their own settings` : ""}. Nothing was published and no app records or media were copied.`;
    });
  };

  const copyShare = async () => {
    if (!current) return;
    const url = new URL("/s/" + current.slug, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Copied ${url}.`);
    } catch {
      setFallback(url);
    }
  };
  const shareUrl = current ? `/s/${current.slug}` : "";

  return (
    <section className="composer-admin ca-stacks">
      <div className="ca-heading">
        <div>
          <h1>Creator stacks</h1>
          <p>
            Save a named composition of reviewed mini-apps, configure each instance
            from the settings its app declares, preview the real page and publish
            one shareable revision. The apps keep their own records, media and
            credentials.
          </p>
        </div>
        {role !== "viewer" && (
          <button type="button" disabled={busy} onClick={() => void load()}>
            Refresh workspace
          </button>
        )}
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
      {conflict && conflict.stack === selected && (
        <div role="alert" className="ca-stack-conflict">
          <h2>Another window changed this stack</h2>
          <p>{conflict.message}</p>
          <p className="ca-muted">
            Your unsaved edits are still in this editor. Reload the saved version to
            compare, or save yours on top of the newer revision.
          </p>
          <div className="ca-actions">
            <button type="button" disabled={busy} onClick={() => void load(selected, { force: true }).then(() => setMessage("Reloaded the saved revision. Your unsaved edits were replaced."))}>
              Reload the saved version
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const latest = await call("open", { stack: selected });
                  if (latest.stack) savedRevision.current = latest.stack.revision;
                  setConflict(undefined);
                  const stack = await writeDraft();
                  return `Saved your version as revision ${stack.revision}.`;
                })
              }
            >
              Save mine on top
            </button>
            <button type="button" disabled={busy} onClick={() => setConflict(undefined)}>
              Keep editing
            </button>
          </div>
        </div>
      )}
      <div className="ca-workspace">
        <div className="ca-main">
          {can(role, "create") && (
            <div className="ca-stack-create">
              <label>
                New stack name
                <input value={newName} maxLength={80} onChange={event => setNewName(event.target.value)} placeholder="Loftwah front page" />
              </label>
              <button type="button" disabled={busy || !newName.trim()} onClick={() => void create()}>
                Create stack
              </button>
            </div>
          )}
          {!document && <p className="ca-muted">No stack yet. {can(role, "create") ? "Name one above to start." : "An owner or editor can create one."}</p>}
          {document && current && (
            <>
              <div className="ca-stack-state">
                <span className={`ca-status ca-status-${current.status}`}>{current.status}</span>
                <span className="ca-muted">
                  {dirty ? `Unsaved edits on top of revision ${savedRevision.current}` : `Saved revision ${savedRevision.current}`}
                  {current.publishedRevision ? ` · public revision ${current.publishedRevision}` : " · not published"}
                </span>
              </div>
              <div className="ca-form ca-stack-form">
                <label>
                  Name
                  <input value={document.name} maxLength={80} disabled={!editable} onChange={event => update({ name: event.target.value })} />
                </label>
                <label>
                  Description
                  <textarea rows={2} maxLength={240} disabled={!editable} value={document.description} onChange={event => update({ description: event.target.value })} />
                </label>
                <label>
                  Theme
                  <select value={document.theme} disabled={!editable} onChange={event => update({ theme: event.target.value })}>
                    <option value="midnight">Midnight</option>
                    <option value="daylight">Daylight</option>
                  </select>
                </label>
              </div>
              <h2>App instances</h2>
              <p className="ca-muted">
                Up to 12 instances. Add the same app twice to show it in two places:
                the second can reuse the first, which keeps one set of records and
                settings, or be configured on its own.
              </p>
              {document.instances.map((instance, index) => {
                const meta = APPS.find(entry => entry.id === instance.app);
                const declared = instances.find(entry => entry.app === instance.app)?.declared ?? [];
                const shared = instance.binding?.mode === "shared";
                const siblings = document.instances.filter(entry => entry.app === instance.app && entry.id !== instance.id && entry.binding?.mode !== "shared");
                return (
                  <div className="ca-card-row ca-stack-instance" key={instance.id}>
                    <div>
                      <h3>
                        {meta?.name ?? instance.app} <span className="ca-muted">· {instance.label}</span>
                      </h3>
                      <label>
                        Label
                        <input value={instance.label} maxLength={60} disabled={!editable} onChange={event => updateInstance(instance.id, { label: event.target.value })} />
                      </label>
                      <label>
                        Caption
                        <input value={instance.caption} maxLength={200} disabled={!editable} onChange={event => updateInstance(instance.id, { caption: event.target.value })} />
                      </label>
                      <label className="ca-check">
                        <input type="checkbox" checked={instance.visible} disabled={!editable} onChange={event => updateInstance(instance.id, { visible: event.target.checked })} /> Visible on the published page
                      </label>
                      {!shared && (
                        <>
                          <p className="ca-muted">{meta?.purpose}</p>
                          <fieldset disabled={!editable} className="ca-stack-binding">
                            <legend>How this instance is owned</legend>
                            <label className="ca-check">
                              <input
                                type="radio"
                                name={`binding-${instance.id}`}
                                checked={instance.binding?.mode !== "shared"}
                                onChange={() => updateInstance(instance.id, { binding: { mode: "own", shareOf: null } })}
                              />
                              Independently configured
                            </label>
                            {siblings.length > 0 && (
                              <label className="ca-check">
                                <input
                                  type="radio"
                                  name={`binding-${instance.id}`}
                                  checked={shared}
                                  onChange={() => updateInstance(instance.id, { binding: { mode: "shared", shareOf: siblings[0].id }, config: {} })}
                                />
                                Reuse “{siblings[0].label}” ({meta?.name} already in this stack)
                              </label>
                            )}
                          </fieldset>
                        </>
                      )}
                      {shared && (
                        <p className="ca-stack-shared">
                          Shared with “{document.instances.find(entry => entry.id === instance.binding?.shareOf)?.label ?? "another instance"}”.
                          The app keeps one set of records, so edits and approvals appear in both places.
                          <button type="button" disabled={!editable} onClick={() => updateInstance(instance.id, { binding: { mode: "own", shareOf: null } })}>
                            Make this one independently configured
                          </button>
                        </p>
                      )}
                      {!shared && declared.length > 0 && (
                        <details className="ca-stack-config">
                          <summary>Settings this app declares{Object.keys(instance.config ?? {}).length ? ` · ${Object.keys(instance.config).length} set here` : ""}</summary>
                          {declared.map(field => (
                            <label key={field.key}>
                              {field.label}
                              {field.options?.length ? (
                                <select
                                  value={instance.config?.[field.key] ?? ""}
                                  disabled={!editable}
                                  onChange={event => {
                                    const next = { ...(instance.config ?? {}) };
                                    if (event.target.value) next[field.key] = event.target.value;
                                    else delete next[field.key];
                                    updateInstance(instance.id, { config: next });
                                  }}
                                >
                                  <option value="">Use the app’s default ({field.default || "unset"})</option>
                                  {field.options.map(option => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={instance.config?.[field.key] ?? ""}
                                  maxLength={field.maxLength ?? 240}
                                  disabled={!editable}
                                  placeholder={field.default}
                                  onChange={event => {
                                    const next = { ...(instance.config ?? {}) };
                                    if (event.target.value) next[field.key] = event.target.value;
                                    else delete next[field.key];
                                    updateInstance(instance.id, { config: next });
                                  }}
                                />
                              )}
                            </label>
                          ))}
                          <p className="ca-muted">
                            Declared by {meta?.name}. Applying these writes through the app’s own owner API, after it confirms
                            its live source matches the pinned revision. Nothing is applied until you do that explicitly.
                          </p>
                        </details>
                      )}
                      {!shared && declared.length === 0 && <p className="ca-muted">{meta?.name} does not publish a configuration contract, so this instance can only reuse what the app already holds.</p>}
                    </div>
                    {editable && (
                      <div className="ca-actions">
                        <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)}>Move up</button>
                        <button type="button" disabled={busy || index === document.instances.length - 1} onClick={() => move(index, 1)}>Move down</button>
                        <button type="button" disabled={busy} onClick={() => update({ instances: document.instances.filter(entry => entry.id !== instance.id) })}>Remove</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {editable && (
                <div className="ca-stack-add">
                  {APPS.map(app => (
                    <button
                      key={app.id}
                      type="button"
                      disabled={busy || document.instances.length >= 12}
                      title={app.purpose}
                      onClick={() => update({ instances: [...document.instances, newInstance(app.id)] })}
                    >
                      Add {app.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="ca-stack-actions">
                {editable && (
                  <button type="button" disabled={busy || !dirty} onClick={() => void save()}>
                    Save draft
                  </button>
                )}
                {can(role, "publish") && (
                  <button type="button" disabled={busy} onClick={() => void publish()}>
                    Publish
                  </button>
                )}
                {current.status === "published" && can(role, "unpublish") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={simple("unpublish", () => "Unpublished. The public address now returns 404 until you publish again. The stored publications are kept.", "Unpublish this stack? The public address stops serving it immediately. The draft and its publication history are kept.")}
                  >
                    Unpublish
                  </button>
                )}
                {can(role, "duplicate") && (
                  <button type="button" disabled={busy} onClick={simple("duplicate", data => `Duplicated as ${data.stack?.name}. It is a separate draft with new instance identities, and the same shared-versus-independent structure.`)}>Duplicate</button>
                )}
                <button type="button" disabled={busy} onClick={() => void exportDocument()}>Export JSON</button>
                {can(role, "create") && (
                  <label className="ca-stack-import">
                    Import a stack file
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={busy}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void importFile(file);
                      }}
                    />
                  </label>
                )}
                {can(role, "archive") && (
                  current.status !== "archived" ? (
                    <button type="button" disabled={busy} onClick={simple("archive", () => "Archived. It stays out of the public address until restored.", "Archive this stack? Its public address stops serving, and the draft is locked until you restore it.")}>Archive</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={simple("restore", () => "Restored as a draft. Publish again when you want it public.")}>Restore</button>
                  )
                )}
                {can(role, "delete") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={simple(
                      "delete",
                      data => `Deleted ${data.deleted?.name}. Its configuration and publication history are gone. App records and media were never part of it and are untouched.`,
                      "Delete this stack permanently? Its configuration and publication history are removed. The apps keep their own records, media and settings.",
                    )}
                  >
                    Delete stack
                  </button>
                )}
              </div>
              <section className="ca-stack-preview" aria-labelledby="stack-preview-title">
                <h2 id="stack-preview-title">Preview</h2>
                <p className="ca-muted">
                  The same renderer the published page uses, applied to your draft. A preview never publishes anything.
                </p>
                <StackView document={document} />
              </section>
              {publications.length > 0 && (
                <section className="ca-stack-history">
                  <h2>Published revisions</h2>
                  <p className="ca-muted">
                    Every revision that was actually activated. Rolling one back changes Composer’s published
                    configuration only; app content, media and deletions are not restored.
                  </p>
                  <ul>
                    {publications.map(publication => (
                      <li key={publication.revision}>
                        <span>
                          Revision {publication.revision}
                          {publication.revision === current.publishedRevision ? " · public now" : ""}
                          <small> {publication.publishedAt}</small>
                        </span>
                        {can(role, "rollback") && (
                          <span className="ca-actions">
                            <button type="button" disabled={busy || publication.revision === current.publishedRevision} onClick={() => void rollback("republish", publication.revision, `Published revision ${publication.revision} is public again.`)}>
                              Publish this revision
                            </button>
                            <button type="button" disabled={busy} onClick={() => void rollback("restoreRevision", publication.revision, `Revision ${publication.revision} is in the draft as a new revision.`)}>
                              Restore into draft
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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
              {fallback && (
                <label className="ca-share-fallback">
                  Share address
                  <input readOnly value={fallback} onFocus={event => event.currentTarget.select()} />
                </label>
              )}
              <p className="ca-muted">
                Drafts are never served at this address. Publishing stores an immutable revision; later edits stay
                private until you publish again. Export contains configuration only — app records, media and
                credentials stay with the apps.
              </p>
              {activation.length > 0 && (
                <div className="ca-config-status">
                  <h3>App configuration</h3>
                  <ul>
                    {activation.map(entry => (
                      <li key={entry.instanceId}>
                        <strong>{entry.name}</strong>{" "}
                        {entry.configurable ? (
                          <span>
                            {entry.settings?.filter(setting => setting.overridden).length
                              ? `${entry.settings.filter(setting => setting.overridden).length} declared setting(s) stored with this stack; apply through the app’s owner API.`
                              : "Everything uses the app’s own defaults."}
                          </span>
                        ) : (
                          <span>{entry.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
export const pages: PluginAdminExports["pages"] = { "/stacks": StudioPage };
