import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  memberSession,
  sameAccount,
  downloadJson,
  type MemberSession,
} from "./members/api";
import { decodePlatformList } from "../plugins/platform/protocol";
import {
  platformObservation,
  inspectPlatformReport,
  type PlatformAssessment,
} from "../../lib/get-ready/platform.mjs";
import "./ready-platform.css";

const setup = z
  .object({
    target: z
      .object({
        account: z.string().max(80),
        environment: z.string().max(40),
        url: z.string().max(250),
      })
      .strict(),
    existingStacks: z.number().int().min(0).max(1000000),
    managed: z.boolean(),
    canConfigurePolicy: z.boolean().optional(),
  })
  .strict();
const unavailable =
  "Sign in with EmDash, then check again. Your account needs current workspace access; an invitation alone does not grant it.";

async function confirmSource(source: string | null) {
  const response = await fetch("/api/build.json", {
    cache: "no-store",
    redirect: "error",
  });
  const identity = response.ok ? await response.json() : null;
  if (
    !identity ||
    identity.app !== "app-composer" ||
    !source ||
    identity.commit !== source
  )
    throw Error(
      "The installation changed since this page opened. Reload Get Ready before checking its current setup.",
    );
}

async function currentPlatform(workspace: string) {
  const query = new URLSearchParams({ action: "list", workspace });
  const options = { cache: "no-store", redirect: "error" } as const;
  let response = await apiFetch(
    "/_emdash/api/plugins/composer-members/platformRead?" + query,
    options,
  );
  // Compatibility with the first platform release. A denial never triggers
  // another identity or route; only an absent endpoint uses the older reader.
  if (response.status === 404)
    response = await apiFetch(
      "/_emdash/api/plugins/composer-stacks/platformRead?" + query,
      options,
    );
  const raw = await parseApiResponse<unknown>(response, unavailable);
  const snapshot = decodePlatformList(raw);
  if (snapshot.workspace.id !== workspace)
    throw Error(
      "The server returned another workspace. Select the intended team and check again.",
    );
  const extra =
    raw && typeof raw === "object" && "setup" in raw
      ? setup.parse(raw.setup)
      : undefined;
  if (extra && extra.target.url !== location.origin + "/guestbook")
    throw Error(
      "The reported app connection belongs to another installation. Ask the operator to inspect it.",
    );
  return { ...snapshot, ...(extra ? { setup: extra } : {}) };
}

