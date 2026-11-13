import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { PluginAdminExports } from "emdash";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import "./media-admin.css";

type Kind = "image" | "video";

type Model = {
  id: string;
  label: string;
  kind: Kind;
  tier: string;
  maxPromptLength: number;
  maxReferences: number;
  defaultWidth: number;
  defaultHeight: number;
  maxDimension: number | null;
  sizes: string[] | null;
  video: null | {
    durations: number[];
    defaultSeconds: number;
    defaultResolution: string;
    defaultAspectRatio: string;
    formats: { resolution: string; aspectRatio: string; width: number; height: number }[];
    maxReferenceImages: number;
  };
  priceMilliunits: number;
};

type Job = {
  id: string;
  requestId: string;
  kind: Kind;
  state: string;
  prompt: string;
  model: string;
  settings: Record<string, unknown>;
  referencePath: string | null;
  cost: { milliunits: number; label: string };
  output: null | {
    destination?: { computerId?: string; path?: string };
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    costMilliunits?: number;
    printId?: string;
    retryAfterMs?: number;
    error?: string;
  };
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  imported: null | { key: string; sha256: string | null; bytes: number | null; format: string | null };
};

type Status = {
  enabled: boolean;
  host: string;
  installation: string;
  configured: boolean;
  agentConfigured: boolean;
  catalogue: { models: Model[]; checkedAt: string } | null;
  checkedAt: string | null;
  updatedAt: string | null;
  jobs: Job[];
  notes: { enable: string; disable: string };
};

const stateLabel: Record<string, string> = {
  intent: "Recorded · sending",
  pending: "Working",
  completed: "Saved on the studio",
  failed: "Failed",
  refused: "Refused",
  unknown: "Unconfirmed",
};

function cost(milliunits: number) {
  if (!Number.isFinite(milliunits)) return "Unknown";
  if (milliunits === 0) return "US$0";
  const dollars = milliunits / 100_000;
  return "US$" + dollars.toFixed(dollars < 0.1 ? 3 : 2);
}

async function request(body?: Record<string, unknown>) {
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-media/" + (body ? "write" : "read"),
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  return parseApiResponse<{ ok: boolean; data: unknown }>(
    response,
    "Composer could not read the media capability. Nothing was generated.",
  );
}

