// Local rendered acceptance harness for the Inbox journey. It builds the real
// D1 schema in memory, seeds fictional app-owned briefs and Composer records,
// reads the journey through the actual server function, and renders the actual
// JourneyDetail component. The API transport, browser session and provider are
// not exercised; see README.md.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ts from "typescript";
import {
  fixture,
  user,
  account,
  origin,
} from "../../../tests/helpers/resource-fixture.mjs";
import { workspaceForUser } from "../../../src/lib/stacks.mjs";
import { appSettings } from "../../../src/lib/app-settings.mjs";
import { resourceConnection } from "../../../src/lib/resource-client.ts";
import { manageInboxJourney } from "../../../src/lib/inbox-journey.ts";
import {
  enquiryLabels,
  enquiryState,
} from "../../../src/lib/inbox-journey-contract.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const htmlDirectory = process.argv[2];
if (!htmlDirectory) throw Error("Pass a directory for the generated HTML.");
mkdirSync(htmlDirectory, { recursive: true });
const source = appSettings.guestbook.source.commit;
const owner = {
  ...user,
  id: "fictional-journey-owner",
  role: 20,
  email: "owner@example.test",
};
const resource = "fictional-journey-resource";
const digest = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const items = (status, selected = "pending") => [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    status: selected,
    title: "A reading-club page for the fictional town",
    goal: "A single page with the reading list, dates and a way for local members to see when the next meeting is.",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    status,
    title: "A fictional workshop sign-up page",
    goal: "A short page that explains the workshop and shows the date.",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    status: "reviewed",
    title: "A page for the fictional repair café",
    goal: "Opening hours and what people can bring.",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    status: "rejected",
    title: "An unrelated fictional request",
    goal: "A request that does not belong to this club.",
  },
];
const enquiry = (id, status, title, goal) => ({
  id,
  scope_key: "c".repeat(64),
  configuration_revision: 1,
  provenance: {
    kind: "composer.publication",
    resource,
    configuration: 1,
    stack: "fictional-trail-notes",
    publication: 11,
    instance: "fictional-visitor-book",
  },
  model_version: 1,
  producer_source: source,
  values: {
    title,
    goal,
    starting_point: "New idea",
    deliverables: [
      { item: "One responsive page", detail: "Readable at 390px" },
      { item: "A short update", detail: "Plain text, no tracking" },
    ],
  },
  consent_version: 1,
  consent_at: "2026-10-24 22:40:00",
  status,
  revision: 1,
  created_at: "2026-10-24 22:40:00",
  expires_at: "2026-11-23 22:40:00",
});

