import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { builderHref } from "../lib/builder-context.mjs";
import {
  HANDOFF_KEY,
  LAUNCHPAD_KEY,
  agentPrompt as rawPrompt,
  blockLabels as rawBlockLabels,
  blockNotes as rawBlockNotes,
  initialLaunchpad as rawInitial,
  launchpadSpec as rawSpec,
  layouts as rawLayouts,
  palettes as rawPalettes,
  readLaunchpad as rawRead,
  specToLaunchpad as rawApply,
  themes as rawThemes,
  transition as rawTransition,
} from "../lib/launchpad.mjs";
import "../styles/launchpad.css";

type Theme = "daylight" | "midnight";
type Accent = "ember" | "sea" | "moss" | "clay";
type Layout = "grid" | "editorial";
type Note = {
  id: string;
  label: string;
  message: string;
  status: "pending" | "approved" | "hidden";
};
type Link = { id: string; label: string; url: string };
type Blocks = { profile: boolean; guestbook: boolean; gallery: boolean };
type Project = {
  name: string;
  tagline: string;
  theme: Theme;
  accent: Accent;
  layout: Layout;
};
type Revision = { id: number; label: string; project: Project; blocks: Blocks; links: Link[] };
type Launchpad = {
  version: 1;
  project: Project;
  blocks: Blocks;
  links: Link[];
  contributions: Note[];
  revisions: Revision[];
};
type Action =
  | { type: "name" | "tagline"; value: string }
  | { type: "theme"; value: Theme }
  | { type: "accent"; value: Accent }
  | { type: "layout"; value: Layout }
  | { type: "block"; block: keyof Blocks; value: boolean }
  | { type: "link"; id: string; label: string; url: string }
  | { type: "unlink"; id: string }
  | { type: "review"; id: string; value: "approved" | "hidden" }
  | { type: "save" }
  | { type: "restore"; revision: number };
type Report = { carried: string[]; notCarried: string[] };

const initialLaunchpad = rawInitial as unknown as () => Launchpad;
const transition = rawTransition as unknown as (s: Launchpad, a: Action) => Launchpad;
const readLaunchpad = rawRead as unknown as (raw: string | null) => {
  state: Launchpad;
  recovered: boolean;
};
const launchpadSpec = rawSpec as unknown as (s: Launchpad) => {
  spec: unknown;
  carried: string[];
  notCarried: string[];
};
const specToLaunchpad = rawApply as unknown as (
  spec: unknown,
  current: Launchpad,
) => Report & { state: Launchpad };
const agentPrompt = rawPrompt as unknown as (s: Launchpad) => string;
const palettes = rawPalettes as unknown as Record<
  Accent,
  { name: string; daylight: { accent: string }; midnight: { accent: string } }
>;
const blockLabels = rawBlockLabels as unknown as Record<keyof Blocks, string>;
const blockNotes = rawBlockNotes as unknown as Record<keyof Blocks, string>;
const layouts = rawLayouts as unknown as Layout[];
const themes = rawThemes as unknown as Theme[];

const photos: Record<string, { src: string; alt: string }> = {
  "note-1": {
    src: "/brand/demo/ringmarket-v5.webp",
    alt: "Fictional demo postcard: a market strung between asteroids above a ringed planet",
  },
  "note-2": {
    src: "/brand/demo/lighthouse-v5.webp",
    alt: "Fictional demo postcard: a lighthouse keeper climbing a tower on a slow moon",
  },
};
const accents: Accent[] = ["ember", "sea", "moss", "clay"];
const blockOrder: (keyof Blocks)[] = ["profile", "guestbook", "gallery"];

function reducer(
  current: Launchpad,
  action: Action | { type: "replace"; state: Launchpad },
): Launchpad {
  if (action.type === "replace") return action.state;
  return transition(current, action);
}

