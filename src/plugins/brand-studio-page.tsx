import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  adminBrandConfig,
  brandSnapshot,
  approvedMark,
  compareAdminBrand,
  adminReadingPresets,
  type AdminBrandConfig,
  type BrandSnapshot,
} from "../lib/admin-brand-contract";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import "./brand-studio-page.css";

const BASE = "/_emdash/api/plugins/composer-stacks/";
const SCREENS = [
  ["overview", "Needs attention"],
  ["enquiries", "Inbox"],
  ["workflows", "Workflows"],
  ["connections", "Connections"],
  ["outcomes", "Analytics"],
  ["stacks", "Creator stacks"],
] as const;
async function call(
  action: string,
  fields: Record<string, unknown> = {},
): Promise<BrandSnapshot> {
  const response = await apiFetch(
    BASE + (action === "read" ? "brandRead?action=read" : "brandWrite"),
    action === "read"
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...fields }),
        },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "Appearance could not be confirmed. Keep your form and reload the saved version.",
  );
  const parsed = brandSnapshot.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      raw &&
        typeof raw === "object" &&
        "message" in raw &&
        typeof raw.message === "string"
        ? raw.message
        : "Appearance response could not be validated. Your form is retained.",
    );
  return parsed.data;
}
export function BrandStudioPage() {
  const [saved, setSaved] = useState<BrandSnapshot>();
  const [form, setForm] = useState<AdminBrandConfig>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [screen, setScreen] = useState("overview");
  const [reviewed, setReviewed] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<number>();
  const alive = useRef(true),
    pending = useRef(false);
  const dirty = !!(
    form &&
    saved &&
    JSON.stringify(form) !== JSON.stringify(saved.draft)
  );
  useNavigationGuard({
    changed: dirty,
    pending: busy,
    onPending: () =>
      setError("Wait for the saved appearance result before leaving."),
  });
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await call("read");
      if (alive.current) {
        setSaved(next);
        setForm(next.draft);
        setReviewed(false);
        setRestoreVersion(undefined);
      }
    } catch (error) {
      if (alive.current)
        setError(
          error instanceof Error ? error.message : "Appearance unavailable.",
        );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, []);
  const change = (patch: Partial<AdminBrandConfig>) => {
    if (!busy && form) {
      setForm({ ...form, ...patch });
      setReviewed(false);
      setNotice("");
    }
  };
  async function mutate(
    action: "save" | "publish" | "rollback",
    targetVersion?: number,
  ) {
    if (!saved || !form || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const fields =
        action === "save"
          ? {
              expectedRevision: saved.revision,
              config: adminBrandConfig.parse(form),
            }
          : {
              expectedRevision: saved.revision,
              targetVersion,
              target: saved.target,
            };
      const next = await call(action, fields);
      if (alive.current) {
        setSaved(next);
        setForm(next.draft);
        setReviewed(false);
        setRestoreVersion(undefined);
        setNotice(
          action === "save"
            ? "Draft saved. Open an actual admin preview before publishing."
            : action === "publish"
              ? "Appearance published. Reload an admin tab to see the saved result."
              : "Previous published appearance restored as a new version. Earlier versions are retained.",
        );
      }
    } catch (error) {
      if (alive.current)
        setError(
          error instanceof Error
            ? error.message
            : "Appearance could not be confirmed. Reload before retrying.",
        );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void mutate("save");
  }
  function download() {
    if (!form) return;
    const parsed = adminBrandConfig.safeParse(form);
    if (!parsed.success) {
      setError(
        "Complete the supported appearance fields before exporting. Your entries remain here.",
      );
      return;
    }
    const blob = new Blob([JSON.stringify(parsed.data, null, 2) + "\n"], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "composer-admin-brand.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function importFile(file?: File) {
    if (!file || pending.current || !saved) return;
    pending.current = true;
    setBusy(true);
    try {
      if (file.size > 8000)
        throw Error("Choose an appearance JSON file smaller than 8 KB.");
      const next = adminBrandConfig.parse(JSON.parse(await file.text()));
      if (JSON.stringify(next.target) !== JSON.stringify(saved.target))
        throw Error(
          "That file belongs to another account, app or environment. Its configuration was not applied.",
        );
      if (!alive.current) return;
      setForm(next);
      setReviewed(false);
      setNotice(
        "Imported into this form. Review and save a draft before publishing.",
      );
      setError("");
    } catch (error) {
      if (!alive.current) return;
      setError(
        error instanceof Error && !(error.name === "ZodError")
          ? error.message
          : "Use a version 1 Composer appearance file with supported choices. Current entries were retained.",
      );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const preview = saved?.revision
    ? `/_emdash/admin/plugins/composer-stacks/${screen}?brandPreview=${saved.revision}`
    : null;
  const differences =
    saved && form && saved.published
      ? compareAdminBrand(saved.published, form)
      : [];
  const restore = saved?.history.find(
    (entry) => entry.version === restoreVersion,
  );
  return (
    <section className="composer-brand-studio" aria-busy={busy}>
      <header className="bs-header">
        <img src={approvedMark} alt="" width="48" height="48" />
        <div>
          <h1>Brand Studio</h1>
          <p>
            Give this Composer admin a clear identity, then try it on the
            screens you use.
          </p>
        </div>
      </header>
      {error && (
        <p role="alert" className="bs-error">
          {error}
        </p>
      )}
      <p role="status" className="bs-notice">
        {busy ? "Confirming saved appearance…" : notice}
      </p>
      {!saved || !form ? (
        <button disabled={busy} onClick={() => void load()}>
          Reload appearance
        </button>
      ) : (
        <>
          <dl className="bs-scope">
            <div>
              <dt>Application</dt>
              <dd>Composer administration</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{saved.target.environment}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{saved.target.account}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>EmDash administrator</dd>
            </div>
          </dl>
          <p className="bs-boundary">
            This changes the shared Composer admin for this account and
            environment. Independent app identities and public pages keep their
            own settings.
          </p>
          <div className="bs-workspace">
            <form onSubmit={submit} className="bs-form">
              <h2>Appearance</h2>
              <fieldset disabled={busy}>
                <legend className="bs-visually-hidden">
                  Supported appearance choices
                </legend>
                <div
                  className="bs-presets"
                  role="group"
                  aria-label="Reading presets"
                >
                  {adminReadingPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={
                        form.density === preset.density &&
                        form.typeScale === preset.typeScale
                      }
                      onClick={() =>
                        change({
                          density: preset.density,
                          typeScale: preset.typeScale,
                        })
                      }
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.description}</span>
                    </button>
                  ))}
                </div>
                <label>
                  Admin name
                  <input
                    aria-label="Admin name"
                    aria-describedby="bs-admin-name-help"
                    value={form.siteName}
                    required
                    minLength={2}
                    maxLength={60}
                    onChange={(e) => change({ siteName: e.target.value })}
                  />
                  <small id="bs-admin-name-help">
                    Shown in the native header, loading screen and tab title.
                  </small>
                </label>
                <label>
                  Footer label
                  <input
                    value={form.footerLabel}
                    required
                    minLength={2}
                    maxLength={60}
                    onChange={(e) => change({ footerLabel: e.target.value })}
                  />
                </label>
                <label>
                  Spacing
                  <select
                    aria-label="Spacing"
                    value={form.density}
                    onChange={(e) =>
                      change({
                        density: e.target.value as AdminBrandConfig["density"],
                      })
                    }
                  >
                    <option value="comfortable">
                      Comfortable — room to read and review
                    </option>
                    <option value="compact">
                      Compact — shorter Composer panels
                    </option>
                  </select>
                </label>
                <label>
                  Text size
                  <select
                    aria-label="Text size"
                    value={form.typeScale}
                    onChange={(e) =>
                      change({
                        typeScale: e.target
                          .value as AdminBrandConfig["typeScale"],
                      })
                    }
                  >
                    <option value="standard">Standard — 16px base</option>
                    <option value="large">Large — 18px base</option>
                  </select>
                </label>
                <div className="bs-identity">
                  <img
                    src={approvedMark}
                    alt="Approved orange and white merging-block mark"
                    width="64"
                    height="64"
                  />
                  <p>
                    <strong>Composer orange</strong>
                    <br />
                    The approved mark and accessible light/dark variants. Native
                    action and status icons keep EmDash’s Phosphor system.
                  </p>
                </div>
                <div className="bs-actions">
                  <button
                    className="bs-primary"
                    type="submit"
                    disabled={!dirty && saved.revision > 0}
                  >
                    Save draft
                  </button>
                  <button type="button" onClick={download}>
                    Export configuration
                  </button>
                </div>
                <label className="bs-import">
                  Import configuration
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </fieldset>
              <p className="bs-state">
                {dirty
                  ? "Unsaved changes — previews still show the saved draft."
                  : saved.revision
                    ? `Saved version ${saved.revision}.`
                    : "Defaults have not been saved."}
              </p>
            </form>
            <aside className="bs-preview">
              <h2>Changes to the published admin</h2>
              <p>
                {saved.publishedVersion
                  ? `Published version ${saved.publishedVersion} remains active until you publish or restore.`
                  : "The native default remains active until your first publication."}
              </p>
              {differences.length ? (
                <dl className="bs-differences">
                  {differences.map((item) => (
                    <div key={item.key}>
                      <dt>{item.label}</dt>
                      <dd>
                        <span>{item.before}</span>
                        <span aria-hidden="true"> → </span>
                        <strong>{item.after}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="bs-hint">
                  {saved.published
                    ? "Your form matches the published appearance."
                    : "Save a draft to begin."}
                </p>
              )}
              <details className="bs-palette">
                <summary>Semantic colours and identity</summary>
                <p>
                  The approved palette keeps action, focus and status meanings
                  consistent in both native themes.
                </p>
                <dl>
                  <div>
                    <dt>Composer signal</dt>
                    <dd>
                      <span className="bs-swatch bs-signal" />
                      #FC5B05 · charcoal text
                    </dd>
                  </div>
                  <div>
                    <dt>Native action / light focus</dt>
                    <dd>
                      <span className="bs-swatch bs-action" />
                      #C74400 · white text
                    </dd>
                  </div>
                  <div>
                    <dt>Dark links / focus</dt>
                    <dd>
                      <span className="bs-swatch bs-signal" />
                      #FC5B05 · native dark surface
                    </dd>
                  </div>
                </dl>
                <p>
                  Status colours remain owned by EmDash. Reading presets
                  preserve your name, footer and approved mark.
                </p>
              </details>
              <h2>Try the saved draft</h2>
              <p>
                Open the actual native admin with this saved appearance. A
                preview is private to administrators.
              </p>
              <label>
                Screen
                <select
                  aria-label="Screen"
                  value={screen}
                  disabled={busy}
                  onChange={(e) => setScreen(e.target.value)}
                >
                  {SCREENS.map(([path, label]) => (
                    <option key={path} value={path}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {preview ? (
                <div className="bs-preview-links">
                  {[
                    ["Desktop", 1280, 900],
                    ["Phone", 390, 844],
                  ].map(([label, width, height]) => (
                    <a
                      key={label}
                      href={preview}
                      target="_blank"
                      rel="noopener"
                      onClick={(event) => {
                        const opened = window.open(
                          preview,
                          "_blank",
                          `popup=yes,width=${width},height=${height}`,
                        );
                        if (opened) {
                          opened.opener = null;
                          event.preventDefault();
                        }
                      }}
                    >
                      Open {label} preview
                    </a>
                  ))}
                </div>
              ) : (
                <p>Save the first draft to open its preview.</p>
              )}
              <p className="bs-hint">
                Your browser may open a tab instead of a sized window. Phone
                previews can be checked at 390px; use the native theme menu to
                inspect light and dark.
              </p>
              <div className="bs-publish">
                <h3>Publish deliberately</h3>
                <p>
                  Current appearance:{" "}
                  {saved.publishedVersion
                    ? `published version ${saved.publishedVersion}`
                    : "native defaults"}
                  . Publishing applies the saved version to everyone using this
                  Composer admin.
                </p>
                <label className="bs-check">
                  <input
                    type="checkbox"
                    disabled={busy || dirty || !saved.revision}
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  I reviewed the saved draft on the screens I need.
                </label>
                <button
                  disabled={busy || dirty || !reviewed || !saved.revision}
                  onClick={() => void mutate("publish", saved.revision)}
                >
                  Publish saved appearance
                </button>
              </div>
            </aside>
          </div>
          <section className="bs-history">
            <h2>Saved versions</h2>
            <p>
              Publishing and restoring create a new version. Earlier
              configurations stay available.
            </p>
            {!saved.history.length ? (
              <p>No versions saved yet.</p>
            ) : (
              <ol>
                {saved.history.map((entry) => (
                  <li key={entry.version}>
                    <div>
                      <strong>
                        Version {entry.version} ·{" "}
                        {entry.event === "draft"
                          ? "saved draft"
                          : entry.event === "publish"
                            ? "published"
                            : "restored"}
                      </strong>
                      <p>
                        {entry.config.siteName} · {entry.config.density} spacing
                        · {entry.config.typeScale} text
                        {entry.version === saved.publishedVersion
                          ? " · current appearance"
                          : ""}
                      </p>
                      <small>{entry.createdAt} UTC</small>
                    </div>
                    <div className="bs-actions">
                      <a
                        href={`/_emdash/admin/plugins/composer-stacks/overview?brandPreview=${entry.version}`}
                        target="_blank"
                        rel="noopener"
                      >
                        Preview version {entry.version}
                      </a>
                      {entry.event !== "draft" &&
                        entry.version !== saved.publishedVersion && (
                          <button
                            disabled={busy || dirty}
                            onClick={() => setRestoreVersion(entry.version)}
                          >
                            Review restore of version {entry.version}
                          </button>
                        )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {restore && saved.published && (
              <section
                className="bs-restore"
                aria-label="Review appearance restore"
              >
                <h3>Restore version {restore.version}</h3>
                <p>
                  This publishes a new version for this account and environment.
                  All earlier versions remain available.
                </p>
                <dl className="bs-differences">
                  {compareAdminBrand(saved.published, restore.config).map(
                    (item) => (
                      <div key={item.key}>
                        <dt>{item.label}</dt>
                        <dd>
                          {item.before} → <strong>{item.after}</strong>
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                {compareAdminBrand(saved.published, restore.config).length ===
                  0 && (
                  <p>
                    The selected version has the same appearance as the current
                    publication.
                  </p>
                )}
                <div className="bs-actions">
                  <button
                    disabled={busy || dirty}
                    onClick={() => void mutate("rollback", restore.version)}
                  >
                    Confirm restore of version {restore.version}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setRestoreVersion(undefined)}
                  >
                    Cancel restore
                  </button>
                </div>
              </section>
            )}
            <button
              disabled={busy}
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    "Reload the saved appearance and discard these unsaved changes?",
                  )
                )
                  void load();
              }}
            >
              Reload saved appearance
            </button>
          </section>
        </>
      )}
    </section>
  );
}