async function build(scenario) {
  const f = fixture();
  for (const file of [
    "0013_enquiry_notifications.sql",
    "0017_inbox_journey.sql",
  ])
    f.sqlite.exec(readFileSync(join(root, "migrations", file), "utf8"));
  const workspace = await workspaceForUser(f.db, owner);
  const base = {
    ...f.runtime,
    DB: f.db,
    RESOURCE_ACCOUNT_ID: account,
    RESOURCE_ENVIRONMENT: "production",
    ENQUIRY_NOTIFICATIONS_ENABLED: "true",
    ENQUIRY_NOTIFICATION_RECIPIENT: "owner@example.test",
    RESEND_API_KEY: "fictional-key",
    RESEND_FROM_ADDRESS: "composer@example.test",
    RESEND_ALLOWED_RECIPIENTS: "owner@example.test",
  };
  const connection = resourceConnection(base, workspace.id);
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
    )
    .run(
      resource,
      workspace.id,
      connection.account,
      connection.environment,
      connection.target,
    );
  const rows = items("reviewed", scenario.status);
  const briefs = rows.map((row) =>
    enquiry(row.id, row.status, row.title, row.goal),
  );
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/build.json"))
        return Response.json({
          app: "guestbook",
          revision: source,
          dataVersion: 1,
          resourceContract: 1,
          resourcesEnabled: true,
          resourceAccount: account,
          resourceEnvironment: "production",
        });
      if (url.pathname.includes("/enquiries/export"))
        return Response.json({
          contract: 1,
          format: "guestbook.private-enquiries/v1",
          source,
          resource: {
            id: resource,
            workspace_id: workspace.id,
            account_id: account,
            environment: "production",
            target: origin + "/guestbook",
            version: 4,
            active_revision: 1,
          },
          retentionDays: 30,
          items: briefs,
          covers: {
            privateBodies: true,
            consent: true,
            provenance: true,
            notifications: false,
            credentials: false,
          },
          scope: "current-resource-only",
        });
      return new Response(null, { status: 404 });
    },
  };
  const runtime = { ...base, GUESTBOOK: f.runtime.GUESTBOOK };
  if (scenario.preference !== "off") {
    f.sqlite
      .prepare(
        "INSERT INTO creator_enquiry_notification_preferences(workspace_id,resource_id,owner_id,enabled,destination_digest,revision,updated_at) VALUES(?,?,?,1,?,1,?)",
      )
      .run(
        workspace.id,
        resource,
        owner.id,
        await digest("owner@example.test"),
        "2026-10-24T22:40:00.000Z",
      );
  }
  if (scenario.run)
    f.sqlite
      .prepare(
        "INSERT INTO creator_enquiry_workflow_runs(id,workspace_id,resource_id,event_id,account_id,environment,target,actor_kind,actor_id,state,stage,attempts,reason,revision,outbox_id,item_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "fictional-journey-run-01",
        workspace.id,
        resource,
        rows[0].id,
        connection.account,
        connection.environment,
        connection.target,
        "member",
        owner.id,
        scenario.run.state,
        scenario.run.stage,
        scenario.run.attempts,
        scenario.run.reason,
        scenario.run.revision ?? 2,
        scenario.run.outboxId ?? null,
        rows[0].id,
        "2026-10-24T22:41:00.000Z",
        scenario.run.updatedAt ?? "2026-10-24T22:42:00.000Z",
      );
  if (scenario.outbox)
    f.sqlite
      .prepare(
        "INSERT INTO creator_enquiry_notification_outbox(id,workspace_id,resource_id,event_id,account_id,environment,target,owner_id,state,attempts,destination_digest,provider_id,reason,item_id,created_at,updated_at,reconciled_at,reconciliations) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        workspace.id,
        resource,
        rows[0].id,
        connection.account,
        connection.environment,
        connection.target,
        owner.id,
        scenario.outbox.state,
        scenario.outbox.attempts,
        await digest("owner@example.test"),
        scenario.outbox.providerId ?? null,
        scenario.outbox.reason,
        rows[0].id,
        "2026-10-24T22:41:00.000Z",
        scenario.outbox.updatedAt ?? "2026-10-24T22:42:00.000Z",
        scenario.outbox.reconciledAt ?? null,
        scenario.outbox.reconciliations ?? 0,
      );
  const journey = await manageInboxJourney(
    {
      user: owner,
      input: {
        action: "journey",
        workspace: workspace.id,
        resource,
        item: rows[0].id,
      },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/journeyRead?action=journey",
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    runtime,
  );
  if (!journey.ok) throw Error("Journey fixture failed: " + journey.message);
  return { f, workspace, rows, briefs, journey };
}

const scenarios = [
  {
    id: "queued-unconfigured",
    label: "New brief · workflow queued · owner mail unconfigured",
    status: "pending",
    preference: "off",
    run: {
      state: "queued",
      stage: "observed",
      attempts: 0,
      reason: "",
      revision: 1,
    },
  },
  {
    id: "running-interrupted",
    label: "Running · interrupted processing · no notice yet",
    status: "pending",
    preference: "on",
    run: {
      state: "running",
      stage: "observed",
      attempts: 1,
      reason: "",
      updatedAt: "2026-10-24T22:44:00.000Z",
    },
  },
  {
    id: "accepted",
    label: "Reviewed brief · workflow finished · provider accepted",
    status: "reviewed",
    preference: "on",
    run: {
      state: "finished",
      stage: "notice-prepared",
      attempts: 1,
      reason:
        "The owner notice is prepared. Sending needs an explicit owner action.",
      outboxId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    },
    outbox: {
      state: "accepted",
      attempts: 1,
      providerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reason:
        "Accepted by provider. Delivery and reading have not been verified.",
    },
  },
  {
    id: "uncertain",
    label: "Reviewed brief · delivery outcome uncertain · reconcile only",
    status: "reviewed",
    preference: "on",
    run: {
      state: "finished",
      stage: "notice-prepared",
      attempts: 1,
      reason:
        "The owner notice is prepared. Sending needs an explicit owner action.",
      outboxId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    },
    outbox: {
      state: "uncertain",
      attempts: 1,
      reason:
        "The send outcome is uncertain. The enquiry remains in your Inbox; reconcile before retry.",
      reconciliations: 1,
      reconciledAt: "2026-10-24T22:45:00.000Z",
      updatedAt: "2026-10-24T22:45:00.000Z",
    },
  },
  {
    id: "failed-retry",
    label: "Failed workflow and delivery · readable reason and bounded retry",
    status: "pending",
    preference: "on",
    run: {
      state: "failed",
      stage: "source-checked",
      attempts: 1,
      reason:
        "The owner who enabled notifications no longer has owner access. Restore that access or review the visitor book’s notification setting.",
    },
    outbox: {
      state: "failed",
      attempts: 1,
      reason:
        "The provider rejected this notification (429). The enquiry remains in your Inbox.",
      updatedAt: "2026-10-24T22:46:00.000Z",
    },
  },
];

