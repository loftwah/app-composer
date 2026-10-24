import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  connectionSnapshot,
  type ConnectionSnapshot,
} from "../lib/connection-contract";
import { workspaceSelection, confirmWorkspace } from "./stacks/workspace-scope";
import "./connections-page.css";

const labels = {
  "not-configured": "Reference missing",
  "metadata-only": "Not verified",
  "read-verified": "Owned-resource read verified",
  "needs-attention": "Needs attention",
  unknown: "Check outcome unknown",
};
export function ConnectionsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Connections key={search} search={search} />;
}
export function Connections({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    pending = useRef(false),
    invalid = useRef(false),
    generation = useRef(0);
  const selection = useRef<string | undefined>(undefined);
  async function load(check = false) {
    if (pending.current || invalid.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const epoch = ++generation.current;
    try {
      const params = new URLSearchParams({
        action: check ? "check" : "list",
        ...(selection.current ? { workspace: selection.current } : {}),
        ...(check ? { connection: "guestbook-owner" } : {}),
      });
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/connectionsRead?" + params,
        { cache: "no-store", signal: AbortSignal.timeout(20000) },
      );
      const raw = await parseApiResponse<unknown>(
        response,
        "Connection metadata could not be loaded. Refresh before another check.",
      );
      if (raw && typeof raw === "object" && "ok" in raw && raw.ok === false)
        throw Error(
          "message" in raw && typeof raw.message === "string"
            ? raw.message
            : "Connection metadata is unavailable.",
        );
      const result = connectionSnapshot.parse(raw);
      confirmWorkspace(selection.current, result.workspace.id);
      if (!active.current || generation.current !== epoch) return;
      selection.current = result.workspace.id;
      setSnapshot(result);
    } catch (cause) {
      if (active.current && generation.current === epoch) {
        setSnapshot(undefined);
        setError(
          cause instanceof Error
            ? cause.message
            : "Connection metadata is unavailable.",
        );
      }
    } finally {
      if (active.current && generation.current === epoch) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    active.current = true;
    try {
      selection.current = workspaceSelection(search);
      void load();
    } catch (cause) {
      invalid.current = true;
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose a workspace from Workspace access.",
      );
    }
    return () => {
      active.current = false;
      generation.current++;
      pending.current = false;
    };
  }, []);
  return (
    <div className="composer-connections" aria-busy={busy}>
      <div className="cn-heading">
        <div>
          <h1>Connections</h1>
          <p>
            See which server references are available, what uses them and what
            was actually checked.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || invalid.current}
          onClick={() => void load()}
        >
          Refresh metadata
        </button>
      </div>
      <div className="cn-scope">
        {snapshot ? (
          <>
            Workspace <strong>{snapshot.workspace.name}</strong> ·{" "}
            {snapshot.workspace.role} ·{" "}
            <strong>{snapshot.installation.environment}</strong>
            <details>
              <summary>Selected account and metadata time</summary>
              <code>{snapshot.installation.account}</code>
              <p>
                Metadata read{" "}
                {new Date(snapshot.metadataReadAt).toLocaleString("en-AU", {
                  timeZone: "UTC",
                })}{" "}
                UTC. This is not a provider health check.
              </p>
            </details>
          </>
        ) : (
          "Confirming the selected workspace…"
        )}
      </div>
      {error && (
        <p className="cn-error" role="alert">
          {error}
        </p>
      )}
      <p className="cn-status" role="status">
        {busy ? "Reading this workspace’s supported connection…" : ""}
      </p>
      <p className="cn-boundary">
        Hosting manages these references. This screen does not accept or reveal
        key values, change access, rotate credentials or disconnect a provider.
        Expiry and full provider permissions are unknown.
      </p>
      {snapshot?.connections.map((connection) => (
        <section
          className="cn-connection"
          key={connection.id}
          aria-labelledby={`connection-${connection.id}`}
        >
          <div className="cn-heading">
            <h2 id={`connection-${connection.id}`}>{connection.name}</h2>
            <strong>{labels[connection.status]}</strong>
          </div>
          <p>{connection.note}</p>
          <dl className="cn-facts">
            <dt>Server references</dt>
            <dd>
              {connection.credentialReferences.map((reference) => (
                <code key={reference}>{reference}</code>
              ))}
            </dd>
            <dt>Availability</dt>
            <dd>
              {connection.bindingAvailable
                ? "Adapter available"
                : "Service binding missing"}{" "}
              ·{" "}
              {connection.credentialPresent
                ? "Key reference present"
                : "Key reference missing"}
            </dd>
            <dt>Fixed destination</dt>
            <dd>
              <code>{connection.target}</code>
            </dd>
            <dt>Verified capability</dt>
            <dd>
              {connection.verifiedCapabilities.length
                ? "Read one owned resource at its exact reviewed source"
                : "None verified by this view"}
            </dd>
            <dt>Last read check</dt>
            <dd>
              {connection.checkedAt
                ? `${new Date(connection.checkedAt).toLocaleString("en-AU", { timeZone: "UTC" })} UTC · ${connection.checkOutcome}`
                : "Not checked"}
              {connection.source && (
                <p>
                  Matched source <code>{connection.source}</code>
                </p>
              )}
            </dd>
            <dt>Credential expiry</dt>
            <dd>Unknown</dd>
          </dl>
          {connection.id === "guestbook-owner" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(true)}
            >
              Check an owned visitor-book read
            </button>
          )}
          <details>
            <summary>What uses this connection?</summary>
            <ul>
              {connection.declaredUse.map((use) => (
                <li key={use}>{use}</li>
              ))}
            </ul>
            {!connection.dependencies.available ? (
              <p>
                Saved dependencies could not be read. Unavailable is not an
                empty dependency list.
              </p>
            ) : connection.dependencies.items.length ? (
              <ul>
                {connection.dependencies.items.map((item, index) => (
                  <li key={`${item.href}:${index}`}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No matching saved dependencies were found in the checked
                records. This does not inventory arbitrary application code.
              </p>
            )}
            {connection.dependencies.atLimit && (
              <p>
                Only the first 50 matching dependencies are shown. Inspect the
                owning screens before changing a connection.
              </p>
            )}
            <p>
              The current two native workflow recipes use local records and have
              no external credential dependency.
            </p>
          </details>
        </section>
      ))}
      <section className="cn-manage">
        <h2>Set up, replace or disconnect</h2>
        <p>
          Use this project’s hosting-managed secret and service bindings through
          its existing guarded release path. Review dependencies first, validate
          the replacement against the intended account/environment, then check
          the consumer again. Removing a Composer reference and revoking a
          provider credential are separate operations.
        </p>
        <p>
          Cloudflare secret put/delete commands can immediately deploy a Worker.
          This installation requires the established version-aware release
          guard; do not bypass it with a copied standalone command.
        </p>
        <a href="/prompts#connections">Prepare the connection request</a>
        <details>
          <summary>Local configuration and safe examples</summary>
          <p>
            A local file stores secrets as plain text. Keep it out of Git,
            shared folders and screenshots; a process or agent that can read the
            file can read its values. These examples contain placeholders only,
            and this page creates no file.
          </p>
          <pre>
            {
              'GUESTBOOK_OWNER_TOKEN="<set-locally-never-share>"\nRESEND_API_KEY="<set-locally-never-share>"'
            }
          </pre>
          <p>
            Choose .dev.vars or the .env family beside Wrangler configuration. A
            selected .dev.vars.&lt;environment&gt; replaces .dev.vars and
            excludes the .env family. Both file patterns are ignored by this
            repository.
          </p>
          <p>
            Verified installed Wrangler 4.143.1 .env precedence:
            environment-local → environment → local → base. Its implementation
            currently differs from the official page’s middle-file ordering; use
            a single local file to avoid an ambiguous overlap. This is a
            local-loading rule, not this running Worker’s configuration or a
            statement about Vite build-time variables.
          </p>
          <p>
            Keep actual secret values out of Vite import.meta.env, client
            bundles, prompts and specifications. Production uses hosting
            secrets. Preview selects its environment at build time and retains
            separate resources and absent production service bindings.
          </p>
          <a href="https://developers.cloudflare.com/workers/configuration/secrets/">
            Cloudflare secret and local-loading reference
          </a>
          <a href="https://docs.emdashcms.com/deployment/secrets/">
            EmDash secret guidance
          </a>
        </details>
        <details>
          <summary>Basic Auth and optional secret managers</summary>
          <p>
            No Basic Auth or external vault adapter is qualified here. A future
            supported request must bind HTTPS credentials to one explicit
            destination, use a dedicated limited account and never forward them
            across redirects. Basic Auth cannot replace or bypass admin
            admission or MFA.
          </p>
          <p>
            An .env file loads local configuration; Basic Auth authenticates a
            request; a secret manager stores and controls secrets. A personal
            password vault is not automatically a service-account secret-manager
            integration. No additional account or subscription is required by
            this view.
          </p>
        </details>
      </section>
    </div>
  );
}
