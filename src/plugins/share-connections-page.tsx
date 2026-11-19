import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  shareConnectionStatusSchema,
  type ShareConnectionState,
  type ShareConnectionStatus,
} from "../lib/share-connections";
import {
  SHARE_ITEM_LINK_RECOVERY,
  SHARE_CHANNELS,
  shareItemHref,
  shareItemLinkSelection,
} from "../lib/share-calendar";
import { shareCalendarEntry } from "../lib/share-calendar-entry";
import "./share-connections-page.css";

const base = "/_emdash/api/plugins/composer-stacks/";

// Destination modes come from the shared channel catalogue, so this page cannot
// advertise a destination the calendar does not actually support. X stays out
// of the catalogue: it is an export-only variant, not a selectable account.
const MANUAL_DESTINATIONS = SHARE_CHANNELS.filter(
  (channel) => channel.id !== "bluesky",
)
  .map((channel) => channel.label)
  .join(", ");

const STATE_LABELS: Record<ShareConnectionState, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  invalid_handle: "Invalid handle",
  unavailable: "Unavailable",
};

function errorMessage(raw: unknown, fallback: string) {
  return raw &&
    typeof raw === "object" &&
    "message" in raw &&
    typeof raw.message === "string"
    ? raw.message
    : fallback;
}

async function connectionsCall(
  command?:
    | {
        action: "connect";
        handle: string;
        appPassword: string;
      }
    | { action: "disconnect" },
): Promise<ShareConnectionStatus> {
  const read = !command;
  const response = await apiFetch(
    base + (read ? "shareConnectionsRead" : "shareConnectionsWrite"),
    read
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The Bluesky connection could not be confirmed. Refresh before retrying.",
  );
  const parsed = shareConnectionStatusSchema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The Bluesky connection response could not be validated. Refresh before retrying.",
      ),
    );
  return parsed.data;
}

export function ShareConnectionsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <ShareConnections key={search} search={search} />;
}

