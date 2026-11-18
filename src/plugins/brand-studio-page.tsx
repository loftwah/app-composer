import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  adminBrandConfig,
  adminBrandSkins,
  brandSkinName,
  brandSnapshot,
  approvedMark,
  compareAdminBrand,
  adminReadingPresets,
  skinPressureNames,
  type AdminBrandConfig,
  type BrandSnapshot,
} from "../lib/admin-brand-contract";
import {
  hapticsAvailable,
  playSkinCue,
  readSensoryPreference,
  sensoryOff,
  skinCuePlan,
  soundAvailable,
  writeSensoryPreference,
  type SkinSensoryPreference,
} from "../lib/brand-skin-feedback";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import { SkinSpecimen } from "../components/SkinSpecimen";
import { SplitCompare } from "../components/SplitCompare";
import "../styles/appearance-skins.generated.css";
import "./brand-studio-page.css";

const BASE = "/_emdash/api/plugins/composer-stacks/";
function deviceStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
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
  const [sensory, setSensory] = useState<SkinSensoryPreference>(sensoryOff);
  const [support, setSupport] = useState({ sound: false, haptics: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cueNote, setCueNote] = useState("");
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
  useEffect(() => {
    const sound = soundAvailable(window),
      haptics = hapticsAvailable(navigator);
    const stored = readSensoryPreference(deviceStorage());
    setSupport({ sound, haptics });
    setSensory({
      sound: stored.sound && sound,
      haptics: stored.haptics && haptics,
    });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)"),
      follow = () => setReducedMotion(query.matches);
    follow();
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  function chooseSensory(patch: Partial<SkinSensoryPreference>) {
    const next = { ...sensory, ...patch };
    setSensory(next);
    writeSensoryPreference(deviceStorage(), next);
  }
  function pressPlate() {
    if (!sensory.sound && !sensory.haptics) {
      setCueNote(
        "Press feedback is off. The plate still shows its pressed edge.",
      );
      return;
    }
    const result = playSkinCue(window, skinCuePlan(reducedMotion), sensory),
      played = [
        result.sound ? "a short tick" : "",
        result.haptics ? "a haptic tap" : "",
      ].filter(Boolean);
    setCueNote(
      played.length
        ? `Press feedback played ${played.join(" and ")}. Nothing else changed.`
        : "This browser did not play or vibrate the press cue. The pressed edge still shows the state.",
    );
  }
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
  const savedDifferences =
    saved && saved.published
      ? compareAdminBrand(saved.published, saved.draft)
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
          <p className="bs-boundary">
            Use{" "}
            <a href="/launch-kit" target="_blank" rel="noopener">
              Launch Kit
            </a>{" "}
            for app icons and sharing images, and browse{" "}
            <a href="/share" target="_blank" rel="noopener">
              Composer Share
            </a>{" "}
            for artwork. Both links open in a new tab.
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
                <fieldset className="bs-skin">
                  <legend>Skin</legend>
                  <p className="bs-hint">
                    An optional tactile treatment for this admin. The Composer
                    default keeps the approved identity and spacing you chose
                    above. Every skin keeps the native controls and labels.{" "}
                    <a href="/appearance" target="_blank" rel="noopener">
                      Open the public skin reference
                    </a>
                    .
                  </p>
                  <div
                    className="bs-skin-choices"
                    role="group"
                    aria-label="Admin skin"
                  >
                    {adminBrandSkins.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={form.skin === option.id}
                        onClick={() => change({ skin: option.id })}
                      >
                        <strong>{option.name}</strong>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Edge pressure
                    <input
                      type="range"
                      aria-label="Edge pressure"
                      aria-describedby="bs-pressure-help"
                      aria-valuetext={`${skinPressureNames[form.skinPressure - 1]} — ${form.skinPressure} of 4`}
                      min={1}
                      max={4}
                      step={1}
                      value={form.skinPressure}
                      onChange={(e) =>
                        change({ skinPressure: Number(e.target.value) })
                      }
                    />
                    <span className="bs-readout" aria-hidden="true">
                      {skinPressureNames[form.skinPressure - 1]} ·{" "}
                      {form.skinPressure} of 4
                    </span>
                    <small id="bs-pressure-help">
                      Sets how heavy the panel edge, field border and focus ring
                      are. Saved with this appearance.{" "}
                      {form.skin === "composer"
                        ? "Not applied while Composer default is selected."
                        : `Applied to the ${brandSkinName(form.skin)} skin.`}
                    </small>
                  </label>
                  <SkinSpecimen
                    skin={form.skin}
                    pressure={form.skinPressure}
                    label="Local specimen"
                    note="A sample of the chosen skin in this form. It is not a saved preview; open the admin previews for that."
                    status={cueNote}
                    onPress={pressPlate}
                  />
                  <div className="bs-sensory">
                    <h3>Press feedback</h3>
                    <p className="bs-hint" id="bs-sensory-help">
                      Both are off until you turn them on, are stored on this
                      device only, and never reach anyone else using this admin.
                      The sample action is the only control that plays them.
                    </p>
                    <label className="bs-check">
                      <input
                        type="checkbox"
                        checked={sensory.sound}
                        disabled={!support.sound}
                        aria-describedby="bs-sensory-help"
                        onChange={(e) =>
                          chooseSensory({ sound: e.target.checked })
                        }
                      />
                      <span>
                        Sound cue on this device
                        <small>
                          {support.sound
                            ? "One short tick after you press the sample. No typing sounds, no autoplay."
                            : "This browser does not expose Web Audio, so sound stays off."}
                        </small>
                      </span>
                    </label>
                    <label className="bs-check">
                      <input
                        type="checkbox"
                        checked={sensory.haptics}
                        disabled={!support.haptics}
                        aria-describedby="bs-sensory-help"
                        onChange={(e) =>
                          chooseSensory({ haptics: e.target.checked })
                        }
                      />
                      <span>
                        Haptic tap on supported devices
                        <small>
                          {support.haptics
                            ? "One brief vibration after you press the sample. The device may ignore it."
                            : "This browser does not report vibration support, which is usual on iPhones and desktops, so haptics stay off."}
                        </small>
                      </span>
                    </label>
                    <p className="bs-hint">
                      Reduced motion is {reducedMotion ? "on" : "off"} in this
                      browser.{" "}
                      {reducedMotion
                        ? "The sample keeps its direct visual press and skips the settle tick and the haptic tap."
                        : "No part of this skin animates; feedback only confirms a press you made."}
                    </p>
                  </div>
                </fieldset>
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
              {saved.published && (
                <section className="bs-compare" aria-labelledby="bs-compare-title">
                  <h3 id="bs-compare-title">Published and saved draft</h3>
                  <p className="bs-hint">
                    Two saved versions drawn with the same skin layer the admin
                    uses. The divider only changes what you can see; it never
                    edits, saves or publishes either version.
                  </p>
                  <SplitCompare
                    label="Compare the published appearance with the saved draft"
                    beforeLabel={`Published version ${saved.publishedVersion}`}
                    afterLabel={`Saved draft version ${saved.revision}`}
                    before={
                      <SkinSpecimen
                        presentational
                        compact
                        skin={saved.published.skin}
                        pressure={saved.published.skinPressure}
                        label={`Published version ${saved.publishedVersion}`}
                        note={`${brandSkinName(saved.published.skin)}, ${
                          skinPressureNames[saved.published.skinPressure - 1]
                        } edge`}
                      />
                    }
                    after={
                      <SkinSpecimen
                        presentational
                        compact
                        skin={saved.draft.skin}
                        pressure={saved.draft.skinPressure}
                        label={`Saved draft version ${saved.revision}`}
                        note={`${brandSkinName(saved.draft.skin)}, ${
                          skinPressureNames[saved.draft.skinPressure - 1]
                        } edge`}
                      />
                    }
                  />
                  <p className="bs-hint">
                    {savedDifferences.length
                      ? `${savedDifferences.length} saved ${
                          savedDifferences.length === 1 ? "field differs" : "fields differ"
                        } from the published appearance.`
                      : "The saved draft matches the published appearance."}
                  </p>
                </section>
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
                        {entry.config.skin !== "composer"
                          ? ` · ${brandSkinName(entry.config.skin)}, ${skinPressureNames[entry.config.skinPressure - 1].toLowerCase()} edge`
                          : ""}
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