export default function ReadyPlatform({
  workspace,
  invalidSelection = false,
  source,
}: {
  workspace?: string;
  invalidSelection?: boolean;
  source: string | null;
}) {
  const [account, setAccount] = useState<MemberSession>();
  const [selected, setSelected] = useState(workspace ?? "");
  const [assessment, setAssessment] = useState<PlatformAssessment>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(
    "Check your signed-in workspace to see its next setup step.",
  );
  const pending = useRef(false),
    live = useRef(true),
    generation = useRef(0);
  const observedAccount = useRef<MemberSession | undefined>(undefined);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!assessment || assessment.stale) return;
    const timer = window.setTimeout(
      () =>
        setAssessment((current) =>
          current ? inspectPlatformReport(current.report) : undefined,
        ),
      Math.max(
        1,
        Date.parse(assessment.report.checkedAt) + 300001 - Date.now(),
      ),
    );
    return () => window.clearTimeout(timer);
  }, [assessment]);
  const check = async () => {
    if (pending.current || invalidSelection) return;
    pending.current = true;
    const epoch = ++generation.current;
    setBusy(true);
    setError("");
    setAssessment(undefined);
    setStatus("Checking your current session and workspace…");
    try {
      const [before] = await Promise.all([
        memberSession(),
        confirmSource(source),
      ]);
      if (!live.current || epoch !== generation.current) return;
      if (
        observedAccount.current &&
        !sameAccount(before, observedAccount.current)
      ) {
        setAccount(before);
        setSelected("");
        observedAccount.current = before;
        throw Error(
          "The signed-in account changed. Choose its intended workspace and check again.",
        );
      }
      observedAccount.current = before;
      setAccount(before);
      if (!selected) {
        setStatus(
          before.workspaces.length
            ? "Choose the team you want to prepare, then check its current setup."
            : "Accept your intended workspace invitation in My apps before preparing its platform.",
        );
        return;
      }
      if (!before.workspaces.some((team) => team.id === selected))
        throw Error(
          "This account does not have current access to the selected workspace. Choose an authorised team; the selection has not been replaced.",
        );
      const snapshot = await currentPlatform(selected);
      const [after] = await Promise.all([
        memberSession(),
        confirmSource(source),
      ]);
      if (!live.current || epoch !== generation.current) return;
      if (
        !sameAccount(before, after) ||
        !after.workspaces.some(
          (team) =>
            team.id === selected && team.role === snapshot.workspace.role,
        )
      )
        throw Error(
          "The account or workspace access changed during the check. Refresh your access before continuing.",
        );
      const report = platformObservation({
        origin: location.origin,
        source,
        operator: after.operator,
        snapshot,
      });
      setAccount(after);
      observedAccount.current = after;
      setAssessment(inspectPlatformReport(report));
      setStatus(
        "Current workspace observed. Continue with the protected action below.",
      );
    } catch (cause) {
      if (live.current && epoch === generation.current) {
        setError(cause instanceof Error ? cause.message : unavailable);
        setStatus(
          "Setup could not be confirmed. Existing applications and saved requests are unchanged.",
        );
      }
    } finally {
      if (live.current && epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const report = assessment?.report;
  const native =
    "/_emdash/admin/plugins/composer-stacks/platform?" +
    new URLSearchParams({ workspace: selected });
  const member =
    "/me?" + new URLSearchParams({ view: "platform", workspace: selected });
  const nextHref =
    assessment?.next.id === "adoption"
      ? "/people"
      : report?.operator
        ? native
        : member;
  return (
    <section
      className="ready-platform"
      aria-labelledby="platform-check-heading"
      aria-busy={busy}
    >
      <h2 id="platform-check-heading">Check your team’s setup.</h2>
      <p>
        Use your current EmDash session to inspect the selected team, its
        standing rules and its configured app adapter. Then continue with the
        action that is available to you.
      </p>
      {invalidSelection ? (
        <p role="alert">
          The workspace address is invalid or repeated.{" "}
          <a href="/ready?profile=platform">Clear this selection</a> before
          checking; no team has been substituted.
        </p>
      ) : (
        <>
          {account && (
            <label className="ready-platform-team">
              Team
              <select
                value={selected}
                disabled={busy}
                onChange={(event) => {
                  const team = event.target.value;
                  setSelected(team);
                  setAssessment(undefined);
                  setError("");
                  setStatus(
                    "Team changed. Check its current setup before continuing.",
                  );
                  const url = new URL(location.href);
                  url.searchParams.delete("workspace");
                  if (team) url.searchParams.set("workspace", team);
                  history.replaceState(history.state, "", url);
                }}
              >
                <option value="">Choose a workspace</option>
                {selected &&
                  !account.workspaces.some((team) => team.id === selected) && (
                    <option value={selected}>
                      Selected workspace unavailable
                    </option>
                  )}
                {account.workspaces.map((team) => (
                  <option value={team.id} key={team.id}>
                    {team.name} · {team.role}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void check()}>
              {busy
                ? "Checking workspace…"
                : account
                  ? "Check current setup"
                  : "Check my signed-in access"}
            </button>
            <a
              href={
                "/_emdash/admin/login?" +
                new URLSearchParams({
                  redirect:
                    "/ready?" +
                    new URLSearchParams({
                      profile: "platform",
                      ...(selected ? { workspace: selected } : {}),
                    }),
                })
              }
            >
              Sign in with EmDash
            </a>
            <a href="/me">My apps and invitations</a>
          </div>
        </>
      )}
      <p role="status" className="small">
        {status}
      </p>
      {error && <p role="alert">{error}</p>}
      {assessment && report && (
        <div className="ready-platform-observed">
          <h3>{report.workspace.name}</h3>
          <dl>
            <div>
              <dt>Your access</dt>
              <dd>
                {report.workspace.role}
                {report.operator ? " · can configure policy" : ""}
              </dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>
                {report.target && report.target.environment !== "unavailable"
                  ? report.target.environment
                  : "Not observed"}{" "}
                · existing Guestbook service
              </dd>
            </div>
            <div>
              <dt>Applications</dt>
              <dd>
                {report.inventory.existingStacks === null
                  ? "Inventory not reported by this runtime"
                  : `${report.inventory.existingStacks} retained stack${report.inventory.existingStacks === 1 ? "" : "s"}`}
                {report.inventory.resumable.length
                  ? ` · ${report.inventory.resumable.length} of your requests can resume`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Standing rules</dt>
              <dd>
                {!report.policy
                  ? "Not configured"
                  : `${report.policy.enabled ? "Enabled" : "Paused"} · ${report.policy.maxApplications} application limit · ${report.policy.reviewRequired ? "independent review" : "automatic within policy"}`}
              </dd>
            </div>
            <div>
              <dt>App adapter</dt>
              <dd>
                {report.runner
                  ? "Configured; upstream access not checked"
                  : "Not configured; keep existing requests"}
              </dd>
            </div>
          </dl>
          <div className="ready-platform-next">
            <h3>{assessment.next.label}</h3>
            <p>{assessment.next.text}</p>
            {assessment.stale ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void check()}
              >
                Check current setup
              </button>
            ) : (
              <a className="button" href={nextHref}>
                {assessment.next.id === "adoption"
                  ? "Review teams and access"
                  : report.operator
                    ? "Open protected platform"
                    : "Open my team applications"}
              </a>
            )}
            {assessment.next.id === "request" && !assessment.stale && (
              <p>
                <a
                  href={
                    "/init?" +
                    new URLSearchParams({
                      profile: "platform",
                      workspace: selected,
                    })
                  }
                >
                  Continue in Init with this team
                </a>
              </p>
            )}
          </div>
          <details>
            <summary>Selected installation and observation</summary>
            <dl>
              <div>
                <dt>Installation</dt>
                <dd>{report.installation.origin}</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  <code>{report.target?.account ?? "Not observed"}</code>
                </dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>
                  <code>{report.workspace.id}</code>
                </dd>
              </div>
              <div>
                <dt>Composer source</dt>
                <dd>
                  <code>{report.installation.source ?? "Not observed"}</code>
                </dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>
                  <time dateTime={report.checkedAt}>
                    {report.checkedAt} (UTC)
                  </time>
                </dd>
              </div>
            </dl>
            <p className="small">
              This dated observation does not certify preparation or a working
              application. Current permissions, policy, quota and recorded
              outcomes are checked again by the protected action.{" "}
              {report.inventory.partial &&
                "The request list is bounded; it is not a complete inventory or usage ledger."}
            </p>
            <button
              type="button"
              onClick={() => downloadJson(report, "platform-observation.json")}
            >
              Download private setup observation
            </button>
          </details>
        </div>
      )}
      <p className="small">
        Checks create no resources. Keep downloaded workspace and account
        observations private. The supported request uses fictional data on the
        existing runtime; it does not provision isolated staging infrastructure.
      </p>
    </section>
  );
}