function ShareConnections({ search }: { search: string }) {
  // The selected Calendar item affects navigation only.
  const itemReturn = shareItemLinkSelection(search);
  const [status, setStatus] = useState<ShareConnectionStatus>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<
    "" | "connect" | "disconnect" | "refresh"
  >("");
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const busy = pending !== "";

  async function load() {
    setError("");
    setLoading(true);
    setPending("refresh");
    try {
      const next = await connectionsCall();
      if (!alive.current) return;
      setStatus(next);
      setHandle((current) => current || next.handle || "");
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The Bluesky connection could not be checked. Refresh before retrying.",
        );
    } finally {
      if (alive.current) {
        setLoading(false);
        setPending("");
      }
    }
  }

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
    // The status has no scope inputs; it is read once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !status) return;
    const wanted = handle.trim();
    const password = appPassword;
    if (!wanted) {
      setError("Enter the public Bluesky handle you want to connect.");
      return;
    }
    if (!password.trim()) {
      setError(
        "Enter the app password created in Bluesky Settings → App Passwords.",
      );
      return;
    }
    setPending("connect");
    setError("");
    setNotice("");
    try {
      const next = await connectionsCall({
        action: "connect",
        handle: wanted,
        appPassword: password,
      });
      if (!alive.current) return;
      setStatus(next);
      setHandle(next.handle ?? wanted);
      setNotice(
        `Connected @${next.handle ?? wanted}. Composer still requires an exact approval before any post.`,
      );
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The Bluesky connection could not be saved. Refresh before retrying.",
        );
    } finally {
      if (alive.current) {
        // The password is cleared from component state after every attempt, so
        // it is never rendered back. A refused value must be re-entered.
        setAppPassword("");
        setPending("");
      }
    }
  }

  async function disconnect() {
    if (busy || !status) return;
    setPending("disconnect");
    setError("");
    setNotice("");
    try {
      const next = await connectionsCall({ action: "disconnect" });
      if (!alive.current) return;
      setStatus(next);
      setHandle(next.handle ?? "");
      setNotice(
        "Disconnected. The saved public handle and app password were removed. Delivery history and published posts are unchanged.",
      );
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The Bluesky connection could not be removed. Refresh before retrying.",
        );
    } finally {
      if (alive.current) setPending("");
    }
  }

  const identity = status?.identity;
  const canDisconnect = Boolean(
    status && (status.passwordConfigured || status.handleSource === "stored"),
  );

  return (
    <section className="composer-share-connections">
      <div className="shc-heading">
        <div>
          <p className="shc-kicker">Composer · owner connections</p>
          <h1>Share connections</h1>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {loading ? "Checking…" : "Refresh status"}
        </button>
      </div>
      <p className="shc-lede">
        Connect the public Bluesky account Composer may publish to. This page
        verifies the account with Bluesky and stores one app password. It does
        not authorise any post: every send still needs an exact owner approval
        from the Share calendar.
      </p>
      <p className="shc-boundary">
        Composer never asks for your main Bluesky password, a recovery code or a
        session token. The app password is encrypted by EmDash and is never
        displayed again.
      </p>
      <p role="status" aria-live="polite" className="shc-notice">
        {notice}
      </p>
      {error && (
        <div role="alert" className="shc-error">
          <p>{error}</p>
        </div>
      )}
      {itemReturn.state === "requested" && (
        <p>
          <a className="shc-text-link" href={shareItemHref(itemReturn.workspace, itemReturn.itemId)}>
            Return to this Calendar item
          </a>
        </p>
      )}
      {itemReturn.state === "invalid" && (
        <p role="status" className="shc-hint">
          {SHARE_ITEM_LINK_RECOVERY}{" "}
          <a className="shc-text-link" href={shareCalendarEntry(true)}>Open the Share calendar</a>.
        </p>
      )}
      {loading && !status && (
        <p role="status">Checking the saved Bluesky connection…</p>
      )}
      {status && (
        <>
          <section className="shc-card" aria-labelledby="shc-status-heading">
            <div className="shc-card-head">
              <h2 id="shc-status-heading">Connection status</h2>
              <span
                className={`shc-state shc-state-${status.publishing.state}`}
              >
                {STATE_LABELS[status.publishing.state]}
              </span>
            </div>
            <dl className="shc-facts">
              <div>
                <dt>Public handle</dt>
                <dd>
                  {status.handle ? "@" + status.handle : "Not configured"}
                  {status.handleSource === "environment" ? (
                    <span className="shc-source">
                      {" "}
                      · from the server environment
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>App password</dt>
                <dd>
                  {status.passwordConfigured
                    ? "Stored and encrypted"
                    : "Not stored"}
                </dd>
              </div>
              <div>
                <dt>Publishing</dt>
                <dd>{status.publishing.note}</dd>
              </div>
            </dl>
            {identity?.status === "resolved" && identity.handle && (
              <div className="shc-identity">
                {identity.avatar ? (
                  <img
                    src={identity.avatar}
                    alt=""
                    width="48"
                    height="48"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <div>
                  <p>
                    <strong>@{identity.handle}</strong>
                    {identity.displayName ? " · " + identity.displayName : ""}
                  </p>
                  {identity.did && (
                    <p className="shc-did">DID {identity.did}</p>
                  )}
                  {identity.profileUrl && (
                    <a
                      className="shc-text-link"
                      href={identity.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the public profile
                    </a>
                  )}
                </div>
              </div>
            )}
            {identity && identity.status !== "resolved" && (
              <p role="status" className="shc-identity-message">
                {identity.message}
              </p>
            )}
          </section>

          <section className="shc-card" aria-labelledby="shc-modes-heading">
            <h2 id="shc-modes-heading">Destinations</h2>
            <dl className="shc-modes">
              <div>
                <dt>Bluesky · Publish after approval</dt>
                <dd>
                  Confirm the send for the exact approved revision in the{" "}
                  <a
                    className="shc-text-link"
                    href="/_emdash/admin/plugins/composer-stacks/share-calendar"
                  >
                    Share calendar
                  </a>
                  .
                </dd>
              </div>
              <div>
                <dt>X · Export only</dt>
                <dd>
                  Save and copy an artwork caption with its credit and project link.
                  Copy the image alt text separately.
                </dd>
              </div>
              <div>
                <dt>{MANUAL_DESTINATIONS} · Manual</dt>
                <dd>
                  Prepare a caption and link in the calendar for posting in the destination app.
                </dd>
              </div>
            </dl>
          </section>

          <section className="shc-card" aria-labelledby="shc-form-heading">
            <h2 id="shc-form-heading">
              {status.passwordConfigured
                ? "Replace the connection"
                : "Connect Bluesky"}
            </h2>
            <p className="shc-hint">
              Create the app password in{" "}
              <a
                className="shc-text-link"
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bluesky Settings → App Passwords
              </a>
              . Use the exact public account above; an app password for another
              account is refused and nothing is saved.
            </p>
            <form className="shc-form" onSubmit={submit} aria-busy={busy}>
              <div className="shc-field">
                <label htmlFor="shc-handle">Public Bluesky handle</label>
                <input
                  id="shc-handle"
                  name="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  maxLength={253}
                  placeholder="name.bsky.social"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-describedby="shc-handle-hint"
                  required
                />
                <p id="shc-handle-hint" className="shc-hint">
                  {status.handleSource === "environment"
                    ? "This handle currently comes from the server environment. Saving a connection here stores the owner-managed value instead."
                    : "The handle is public configuration, not a secret. Composer shows it exactly as Bluesky resolves it."}
                </p>
              </div>
              <div className="shc-field">
                <label htmlFor="shc-app-password">Bluesky app password</label>
                <input
                  id="shc-app-password"
                  name="appPassword"
                  type="password"
                  value={appPassword}
                  onChange={(event) => setAppPassword(event.target.value)}
                  maxLength={512}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-describedby="shc-password-hint"
                  required
                />
                <p id="shc-password-hint" className="shc-hint">
                  Composer sends this value to Bluesky once to confirm the
                  account, then stores it encrypted. It is never returned to
                  this page or written to a receipt.
                </p>
              </div>
              <div className="shc-actions">
                <button type="submit" className="shc-primary" disabled={busy}>
                  {pending === "connect"
                    ? "Checking with Bluesky…"
                    : status.passwordConfigured
                      ? "Replace connection"
                      : "Connect Bluesky"}
                </button>
                <button
                  type="button"
                  className="shc-danger"
                  onClick={() => void disconnect()}
                  disabled={busy || !canDisconnect}
                >
                  {pending === "disconnect" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
              <p className="shc-hint">
                Disconnect removes the saved handle and app password only. It
                leaves delivery history and anything already posted unchanged.
              </p>
            </form>
          </section>
        </>
      )}
    </section>
  );
}
