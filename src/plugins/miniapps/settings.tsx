import { useState, type SubmitEvent } from "react";
import { globalAppSettings as appSettings } from "../../lib/app-settings.mjs";
import type { AppID, Snapshot } from "./types";
export function Settings({
  app,
  config,
  change,
  save,
  busy,
}: {
  app: AppID;
  config: Snapshot["config"];
  change: (value: Snapshot["config"]) => void;
  save: (
    fields: Record<string, unknown>,
    failed?: (message: string) => void,
  ) => Promise<boolean>;
  busy: boolean;
}) {
  const [status, setStatus] = useState("");
  const layouts =
    appSettings[app].fields.find((field) => field.key === "layout")?.choices ??
    [];
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("Saving settings…");
    if (await save(values, setStatus)) setStatus("App settings saved.");
  };
  return (
    <form onSubmit={submit} onInput={() => setStatus("")} className="ca-form">
      <h2>Appearance &amp; introduction</h2>
      <p className="ca-muted">
        Saving updates this app’s standalone and composed views.
      </p>
      <label>
        Title
        <input
          name="title"
          disabled={busy}
          maxLength={80}
          required
          value={config.title}
          onChange={(event) => change({ ...config, title: event.target.value })}
        />
      </label>
      <label>
        Introduction
        <textarea
          name="intro"
          disabled={busy}
          maxLength={240}
          rows={3}
          value={config.intro}
          onChange={(event) => change({ ...config, intro: event.target.value })}
        />
      </label>
      <div className="ca-fields">
        <label>
          Theme
          <select
            name="theme"
            disabled={busy}
            value={config.theme}
            onChange={(event) =>
              change({ ...config, theme: event.target.value })
            }
          >
            <option value="daylight">Daylight</option>
            <option value="midnight">Midnight</option>
          </select>
        </label>
        <label>
          Layout
          <select
            name="layout"
            disabled={busy}
            value={config.layout}
            onChange={(event) =>
              change({ ...config, layout: event.target.value })
            }
          >
            {!layouts.some((choice) => choice.value === config.layout) && (
              <option value={config.layout}>{config.layout} (saved)</option>
            )}
            {layouts.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {app === "guestbook" &&
        appSettings.guestbook.fields.some(
          (field) => field.key === "guestAccess",
        ) && (
          <label>
            Guest contributions
            <select
              name="guestAccess"
              disabled={busy}
              value={config.guestAccess ?? "closed"}
              onChange={(event) =>
                change({ ...config, guestAccess: event.target.value })
              }
            >
              <option value="closed">Closed</option>
              <option value="postcards">Postcards with guest code</option>
            </select>
            <span className="ca-muted">
              The public puzzle code hunter2 permits new pending postcards only.
              Guests cannot publish, change settings or enter the owner studio.
              Close this to stop guest submissions.
            </span>
          </label>
        )}
      {app === "showcase" && (
        <details className="ca-disclosure">
          <summary>Profile &amp; social links</summary>
          <p className="ca-muted">
            The title is your profile name and the introduction is its bio.
            Empty links stay out of the public page.
          </p>
          {appSettings.showcase.fields
            .filter(
              (field) =>
                !["title", "intro", "theme", "layout"].includes(field.key),
            )
            .map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  name={field.key}
                  type={field.format === "https-url" ? "url" : "text"}
                  pattern={
                    field.format === "https-url" ? "https://.*" : undefined
                  }
                  maxLength={field.maxLength}
                  disabled={busy}
                  value={config[field.key] ?? field.default ?? ""}
                  onChange={(event) =>
                    change({ ...config, [field.key]: event.target.value })
                  }
                />
              </label>
            ))}
        </details>
      )}
      <button disabled={busy} type="submit">
        Save app settings
      </button>
      <p role="status" aria-live="polite" data-settings-status>
        {status}
      </p>
    </form>
  );
}