export function MediaPage() {
  // The server record stays authoritative: an older read cannot replace a newer
  // one after an action or a slow reload.
  const generation = useRef(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [kind, setKind] = useState<Kind>("image");
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(1120);
  const [height, setHeight] = useState(1120);
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("720p");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const apply = useCallback((data: Status) => {
    setStatus(data);
    if (!data.enabled) setConfirmed(false);
  }, []);

  const load = useCallback(async () => {
    const current = generation.current + 1;
    generation.current = current;
    try {
      const reply = await request();
      if (generation.current !== current) return;
      apply((reply.data as { status: Status }).status);
    } catch (error) {
      if (generation.current !== current) return;
      setMessage(error instanceof Error ? error.message : "The panel could not load.");
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(
    () => (status?.catalogue?.models ?? []).filter((entry) => entry.kind === kind),
    [status, kind],
  );
  const model = models.find((entry) => entry.id === modelId) ?? models[0];
  const estimate = model?.priceMilliunits ?? 0;

  useEffect(() => {
    if (!model) return;
    setModelId(model.id);
    setWidth(model.defaultWidth);
    setHeight(model.defaultHeight);
    if (model.video) {
      setDuration(model.video.defaultSeconds);
      setResolution(model.video.defaultResolution);
    }
  }, [model?.id]);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setMessage("");
    try {
      const reply = await request(body);
      const data = reply.data as Record<string, unknown>;
      if (data && typeof data === "object" && "version" in data) apply(data as unknown as Status);
      else if (data && typeof data === "object" && "job" in data) {
        await load();
      } else await load();
      const job = (data as { job?: Job }).job;
      const refusal = (data as { refusal?: { message: string } }).refusal;
      if (refusal) setMessage(refusal.message);
      else if (job?.state === "pending")
        setMessage("The studio is working. You can leave this page; reopening the job continues it.");
      else if (job?.state === "completed")
        setMessage("Saved on the studio. Import it to keep a copy in this app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That action did not complete.");
    } finally {
      setBusy("");
    }
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!model || !confirmed) return;
    await act(
      {
        action: "generate",
        kind,
        model: model.id,
        prompt,
        width,
        height,
        ...(kind === "video" ? { durationSeconds: duration, resolution } : {}),
        ...(reference.trim() ? { referencePath: reference.trim() } : {}),
      },
      "generate",
    );
    setConfirmed(false);
  };

  if (!status)
    return (
      <main className="composer-media">
        <h1>Images &amp; video</h1>
        <p role="status">{message || "Reading the saved capability…"}</p>
      </main>
    );

  const video = model?.video;

  return (
    <main className="composer-media">
      <header>
        <p className="cm-kicker">App Composer · optional capability</p>
        <h1>Images &amp; video</h1>
        <p className="cm-lede">
          Stills, reference variations and short image-to-video clips through the authorised
          Oyster installation. The studio owns its files; this app keeps the job record and a
          copy of anything you deliberately import.
        </p>
        <p className={"cm-state " + (status.enabled ? "is-on" : "is-off")} role="status">
          {status.enabled ? "On" : "Off"}
          <span>
            {status.host ? " · " + status.host.replace("https://", "") : " · no host configured"}
            {status.catalogue ? " · " + status.catalogue.models.length + " models" : ""}
          </span>
        </p>
      </header>

      {message ? (
        <p className="cm-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <section aria-labelledby="switch">
        <h2 id="switch">The switch</h2>
        {!status.enabled ? (
          <>
            <p>{status.notes.enable}</p>
            <div className="cm-actions">
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => void act({ action: "enable", host: status.host }, "enable")}
              >
                {busy === "enable" ? "Checking the host…" : "Enable Images & video"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy !== "" || !status.host}
                onClick={() => void act({ action: "refresh" }, "refresh")}
              >
                Re-check models
              </button>
            </div>
            {!status.configured ? (
              <p className="cm-warn">
                Setup required: this deployment has no Oyster host address or owner key. Add{" "}
                <code>OYSTER_ORIGIN</code> and <code>OYSTER_OWNER_KEY</code> as Worker secrets,
                then enable. A read-only check never generates or buys credit.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p>{status.notes.disable}</p>
            <div className="cm-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy !== ""}
                onClick={() => void act({ action: "disable" }, "disable")}
              >
                Turn off new work
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy !== ""}
                onClick={() => void act({ action: "refresh" }, "refresh")}
              >
                Re-check models
              </button>
            </div>
            <p className="cm-small">
              Last catalogue check {status.checkedAt ? new Date(status.checkedAt).toLocaleString() : "not recorded"}.
              Enabling does not start the studio container; it wakes when a generation needs it.
            </p>
          </>
        )}
      </section>

      {status.enabled && status.catalogue ? (
        <section aria-labelledby="generate">
          <h2 id="generate">Generate</h2>
          <form className="cm-form" onSubmit={generate}>
            <div className="cm-row">
              <label>
                Kind
                <select
                  value={kind}
                  onChange={(event) => {
                    const next = event.target.value as Kind;
                    setKind(next);
                    const first = status.catalogue?.models.find((entry) => entry.kind === next);
                    setModelId(first?.id ?? "");
                    setConfirmed(false);
                  }}
                >
                  <option value="image">Still image</option>
                  <option value="video">Image-to-video clip</option>
                </select>
              </label>
              <label>
                Model
                <select value={model?.id ?? ""} onChange={(event) => setModelId(event.target.value)}>
                  {models.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label} · {cost(entry.priceMilliunits)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="cm-wide">
              Prompt
              <textarea
                value={prompt}
                maxLength={model?.maxPromptLength ?? 2000}
                rows={4}
                required
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setConfirmed(false);
                }}
                placeholder="Describe the frame, materials, light and type."
              />
            </label>
            <div className="cm-row">
              {kind === "image" ? (
                <>
                  <label>
                    Width
                    <input
                      type="number"
                      min={256}
                      max={model?.maxDimension ?? 4096}
                      value={width}
                      onChange={(event) => {
                        setWidth(Number(event.target.value));
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="number"
                      min={256}
                      max={model?.maxDimension ?? 4096}
                      value={height}
                      onChange={(event) => {
                        setHeight(Number(event.target.value));
                        setConfirmed(false);
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Seconds
                    <select
                      value={duration}
                      onChange={(event) => {
                        setDuration(Number(event.target.value));
                        setConfirmed(false);
                      }}
                    >
                      {(video?.durations ?? [5]).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Resolution
                    <select
                      value={resolution}
                      onChange={(event) => {
                        setResolution(event.target.value);
                        setConfirmed(false);
                      }}
                    >
                      {Array.from(new Set((video?.formats ?? []).map((format) => format.resolution))).map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </>
              )}
            </div>
            <label className="cm-wide">
              Reference on the studio Computer (optional)
              <input
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  setConfirmed(false);
                }}
                placeholder="/media/prints/reference.png"
                maxLength={4096}
              />
              <span className="cm-small">
                Use a path the studio already owns. {model?.maxReferences
                  ? "This model accepts up to " + model.maxReferences + " reference images."
                  : "This model does not accept references."}
              </span>
            </label>
            <p className="cm-estimate">
              Estimate <strong>{cost(estimate)}</strong> for this request. The provider charges the
              studio owner&rsquo;s balance; the final cost is the studio&rsquo;s recorded amount.
            </p>
            <label className="cm-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I understand this starts a new, potentially billed generation.
            </label>
            <div className="cm-actions">
              <button type="submit" disabled={!confirmed || busy !== "" || prompt.trim().length < 3}>
                {busy === "generate" ? "Sending…" : kind === "video" ? "Animate the still" : "Create the still"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="jobs">
        <h2 id="jobs">Project jobs</h2>
        {!status.jobs.length ? (
          <p className="cm-small">
            Nothing here yet. Every request records its prompt, model, settings, estimate and
            parent reference before it is sent.
          </p>
        ) : (
          <ul className="cm-jobs">
            {status.jobs.map((job) => (
              <li key={job.id}>
                <div className="cm-job-head">
                  <strong>{job.kind === "video" ? "Clip" : "Still"}</strong>
                  <span className={"cm-badge is-" + job.state}>{stateLabel[job.state] ?? job.state}</span>
                  <span className="cm-small">{new Date(job.createdAt).toLocaleString()}</span>
                </div>
                <p className="cm-prompt">{job.prompt}</p>
                <p className="cm-small">
                  {job.model} · {job.cost.label}
                  {job.referencePath ? " · reference " + job.referencePath : ""}
                  {job.errorCode ? " · " + job.errorCode : ""}
                </p>
                {job.imported ? (
                  <p className="cm-small">
                    Imported copy · {job.imported.bytes ?? 0} bytes ·{" "}
                    <a href={"/media-studio/asset/" + job.imported.key.split("/").pop()}>
                      open the owned file
                    </a>
                  </p>
                ) : null}
                <div className="cm-actions">
                  {job.state === "pending" || job.state === "unknown" ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy !== ""}
                      onClick={() => void act({ action: "reconcile", id: job.id }, "reconcile-" + job.id)}
                    >
                      {busy === "reconcile-" + job.id ? "Checking…" : "Continue this job"}
                    </button>
                  ) : null}
                  {job.state === "completed" && !job.imported ? (
                    <button
                      type="button"
                      disabled={busy !== ""}
                      onClick={() => void act({ action: "import", id: job.id }, "import-" + job.id)}
                    >
                      {busy === "import-" + job.id ? "Importing…" : "Import into this app"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="cm-small">
          Continuing a job reuses its one request identity: a retried save never buys a second
          generation. Turning the capability off keeps every row and file.
        </p>
      </section>

      <section aria-labelledby="agent">
        <h2 id="agent">Agent operations</h2>
        <p>
          The same handlers are available to an authorised agent at{" "}
          <code>POST /api/media-agent</code> with <code>Authorization: Bearer</code> and{" "}
          <code>{"{action:\"status\" | \"generate\" | \"reconcile\" | \"import\"}"}</code>. The agent
          token is <strong>{status.agentConfigured ? "configured" : "not configured"}</strong>; it is
          never rendered here and never enters the browser.
        </p>
        <pre>{`node scripts/media-studio-agent.mjs status\nnode scripts/media-studio-agent.mjs generate --kind image --model @cf/leonardo/lucid-origin --prompt "…"\nnode scripts/media-studio-agent.mjs reconcile --id job_…\nnode scripts/media-studio-agent.mjs import --id job_…`}</pre>
        <p className="cm-small">
          Browser and agent operations share validation, permission, request identity and the
          audit row. Disabling stops both.
        </p>
      </section>
    </main>
  );
}

export const pages: PluginAdminExports["pages"] = { "/media": MediaPage };