function Preview({ state }: { state: Launchpad }) {
  const approved = state.contributions.filter((note) => note.status === "approved");
  const pending = state.contributions.filter((note) => note.status === "pending").length;
  const { project, blocks, links } = state;
  return (
    <div
      className="lp-app"
      data-lp-theme={project.theme}
      data-lp-accent={project.accent}
      data-preview="launchpad"
    >
      <div className="lp-bar">
        <span className="lp-mark" aria-hidden="true">
          {(project.name.trim()[0] ?? "A").toUpperCase()}
        </span>
        <strong>{project.name.trim() || "Untitled project"}</strong>
        <span className="lp-chip">Sandbox</span>
      </div>
      {blocks.profile && (
        <div className="lp-identity">
          <h3>{project.name.trim() || "Untitled project"}</h3>
          <p>{project.tagline.trim() || "A small app I own."}</p>
          {links.length > 0 && (
            <ul className="lp-links">
              {links.map((link) => (
                <li key={link.id}>
                  <span>{link.label.trim() || "Untitled link"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {blocks.guestbook ? (
        <div className="lp-wall">
          <div className="lp-wall-head">
            <span>Guest wall</span>
            <span>
              {approved.length} public · {pending} waiting
            </span>
          </div>
          {approved.length === 0 ? (
            <p className="lp-empty">
              Nothing is public yet. Approved contributions appear here.
            </p>
          ) : (
            <ul className={`lp-grid lp-${project.layout}`}>
              {approved.map((note) => (
                <li key={note.id}>
                  {photos[note.id] && (
                    <img
                      src={photos[note.id].src}
                      alt={photos[note.id].alt}
                      width="1200"
                      height="900"
                      loading="lazy"
                    />
                  )}
                  <p>{note.message}</p>
                  <span>{note.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="lp-empty">
          The guestbook block is off, so no contributions are published by this app.
        </p>
      )}
      <p className="lp-foot">
        Built with App Composer · demo data in this browser
      </p>
    </div>
  );
}

export default function LaunchpadSandbox() {
  const [state, dispatch] = useReducer(reducer, undefined, initialLaunchpad);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState<"idle" | "ok" | "blocked">("idle");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LAUNCHPAD_KEY);
    } catch {
      setSaved("blocked");
    }
    if (raw !== null) {
      const loaded = readLaunchpad(raw);
      if (loaded.recovered)
        setMessage(
          "Your saved sandbox could not be read, so it started fresh. Nothing else on this page changed.",
        );
      dispatch({ type: "replace", state: loaded.state });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LAUNCHPAD_KEY, JSON.stringify(state));
      setSaved("ok");
    } catch {
      setSaved("blocked");
    }
  }, [state, hydrated]);

  const exported = useMemo(() => launchpadSpec(state), [state]);
  const approvedCount = state.contributions.filter((n) => n.status === "approved").length;
  const pendingCount = state.contributions.filter((n) => n.status === "pending").length;
  const appCount = (state.blocks.profile ? 1 : 0) + (state.blocks.guestbook ? 1 : 0);

  function say(text: string) {
    setMessage(text);
    messageRef.current?.focus();
  }

  function continueInInit() {
    if (!exported.spec) {
      say("Turn on at least one block before continuing.");
      return;
    }
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(exported.spec));
      location.assign(
        builderHref(new URL(location.href), "/init?start=workbench#starting-point"),
      );
    } catch {
      say(
        "This browser blocked session storage, so your settings could not carry across. Allow storage and try again; nothing has been deployed.",
      );
    }
  }

  function download() {
    if (!exported.spec) {
      say("Turn on at least one block before downloading a blueprint.");
      return;
    }
    const blob = new Blob([JSON.stringify(exported.spec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "app-composer-blueprint.json";
    anchor.click();
    URL.revokeObjectURL(url);
    say("Blueprint downloaded. It carries the fields listed above and nothing else.");
  }

  async function copyPrompt() {
    const text = agentPrompt(state);
    try {
      await navigator.clipboard.writeText(text);
      say("Agent brief copied. Paste it into your own coding agent when you are ready.");
    } catch {
      say("Copying was blocked by this browser. Use the download instead.");
    }
  }

  function applyImport() {
    setImportError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("That is not valid JSON. Paste an exported blueprint unchanged.");
      return;
    }
    try {
      const applied = specToLaunchpad(parsed, state);
      dispatch({ type: "replace", state: applied.state });
      setReport({ carried: applied.carried, notCarried: applied.notCarried });
      setImportText("");
      say("Blueprint applied. Fields the schema cannot carry are listed below.");
    } catch (error) {
      setImportError(
        error instanceof Error
          ? `This blueprint was not applied: ${error.message}`
          : "This blueprint was not applied.",
      );
    }
  }

  return (
    <div className="lp">
      <div className="lp-preview" id="lp-preview">
        <div className="lp-preview-label">
          <span>Preview · updates as you change the settings</span>
          <span>{saved === "blocked" ? "Saving is blocked" : "Saved in this browser"}</span>
        </div>
        <Preview state={state} />
      </div>

      <div className="lp-controls">
        <section aria-labelledby="lp-shape">
          <h2 id="lp-shape">Make it yours</h2>
          <p className="lp-help">
            These are real settings on a small local app. Nothing is deployed and no
            account is created.
          </p>
          <label className="lp-field">
            <span>Project name</span>
            <input
              value={state.project.name}
              maxLength={60}
              onChange={(event) => dispatch({ type: "name", value: event.target.value })}
            />
          </label>
          <label className="lp-field">
            <span>One line about it</span>
            <textarea
              value={state.project.tagline}
              maxLength={140}
              rows={2}
              onChange={(event) => dispatch({ type: "tagline", value: event.target.value })}
            />
          </label>
          <div className="lp-row">
            <fieldset className="lp-choice">
              <legend>Appearance</legend>
              <div className="lp-segmented">
                {themes.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={state.project.theme === theme}
                    className={state.project.theme === theme ? "is-on" : ""}
                    onClick={() => dispatch({ type: "theme", value: theme })}
                  >
                    {theme === "daylight" ? "Daylight" : "Midnight"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="lp-choice">
              <legend>Layout</legend>
              <div className="lp-segmented">
                {layouts.map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    aria-pressed={state.project.layout === layout}
                    className={state.project.layout === layout ? "is-on" : ""}
                    onClick={() => dispatch({ type: "layout", value: layout })}
                  >
                    {layout === "grid" ? "Gallery grid" : "Large images"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset className="lp-choice">
            <legend>Accent</legend>
            <div className="lp-swatches" role="radiogroup" aria-label="Accent colour">
              {accents.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  role="radio"
                  aria-checked={state.project.accent === accent}
                  aria-label={palettes[accent].name}
                  className={`lp-swatch lp-swatch-${accent} ${state.project.accent === accent ? "is-on" : ""}`}
                  data-lp-theme={state.project.theme}
                  onClick={() => dispatch({ type: "accent", value: accent })}
                >
                  <span aria-hidden="true" />
                  {palettes[accent].name}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="lp-field">
            <span>Link label</span>
            <input
              value={state.links[0]?.label ?? ""}
              maxLength={60}
              placeholder="Latest film"
              onChange={(event) =>
                dispatch({
                  type: "link",
                  id: state.links[0]?.id ?? "link-1",
                  label: event.target.value,
                  url: state.links[0]?.url ?? "",
                })
              }
            />
            <span className="lp-help">First link only. More links stay in the blueprint.</span>
          </label>
        </section>

        <section aria-labelledby="lp-blocks">
          <h2 id="lp-blocks">Reusable blocks</h2>
          <p className="lp-help">
            {appCount} {appCount === 1 ? "app" : "apps"} selected. Each keeps its own source,
            storage and owner.
          </p>
          <ul className="lp-blocks">
            {blockOrder.map((key) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={state.blocks[key]}
                    onChange={(event) =>
                      dispatch({ type: "block", block: key, value: event.target.checked })
                    }
                  />
                  <span>
                    <strong>{blockLabels[key]}</strong>
                    <small>{blockNotes[key]}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="lp-review">
          <h2 id="lp-review">Review a contribution</h2>
          <p className="lp-help">
            Fictional notes from this browser. The owner decides what is public; approving
            one updates the preview on the left.
          </p>
          <ul className="lp-notes">
            {state.contributions.map((note) => (
              <li key={note.id}>
                <div>
                  <strong>{note.label}</strong>
                  <p>{note.message}</p>
                  <span className={`lp-status lp-status-${note.status}`}>{note.status}</span>
                </div>
                <div className="lp-note-actions">
                  <button
                    type="button"
                    className="lp-small"
                    aria-pressed={note.status === "approved"}
                    disabled={note.status === "approved"}
                    onClick={() => dispatch({ type: "review", id: note.id, value: "approved" })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="lp-small secondary"
                    aria-pressed={note.status === "hidden"}
                    disabled={note.status === "hidden"}
                    onClick={() => dispatch({ type: "review", id: note.id, value: "hidden" })}
                  >
                    Hide
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="lp-help">
            Hiding removes it from the public view on the next render. Restoring an older
            version of the app does not republish it.
          </p>
        </section>

        <section aria-labelledby="lp-versions">
          <h2 id="lp-versions">Versions</h2>
          <div className="lp-inline">
            <button type="button" onClick={() => dispatch({ type: "save" })}>
              Save a version
            </button>
            <span className="lp-help">
              {state.revisions.length} saved in this browser
            </span>
          </div>
          {state.revisions.length > 0 && (
            <ul className="lp-versions">
              {[...state.revisions].reverse().map((revision) => (
                <li key={revision.id}>
                  <span>
                    {revision.label} · {revision.project.name || "Untitled"}
                  </span>
                  <button
                    type="button"
                    className="lp-small secondary"
                    onClick={() => dispatch({ type: "restore", revision: revision.id })}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="lp-take">
          <h2 id="lp-take">Take it with you</h2>
          <p className="lp-help">
            The blueprint is the brief your own agent builds from. A preview is not a
            deployment, and this page never deploys anything.
          </p>
          <div className="lp-actions">
            <button type="button" onClick={continueInInit}>
              Continue in Init
            </button>
            <button type="button" className="secondary" onClick={download}>
              Download blueprint
            </button>
            <button type="button" className="secondary" onClick={copyPrompt}>
              Copy agent brief
            </button>
          </div>
          <details className="lp-details">
            <summary>What the blueprint carries</summary>
            <dl className="lp-report">
              <div>
                <dt>Carried</dt>
                <dd>
                  <ul>
                    {exported.carried.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Not carried</dt>
                <dd>
                  <ul>
                    {exported.notCarried.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </details>
          <details className="lp-details">
            <summary>Import a blueprint</summary>
            <p className="lp-help">
              Paste an exported file to check the round trip. Fields the current schema
              cannot represent are listed instead of being dropped quietly.
            </p>
            <label className="lp-field">
              <span>Blueprint JSON</span>
              <textarea
                value={importText}
                rows={4}
                spellCheck={false}
                onChange={(event) => setImportText(event.target.value)}
                placeholder='{"version":2,…}'
              />
            </label>
            <button type="button" className="secondary" onClick={applyImport}>
              Apply blueprint
            </button>
            {importError && <p className="lp-error">{importError}</p>}
            {report && (
              <div className="lp-report-block">
                <p>
                  <strong>Applied:</strong> {report.carried.join(", ")}
                </p>
                <p>
                  <strong>Not applied:</strong> {report.notCarried.join(" ")}
                </p>
              </div>
            )}
          </details>
        </section>

        <p className="lp-message" aria-live="polite" tabIndex={-1} ref={messageRef}>
          {message}
        </p>

        <section aria-labelledby="lp-real" className="lp-real">
          <h2 id="lp-real">What is real here</h2>
          <dl>
            <div>
              <dt>In this sandbox</dt>
              <dd>
                {approvedCount} public {approvedCount === 1 ? "note" : "notes"}, {pendingCount}{" "}
                awaiting review, {state.revisions.length} saved{" "}
                {state.revisions.length === 1 ? "version" : "versions"}, and the settings
                above.
              </dd>
            </div>
            <div>
              <dt>Published or deployed</dt>
              <dd>Nothing. No repository, Worker, database or domain was created.</dd>
            </div>
            <div>
              <dt>Who would own it</dt>
              <dd>
                You, in your own GitHub and Cloudflare accounts, using your chosen agent.
              </dd>
            </div>
          </dl>
          <p className="lp-help">
            <a href="/creator-hub">Open the real Creator Hub</a> ·{" "}
            <a href="https://creator-hub-guestbook.loftwah.com">the live guestbook</a> ·{" "}
            <a href="/demo/connected-apps">the connected-apps walkthrough</a>
          </p>
        </section>
      </div>
    </div>
  );
}
