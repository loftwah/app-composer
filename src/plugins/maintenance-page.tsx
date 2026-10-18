import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { maintenanceCall } from "./maintenance/api";
import type {
  MaintenanceWorkspace,
  MaintenanceStack,
  MaintenanceCheck,
  PortableGuestbook,
} from "./maintenance/protocol";
import { workspaceSelection } from "./stacks/workspace-scope";
import "./maintenance-page.css";

export function MaintenancePage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Maintenance key={search} search={search} />;
}
const labels = {
  matched: "Matched at check",
  stale: "Saved confirmation differs",
  unavailable: "Not verified",
  pending: "App operation unresolved",
};
const fiveMinutes = 300000;
export function Maintenance({ search }: { search: string }) {
  const [workspace, setWorkspace] = useState<MaintenanceWorkspace>();
  const [stacks, setStacks] = useState<MaintenanceStack[]>([]);
  const [stackId, setStackId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [check, setCheck] = useState<MaintenanceCheck>();
  const [file, setFile] = useState<PortableGuestbook>();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [invalidScope, setInvalidScope] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef(0),
    pending = useRef(false),
    live = useRef(true);
  const selection = useRef<string | undefined>(undefined);
  const stack = stacks.find((value) => value.id === stackId);
  const instance = stack?.instances.find((value) => value.id === instanceId);
  const stale = check
    ? now - Date.parse(check.checkedAt) >= fiveMinutes
    : false;
  const run = async (
    action: "list" | "check" | "export",
    fields: Record<string, string> = {},
  ) => {
    if (pending.current || invalidScope) return;
    pending.current = true;
    const epoch = ++request.current;
    setBusy(true);
    setError("");
    if (action !== "export") {
      setCheck(undefined);
      setFile(undefined);
    }
    try {
      const result = await maintenanceCall(action, {
        ...(selection.current ? { workspace: selection.current } : {}),
        ...fields,
      });
      if (!live.current || request.current !== epoch) return;
      selection.current = result.workspace!.id;
      setWorkspace(result.workspace);
      if (action === "list") {
        const next = result.stacks ?? [];
        setStacks(next);
        setLoaded(true);
        const chosen = next.find((value) => value.id === stackId) ?? next[0];
        setStackId(chosen?.id ?? "");
        setInstanceId(
          chosen?.instances.find((value) => value.id === instanceId)?.id ??
            chosen?.instances[0]?.id ??
            "",
        );
      } else if (action === "check") setCheck(result.check);
      else setFile(result.portable);
      setNow(Date.now());
    } catch (cause) {
      if (live.current && request.current === epoch) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Maintenance could not be confirmed.",
        );
        if (action !== "list") {
          setCheck(undefined);
          setFile(undefined);
        }
      }
    } finally {
      if (live.current && request.current === epoch) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    live.current = true;
    try {
      selection.current = workspaceSelection(search);
      void run("list");
    } catch (cause) {
      setInvalidScope(true);
      setError(
        cause instanceof Error
          ? cause.message
          : "This workspace selection is invalid.",
      );
    }
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      live.current = false;
      pending.current = false;
      request.current++;
      window.clearInterval(timer);
    };
  }, []);
  const fields =
    stack && instance
      ? {
          stack: stack.id,
          instance: instance.id,
          expectedRevision: String(stack.revision),
        }
      : undefined;
  const selectStack = (value: string) => {
    setStackId(value);
    setInstanceId(
      stacks.find((entry) => entry.id === value)?.instances[0]?.id ?? "",
    );
    setCheck(undefined);
    setFile(undefined);
    setError("");
  };
  const download = () => {
    if (
      !file ||
      !workspace ||
      file.source.workspace !== workspace.id ||
      file.source.resource !== instance?.resource
    )
      return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guestbook-approved-" + file.source.resource + ".json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <section className="composer-admin ca-maintenance">
      <header>
        <p className="ca-kicker">Workspace maintenance</p>
        <h1>Keep an approved Guestbook copy.</h1>
        <p>
          Choose a saved Guestbook, check its connection, then prepare approved
          contributions and PNGs. Your saved draft and public page stay as they
          are.
        </p>
      </header>
      <p role="status" aria-live="polite">
        {busy
          ? "Checking the selected workspace…"
          : workspace
            ? `${workspace.name} · ${workspace.role}`
            : "Workspace has not been confirmed."}
      </p>
      {error && (
        <div className="ca-maintenance-error" role="alert">
          <p>{error}</p>
          <p>Your saved stack has not changed.</p>
        </div>
      )}
      <div className="ca-maintenance-actions">
        <button
          type="button"
          disabled={busy || invalidScope}
          onClick={() => void run("list")}
        >
          Refresh saved selections
        </button>
        {workspace && (
          <a
            href={`/_emdash/admin/plugins/composer-stacks/stacks?workspace=${workspace.id}`}
          >
            Open Creator stacks
          </a>
        )}
      </div>
      {loaded && stacks.length === 0 && (
        <p>
          No saved stacks in this workspace. Create one in Creator stacks, then
          apply its saved Guestbook configuration.
        </p>
      )}
      {stacks.length > 0 && (
        <div className="ca-form ca-maintenance-selection">
          <label>
            Saved stack
            <select
              value={stackId}
              disabled={busy}
              onChange={(event) => selectStack(event.target.value)}
            >
              {stacks.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · revision {entry.revision}
                </option>
              ))}
            </select>
          </label>
          <label>
            App instance
            <select
              value={instanceId}
              disabled={busy || !stack?.instances.length}
              onChange={(event) => {
                setInstanceId(event.target.value);
                setCheck(undefined);
                setFile(undefined);
                setError("");
              }}
            >
              {stack?.instances.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !fields ||
              instance?.app !== "guestbook" ||
              !instance.resource
            }
            onClick={() => fields && void run("check", fields)}
          >
            Check current connection
          </button>
        </div>
      )}
      {stack && !stack.instances.length && (
        <p>This stack has no app instances.</p>
      )}
      {instance && (
        <p>
          {instance.app !== "guestbook" ? (
            "This app has no owned-resource maintenance or content portability contract here."
          ) : !instance.resource ? (
            "No app-owned resource has been applied for this saved instance."
          ) : (
            <>
              {instance.label} ·{" "}
              {instance.shared
                ? "Shared with another instance"
                : "Owned by this instance"}{" "}
              ·{" "}
              {check
                ? stale
                  ? "Check expired"
                  : labels[check.outcome]
                : instance.state === "ready"
                  ? "Applied · not checked here"
                  : instance.state === "unknown" ||
                      instance.state === "reserved"
                    ? "Pending app confirmation"
                    : instance.state === "refused"
                      ? "App change refused"
                      : "Not applied"}
            </>
          )}
        </p>
      )}
      {check && (
        <article className="ca-maintenance-check" aria-label="Connection check">
          <h2>
            {stale ? "Check is older than five minutes" : labels[check.outcome]}
          </h2>
          <p>{check.message}</p>
          <p>
            Checked{" "}
            <time dateTime={check.checkedAt}>
              {new Date(check.checkedAt).toLocaleString()}
            </time>
            . This is an observation, not a continuing health guarantee.
          </p>
          {stale && (
            <p>
              Check again before relying on this result or preparing another
              export.
            </p>
          )}
          <details className="ca-disclosure ca-maintenance-identity">
            <summary>Exact connection identity and check coverage</summary>
            <p>
              Saved resource <code>{check.resource}</code>
            </p>
            <div className="ca-maintenance-table">
              <table>
                <caption>Exact connection identity at this check</caption>
                <thead>
                  <tr>
                    <th scope="col">Identity</th>
                    <th scope="col">Saved / expected</th>
                    <th scope="col">Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      "source",
                      "account",
                      "environment",
                      "target",
                      "version",
                    ] as const
                  ).map((key) => (
                    <tr key={key}>
                      <th scope="row">
                        {key === "source"
                          ? "App source"
                          : key === "version"
                            ? "Resource version"
                            : key}
                      </th>
                      <td>
                        <code>{check.expected[key]}</code>
                      </td>
                      <td>
                        {check.actual ? (
                          <code>{check.actual[key]}</code>
                        ) : (
                          "Not verified"
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Configuration revision</th>
                    <td>
                      {check.expected.configuration?.revision ??
                        "None confirmed"}
                    </td>
                    <td>
                      {check.actual?.configuration?.revision ?? "Not verified"}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Configuration digest</th>
                    <td>
                      <code>
                        {check.expected.configuration?.digest ??
                          "None confirmed"}
                      </code>
                    </td>
                    <td>
                      <code>
                        {check.actual?.configuration?.digest ?? "Not verified"}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Configuration source</th>
                    <td>
                      <code>
                        {check.expected.configuration?.source ??
                          "None confirmed"}
                      </code>
                    </td>
                    <td>
                      <code>
                        {check.actual?.configuration?.source ?? "Not verified"}
                      </code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {check.actual && (
              <p>
                Current app controls:{" "}
                {check.actual.visible ? "visible" : "private"}, submissions{" "}
                {check.actual.paused ? "paused" : "not paused"}. Individual
                contribution approval still applies.
              </p>
            )}
            <dl className="ca-maintenance-coverage">
              <div>
                <dt>Worker deployment ID</dt>
                <dd>Unavailable through this app contract</dd>
              </div>
              <div>
                <dt>Media coverage</dt>
                <dd>Not checked by this connection observation</dd>
              </div>
              <div>
                <dt>Metrics and costs</dt>
                <dd>Unavailable here; no budget or capacity guarantee</dd>
              </div>
            </dl>
          </details>
        </article>
      )}
      <article
        className="ca-maintenance-portable"
        aria-label="Approved content portability"
      >
        <h2>Prepare your file.</h2>
        <p>
          Prepare the active Guestbook configuration and up to eight original
          approved contributions with verified PNGs. The file states what is
          included; private items, global owner photos, other apps and
          credentials are excluded.
        </p>
        <p>
          Restoration requires the live original source and fresh private
          identities. Source revocations remain authoritative. This is not
          complete backup or offline disaster recovery; code rollback does not
          restore app data or media.
        </p>
        {workspace?.role === "viewer" && (
          <p>
            Private app exports require an owner or editor. Your viewer access
            can check connection metadata and export stack configuration from
            Creator stacks.
          </p>
        )}
        {check && !check.portabilitySupported && (
          <p>
            The current pinned app has not confirmed support for this
            approved-content export.
          </p>
        )}
        <button
          type="button"
          disabled={
            busy ||
            !fields ||
            workspace?.role === "viewer" ||
            !check ||
            check.outcome !== "matched" ||
            stale ||
            !check.portabilitySupported
          }
          onClick={() => fields && void run("export", fields)}
        >
          Prepare approved-content file
        </button>
        {file && (
          <div role="status">
            <p>
              {file.coverage.included} of {file.coverage.approvedOriginals}{" "}
              eligible original approved contributions included.{" "}
              {file.coverage.complete
                ? "Complete for this bounded original-approved selection."
                : "Partial coverage: some contributions or media are not included."}
            </p>
            <p>
              Exported{" "}
              <time dateTime={file.exportedAt}>
                {new Date(file.exportedAt).toLocaleString()}
              </time>
              . {file.rights}
            </p>
            <button type="button" onClick={download}>
              Download approved-content JSON
            </button>
          </div>
        )}
      </article>
    </section>
  );
}
