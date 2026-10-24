import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  resourceInventory,
  type InventoryResource,
  type ResourceInventorySnapshot,
} from "../lib/resource-inventory-contract";
import { fictionalResourceInventory } from "../lib/resource-inventory-example";
import { workspaceSelection, confirmWorkspace } from "./stacks/workspace-scope";
import "./resource-inventory-page.css";

const STATUS: Record<InventoryResource["status"], string> = {
  "in-step": "In step",
  stale: "Check is old",
  attention: "Needs attention",
  unknown: "Unknown",
  unbound: "Not in a stack",
};
const PROVIDER_TAGS: Record<
  InventoryResource["providerTags"]["state"],
  string
> = {
  unverified: "Not verified",
  match: "Match",
  partial: "Partly differ",
  mismatch: "Do not match",
};
const ACTION: Record<string, string> = {
  create: "create",
  stage: "stage settings",
  activate: "activate settings",
  moderate: "moderate content",
  control: "change visibility",
};
const utc = (value: string) =>
  new Date(value).toLocaleString("en-AU", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " UTC";

export function ResourceInventoryPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <ResourceInventory key={search} search={search} />;
}

export function ResourceInventory({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<ResourceInventorySnapshot>();
  const [example, setExample] = useState<ResourceInventorySnapshot>();
  const [busy, setBusy] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const pending = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const invalid = useRef(false);

  const load = useCallback(async () => {
    if (pending.current || invalid.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const epoch = ++generation.current;
    try {
      const params = new URLSearchParams({
        action: "list",
        ...(selection.current ? { workspace: selection.current } : {}),
      });
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/resourcesRead?" + params,
        { cache: "no-store", signal: AbortSignal.timeout(20000) },
      );
      const raw = await parseApiResponse<unknown>(
        response,
        "Resource inventory could not be loaded. Refresh before relying on it.",
      );
      if (raw && typeof raw === "object" && "ok" in raw && raw.ok === false)
        throw Error(
          "message" in raw && typeof raw.message === "string"
            ? raw.message
            : "Resource inventory is unavailable.",
        );
      const result = resourceInventory.parse(raw);
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
            : "Resource inventory is unavailable.",
        );
      }
    } finally {
      if (active.current && generation.current === epoch) {
        pending.current = false;
        setBusy(false);
      }
    }
  }, []);

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
  }, [load]);

  const toggleExample = async (checked: boolean) => {
    if (!checked) {
      setExample(undefined);
      return;
    }
    setLoadingExample(true);
    try {
      const built = await fictionalResourceInventory();
      if (active.current) setExample(built);
    } finally {
      if (active.current) setLoadingExample(false);
    }
  };

  return (
    <div className="composer-resources" aria-busy={busy}>
      <div className="ri-heading">
        <div>
          <h1>App resources</h1>
          <p>
            Every app resource Composer recorded for this workspace, the saved
            stack that uses it, the settings Composer expects and the last
            app-confirmed operation. Read-only, and separate from the public
            Resources library.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || invalid.current}
          onClick={() => void load()}
        >
          Refresh inventory
        </button>
      </div>
      <div className="ri-scope">
        {snapshot ? (
          <>
            Workspace <strong>{snapshot.workspace.name}</strong> ·{" "}
            {snapshot.workspace.role} · inventory read {utc(snapshot.readAt)}
            <details>
              <summary>Selected account, environment and service</summary>
              <dl className="ri-facts">
                <dt>Account</dt>
                <dd>
                  <code>{snapshot.installation.account}</code>
                </dd>
                <dt>Environment</dt>
                <dd>
                  <code>{snapshot.installation.environment}</code>
                </dd>
                <dt>App service binding</dt>
                <dd>
                  <code>{snapshot.installation.service}</code>
                </dd>
                <dt>App target</dt>
                <dd>
                  <code>{snapshot.installation.target}</code>
                </dd>
                <dt>Pinned app source</dt>
                <dd>
                  {snapshot.installation.appSource ? (
                    <code>{snapshot.installation.appSource}</code>
                  ) : (
                    "Not recorded"
                  )}
                </dd>
              </dl>
              <p className="ri-muted">
                The service binding and owner key are{" "}
                {snapshot.installation.bindingAvailable ? "present" : "missing"}{" "}
                and{" "}
                {snapshot.installation.credentialPresent
                  ? "present"
                  : "missing"}{" "}
                by reference only. This screen makes no app request.
              </p>
            </details>
          </>
        ) : (
          "Confirming the selected workspace…"
        )}
      </div>
      {error && (
        <p className="ri-error" role="alert">
          {error}
        </p>
      )}
      <p className="ri-status" role="status">
        {busy ? "Reading this workspace’s recorded resources…" : ""}
      </p>
      <p className="ri-boundary">
        This view never creates, changes, tags or retires a Cloudflare resource,
        and it sends no app request. Provider tags are shown as unverified
        unless a verified snapshot was recorded; tags are not ownership, access
        or billing authority. The Cloudflare dashboard and API remain the
        authority for provider state.
      </p>
      {snapshot && <ProviderBlock snapshot={snapshot} />}
      {snapshot && <Counts snapshot={snapshot} />}
      {snapshot && snapshot.atLimit && (
        <p className="ri-muted" role="note">
          Showing the {snapshot.resources.length} most recently recorded
          resources. Older records stay in Creator stacks; this screen is
          bounded on purpose.
        </p>
      )}
      {snapshot && snapshot.resources.length === 0 && (
        <section className="ri-empty" aria-labelledby="ri-empty-title">
          <h2 id="ri-empty-title">No app resources recorded yet</h2>
          <p>
            A resource appears here after you apply an owned Guestbook instance
            in Creator stacks. Nothing has been created, and this page is not
            showing provider inventory it has not read.
          </p>
          <a
            href={
              "/_emdash/admin/plugins/composer-stacks/stacks?" +
              new URLSearchParams({ workspace: snapshot.workspace.id })
            }
          >
            Open Creator stacks
          </a>
        </section>
      )}
      {snapshot?.resources.map((resource) => (
        <ResourceCard
          key={resource.id}
          resource={resource}
          workspace={snapshot.workspace.id}
        />
      ))}
      <section className="ri-example" aria-labelledby="ri-example-title">
        <div className="ri-heading">
          <div>
            <h2 id="ri-example-title">Fictional walkthrough</h2>
            <p>
              A deterministic local example for the drift, unknown, stale and
              unbound states. It is not this workspace and it is not a
              Cloudflare read.
            </p>
          </div>
          <label className="ri-check">
            <input
              type="checkbox"
              checked={Boolean(example)}
              disabled={loadingExample}
              onChange={(event) => void toggleExample(event.target.checked)}
            />
            Show the fictional example
          </label>
        </div>
        {loadingExample && <p role="status">Building the fictional example…</p>}
        {example && (
          <>
            <p className="ri-synthetic" role="note">
              Fictional example · invented workspace, account, tags and
              operations. Nothing here describes this installation.
            </p>
            <ProviderBlock snapshot={example} />
            <Counts snapshot={example} />
            {example.resources.map((resource) => (
              <ResourceCard
                key={"example-" + resource.id}
                resource={resource}
                workspace={example.workspace.id}
                synthetic
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function ProviderBlock({ snapshot }: { snapshot: ResourceInventorySnapshot }) {
  return (
    <section
      className={
        snapshot.synthetic ? "ri-provider ri-provider-synthetic" : "ri-provider"
      }
      aria-labelledby={
        snapshot.synthetic ? "ri-provider-example" : "ri-provider-real"
      }
    >
      <h2 id={snapshot.synthetic ? "ri-provider-example" : "ri-provider-real"}>
        Provider tags:{" "}
        {snapshot.provider.state === "unverified"
          ? "not verified"
          : "fictional snapshot"}
      </h2>
      <p>{snapshot.provider.note}</p>
      {snapshot.provider.verifiedAt && (
        <p className="ri-muted">
          Snapshot time {utc(snapshot.provider.verifiedAt)} ·{" "}
          {snapshot.provider.tags.length} account-level tag(s) recorded.
        </p>
      )}
    </section>
  );
}

function Counts({ snapshot }: { snapshot: ResourceInventorySnapshot }) {
  const { counts } = snapshot;
  return (
    <dl className="ri-counts" aria-label="Resource status counts">
      <div>
        <dt>In step</dt>
        <dd>{counts.inStep}</dd>
      </div>
      <div>
        <dt>Check is old</dt>
        <dd>{counts.stale}</dd>
      </div>
      <div>
        <dt>Needs attention</dt>
        <dd>{counts.attention}</dd>
      </div>
      <div>
        <dt>Unknown</dt>
        <dd>{counts.unknown}</dd>
      </div>
      <div>
        <dt>Not in a stack</dt>
        <dd>{counts.unbound}</dd>
      </div>
    </dl>
  );
}

export function ResourceCard({
  resource,
  workspace,
  synthetic = false,
}: {
  resource: InventoryResource;
  workspace: string;
  synthetic?: boolean;
}) {
  const heading = synthetic
    ? "ri-example-" + resource.id
    : "ri-resource-" + resource.id;
  return (
    <section
      className={"ri-resource ri-status-" + resource.status}
      aria-labelledby={heading}
    >
      <div className="ri-heading">
        <h2 id={heading}>
          {resource.labels.instance ?? "Guestbook resource"}
          <span className="ri-muted">
            {" "}
            · Guestbook {resource.id.slice(0, 8)}
          </span>
        </h2>
        <strong className="ri-badge">{STATUS[resource.status]}</strong>
      </div>
      <dl className="ri-facts">
        <dt>Composer labels</dt>
        <dd>
          {resource.labels.workspace}
          {resource.labels.stack ? " · " + resource.labels.stack : ""}
          {resource.labels.instance ? " · " + resource.labels.instance : ""}
        </dd>
        <dt>Account / environment</dt>
        <dd>
          <code>{resource.account}</code> · <code>{resource.environment}</code>
        </dd>
        <dt>App target</dt>
        <dd>
          <code>{resource.target}</code>
        </dd>
        <dt>Recorded state</dt>
        <dd>
          {resource.state} · app version {resource.version} · recorded{" "}
          {utc(resource.recordedAt)}
        </dd>
        <dt>Last confirmed app operation</dt>
        <dd>
          {resource.lastConfirmedOperation
            ? `${ACTION[resource.lastConfirmedOperation.action]} · ${utc(resource.lastConfirmedOperation.at)}`
            : "None recorded"}
        </dd>
        <dt>Confirmed configuration</dt>
        <dd>
          {resource.configuration ? (
            <>
              revision {resource.configuration.revision} · source{" "}
              <code>{resource.configuration.source.slice(0, 8)}</code> · digest{" "}
              <code>{resource.configuration.digest.slice(0, 12)}</code>
            </>
          ) : (
            "None recorded"
          )}
        </dd>
      </dl>
      {resource.unfinishedOperation && (
        <p className="ri-callout" role="note">
          An {ACTION[resource.unfinishedOperation.action]} operation is{" "}
          <strong>{resource.unfinishedOperation.state}</strong> since{" "}
          {utc(resource.unfinishedOperation.at)}. Check it in Creator stacks
          before applying or publishing again.
        </p>
      )}
      {resource.findings.length > 0 && (
        <ul className="ri-findings">
          {resource.findings.map((finding, index) => (
            <li
              key={finding.code}
              className={"ri-finding ri-finding-" + finding.severity}
            >
              <strong>{finding.title}</strong>
              <p>{finding.detail}</p>
              {index === 0 && finding.action && (
                <a href={finding.action.href}>{finding.action.label}</a>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3>Current and expected configuration</h3>
      {resource.expected.basis === "saved-draft" && resource.expected.values ? (
        resource.differences.length > 0 ? (
          <div
            className="ri-table"
            role="region"
            aria-label="Configuration differences"
            tabIndex={0}
          >
            <table>
              <caption>
                {resource.differences.length} declared field(s) differ from the
                saved stack · {resource.expected.stackName} ·{" "}
                {resource.expected.instanceLabel}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Confirmed</th>
                  <th scope="col">Saved</th>
                </tr>
              </thead>
              <tbody>
                {resource.differences.map((difference) => (
                  <tr key={difference.field}>
                    <th scope="row">{difference.field}</th>
                    <td>{difference.current ?? "Unset"}</td>
                    <td>{difference.expected ?? "Unset"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ri-muted">
            The saved settings match the app-confirmed configuration for{" "}
            {resource.expected.stackName} · {resource.expected.instanceLabel}.
          </p>
        )
      ) : (
        <p className="ri-muted">
          {resource.expected.note ??
            "There is no saved stack setting to compare against."}
        </p>
      )}
      <details className="ri-tags">
        <summary>
          Provider tags · {PROVIDER_TAGS[resource.providerTags.state]}
        </summary>
        <div className="ri-tag-columns">
          <div>
            <h4>Composer labels</h4>
            <dl className="ri-facts">
              <dt>Workspace</dt>
              <dd>{resource.labels.workspace}</dd>
              <dt>Stack</dt>
              <dd>{resource.labels.stack ?? "Unbound"}</dd>
              <dt>Instance</dt>
              <dd>{resource.labels.instance ?? "Unbound"}</dd>
              <dt>App</dt>
              <dd>{resource.labels.app}</dd>
              <dt>Environment</dt>
              <dd>{resource.labels.environment}</dd>
            </dl>
          </div>
          <div>
            <h4>Expected provider tags</h4>
            <ul className="ri-tag-list">
              {resource.providerTags.expected.map((tag) => (
                <li key={tag.key}>
                  <code>{tag.key}</code> = <code>{tag.value || "(empty)"}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Recorded provider tags</h4>
            {resource.providerTags.recorded === null ? (
              <p className="ri-muted">
                Not verified. No provider tag snapshot was recorded for this
                account, so nothing is assumed either way.
              </p>
            ) : resource.providerTags.recorded.length === 0 ? (
              <p className="ri-muted">
                A recorded read found no tags on this resource.
              </p>
            ) : (
              <ul className="ri-tag-list">
                {resource.providerTags.recorded.map((tag) => (
                  <li key={tag.key}>
                    <code>{tag.key}</code> = <code>{tag.value}</code>
                  </li>
                ))}
              </ul>
            )}
            {resource.providerTags.missing.length > 0 && (
              <p className="ri-muted">
                Missing expected keys:{" "}
                {resource.providerTags.missing.join(", ")}
              </p>
            )}
            {resource.providerTags.unexpected.length > 0 && (
              <p className="ri-muted">
                Different or unrelated keys, preserved and never overwritten:{" "}
                {resource.providerTags.unexpected.join(", ")}
              </p>
            )}
          </div>
        </div>
      </details>
      <h3>Saved stacks using this resource</h3>
      {resource.bindings.length === 0 ? (
        <p className="ri-muted">
          No saved stack references this resource.{" "}
          <a
            href={
              "/_emdash/admin/plugins/composer-stacks/stacks?" +
              new URLSearchParams({ workspace })
            }
          >
            Open Creator stacks
          </a>
        </p>
      ) : (
        <ul className="ri-bindings">
          {resource.bindings.map((binding) => (
            <li key={binding.stackId + ":" + binding.instanceId}>
              <strong>{binding.stackName}</strong> · {binding.instanceLabel} ·{" "}
              {binding.mode === "own"
                ? "independently configured"
                : "reuses another instance"}{" "}
              · {binding.stackStatus}
            </li>
          ))}
        </ul>
      )}
      <p className="ri-muted">
        This card states Composer’s records and the settings it would expect. It
        does not read the Cloudflare account, app content or billing.
      </p>
    </section>
  );
}