const contractURL = pathToFileURL(
  join(root, "src/lib/inbox-journey-contract.ts"),
).href;
let componentSource = readFileSync(
  join(root, "src/plugins/inbox-journey-panel.tsx"),
  "utf8",
);
componentSource = componentSource
  .replace(
    /import \{ apiFetch, parseApiResponse \} from "emdash\/plugin-utils";\n/,
    "",
  )
  .replace(
    /import \{ confirmWorkspace \} from "\.\/stacks\/workspace-scope";\n/,
    "",
  )
  .replace(/import \{ focusStoredRecord \} from "\.\/record-anchor";\n/, "")
  .replace(
    'from "../lib/inbox-journey-contract"',
    "from " + JSON.stringify(contractURL),
  );
const compiled = ts.transpileModule(componentSource, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
// The compiled component must resolve react/zod from this repository's
// node_modules, so it lives in the ignored .private/ directory for the import.
const componentDirectory = join(
  root,
  ".private",
  "inbox-journey-evidence-" + process.pid,
);
mkdirSync(componentDirectory, { recursive: true });
const componentPath = join(componentDirectory, "component.mjs");
writeFileSync(componentPath, compiled.outputText);
let JourneyDetail;
try {
  ({ JourneyDetail } = await import(pathToFileURL(componentPath).href));
} finally {
  rmSync(componentDirectory, { recursive: true, force: true });
}

const css = readFileSync(join(root, "src/plugins/enquiries.css"), "utf8");
const date = (value) =>
  new Date(value.replace(" ", "T") + "Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const stateRows = [
  [
    "Enquiry",
    "new",
    "pending",
    "Guestbook owns the record; review is an owner/editor decision.",
  ],
  [
    "Enquiry",
    "reviewed",
    "reviewed",
    "Read and marked; still not a reply, sale or contact.",
  ],
  [
    "Enquiry",
    "rejected",
    "rejected",
    "Rejected privately; the record remains until deletion or expiry.",
  ],
  [
    "Workflow",
    "unlinked",
    "no link",
    "No exact receipt-to-brief link; no delivery action is offered.",
  ],
  [
    "Workflow",
    "queued",
    "queued",
    "Body-free event recorded; processing is explicit.",
  ],
  [
    "Workflow",
    "running",
    "running",
    "Processing claimed. Interruption stays visible and re-checkable.",
  ],
  [
    "Workflow",
    "finished",
    "finished",
    "Scope checked; a notice was prepared or notifications are off.",
  ],
  [
    "Workflow",
    "failed",
    "failed",
    "Readable local reason; bounded retry while attempts remain.",
  ],
  [
    "Delivery",
    "unconfigured",
    "unconfigured",
    "Owner mail is off or absent. No send is offered.",
  ],
  [
    "Delivery",
    "ready",
    "queued",
    "Notice prepared; explicit owner send is the next action.",
  ],
  [
    "Delivery",
    "attempted",
    "sending",
    "Provider request in flight; reconcile only.",
  ],
  [
    "Delivery",
    "accepted",
    "accepted",
    "Provider identity retained; delivery/reading unverified; no resend.",
  ],
  [
    "Delivery",
    "uncertain",
    "uncertain",
    "Unknown outcome stays uncertain; reconcile never sends.",
  ],
  [
    "Delivery",
    "failed",
    "failed",
    "Definite refusal; same message key, at most three attempts.",
  ],
];

function page(scenario, model, briefs) {
  const detail = renderToStaticMarkup(
    React.createElement(JourneyDetail, {
      journey: model,
      busy: false,
      onAction() {},
      onEnquiryAction() {},
      onPreference() {},
      onRefresh() {},
    }),
  );
  const rows = briefs
    .map((brief, index) => {
      const selected = index === 0;
      return `<li><button type="button" class="ce-row"${
        selected ? ' aria-current="true"' : ""
      }><span class="ce-row-title">${escape(brief.values.title)}</span><span class="ce-row-meta"><span class="ce-chip" data-kind="enquiry" data-state="${enquiryState(
        brief.status,
      )}">${enquiryLabels[enquiryState(brief.status)]}</span><span>${date(
        brief.created_at,
      )}</span></span></button></li>`;
    })
    .join("");
  const states = stateRows
    .map(
      ([kind, state, source, meaning]) =>
        `<tr data-current="${
          model.enquiry.status === state ||
          model.workflow.state === state ||
          model.delivery.state === state
        }"><th scope="row">${kind}</th><td><code>${state}</code></td><td><code>${source}</code></td><td>${meaning}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en-AU" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(
    scenario.label,
  )} · Inbox journey fixture</title><style>
${css}
html,body{margin:0;min-height:100%}
html[data-theme="dark"]{background:#17181b;color:#f2f3f5;color-scheme:dark}
html[data-theme="light"]{background:#faf9f7;color:#22252b;color-scheme:light}
body{font-family:system-ui,sans-serif}
.evidence-banner,.evidence-states{max-width:1180px;margin:0 auto;padding:16px 24px}
.evidence-banner{border-bottom:1px solid color-mix(in srgb,currentColor 25%,transparent);font-size:13px}
.evidence-banner strong{display:block;font-size:15px;margin-bottom:4px}
.evidence-check{font-family:ui-monospace,monospace;font-size:12px;overflow-wrap:anywhere;margin:8px 0 0}
.evidence-states{margin:32px auto 64px;font-size:13px;border-top:1px solid color-mix(in srgb,currentColor 25%,transparent);padding-top:20px}
.evidence-states h2{font-size:18px}
.evidence-table-wrap{overflow-x:auto}
.evidence-states table{width:100%;min-width:640px;border-collapse:collapse}
.evidence-states th,.evidence-states td:nth-child(2),.evidence-states td:nth-child(3){white-space:nowrap}
.evidence-states td:last-child{overflow-wrap:anywhere}
.evidence-states th,.evidence-states td{text-align:left;padding:8px 10px;border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent);vertical-align:top}
.evidence-states tr[data-current="true"]{background:color-mix(in srgb,currentColor 9%,transparent);font-weight:600}
.evidence-states code{font-size:12px}
</style></head><body>
<div class="evidence-banner"><strong>Local rendered acceptance · fictional fixture</strong>
${escape(scenario.label)}. Real schema, fixtures and read model; the EmDash API transport, authentication session and any provider are not exercised. Theme is selected by the capture query.
<p class="evidence-check" id="rendered-check">Rendered check pending…</p></div>
<main class="ce-inbox">
<header><p class="ce-kicker">PRIVATE WORKSPACE · FICTIONAL READING CLUB</p><h1>Enquiries</h1><p>Read a brief, mark it reviewed, or remove it. Guestbook owns the records. Notifications are separate from review and start off. No reply is sent.</p><p>Each retained brief now links to its owner-notice workflow and delivery state. Processing is explicit; reviewing a brief sends nothing.</p></header>
<div class="ce-inbox-layout"><section class="ce-list" aria-labelledby="ce-list-title"><div class="ce-heading"><h2 id="ce-list-title">Retained briefs</h2><button type="button">Export private inbox</button></div><p class="ce-muted">Bodies expire after 30 days; minimal delivery and operation receipts remain for 35 days. Choose a brief to read it and see its workflow and delivery state.</p><ul class="ce-rows" aria-label="Retained briefs">${rows}</ul><nav class="ce-pages" aria-label="Enquiry inbox pages"><button type="button" disabled>Previous</button><span>Page 1 · up to 20 briefs</span><button type="button" disabled>Next</button></nav></section><div class="ce-detail-slot">${detail}</div></div>
<section class="evidence-states" aria-labelledby="state-map"><h2 id="state-map">Fixture state map (evidence only)</h2><p>The highlighted rows are the states shown in this capture. The five required delivery states are all represented; <code>ready</code> distinguishes a prepared notice from an unconfigured connection.</p><div class="evidence-table-wrap"><table><thead><tr><th scope="col">Stage</th><th scope="col">Displayed journey state</th><th scope="col">Stored record</th><th scope="col">Meaning and next action</th></tr></thead><tbody>${states}</tbody></table></div></section>
</main><script>
document.documentElement.dataset.theme=new URLSearchParams(location.search).get("theme")==="light"?"light":"dark";
(function(){
  const focusables=[...document.querySelectorAll('button,select,a[href]')];
  const negative=focusables.filter(el=>el.tabIndex<0).length;
  let declared='not found';
  try {
    for(const sheet of document.styleSheets) for(const rule of sheet.cssRules)
      if(rule.selectorText&&rule.selectorText.includes(':focus-visible')) declared=rule.style.outline;
  } catch {}
  const overflow=document.documentElement.scrollWidth>innerWidth;
  document.getElementById('rendered-check').textContent=
    innerWidth+'px viewport · scrollWidth '+document.documentElement.scrollWidth+' · '+
    (overflow?'HORIZONTAL OVERFLOW':'no horizontal overflow')+' · '+
    focusables.length+' native focusable controls · '+negative+' negative tabindex · declared focus outline '+declared;
})();
</script></body></html>`;
}

for (const scenario of scenarios) {
  const built = await build(scenario);
  try {
    writeFileSync(
      join(htmlDirectory, `${scenario.id}.html`),
      page(scenario, built.journey, built.briefs),
    );
    console.log(
      scenario.id +
        ": " +
        built.journey.next.kind +
        " / " +
        built.journey.workflow.state +
        " / " +
        built.journey.delivery.state,
    );
  } finally {
    built.f.close();
  }
}
console.log("Wrote " + scenarios.length + " pages to " + htmlDirectory);
