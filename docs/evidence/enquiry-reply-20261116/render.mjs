// Local rendered acceptance harness for the #598 reply job. It builds the real
// D1 schema in memory, seeds one fictional consented v2 brief, performs the real
// journey read, agent draft, owner approval and manual export through
// manageInboxJourney, then renders the actual JourneyDetail component for the
// draft, approved and exported states. No API transport, browser session,
// provider or real recipient is exercised.
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
import { manageInboxJourney } from "../../../src/lib/inbox-journey.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const output = process.argv[2];
if (!output) throw Error("Pass a directory for the generated HTML.");
mkdirSync(output, { recursive: true });
const source = appSettings.guestbook.source.commit;
const resource = "fictional-reply-resource";
const owner = {
  ...user,
  id: "fictional-reply-owner",
  role: 20,
  email: "owner@example.test",
};
const editor = {
  ...user,
  id: "fictional-reply-editor",
  role: 20,
  email: "editor@example.test",
};
const now = Date.now();
const consent = {
  version: 2,
  consented_at: new Date(now - 60 * 60 * 1000).toISOString(),
  expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  recipient: "visitor@example.test",
};
const body = [
  "Hello, and thank you for the fictional reading-club enquiry.",
  "",
  "You asked about a private events page. I can prepare one page with the",
  "reading dates and a short sign-up note. This reply is fictional test text.",
].join("\n");
const item = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  scope_key: "c".repeat(64),
  configuration_revision: 1,
  provenance: { kind: "standalone", resource, configuration: 1 },
  model_version: 1,
  producer_source: source,
  values: {
    title: "A fictional reading-club page",
    goal: "A private goal that must stay in the app-owned Inbox.",
    starting_point: "New idea",
    deliverables: [{ item: "A fictional events page", detail: "One page" }],
  },
  consent_version: 1,
  consent_at: "2026-10-24 09:00:00",
  reply: consent,
  status: "pending",
  revision: 1,
  created_at: "2026-10-24 09:00:00",
  expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const f = fixture();
for (const file of [
  "0013_enquiry_notifications.sql",
  "0017_inbox_journey.sql",
  "0030_enquiry_reply_jobs.sql",
])
  f.sqlite.exec(readFileSync(join(root, "migrations", file), "utf8"));
const workspace = await workspaceForUser(f.db, owner);
f.sqlite
  .prepare(
    "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
  )
  .run(workspace.id, editor.id);
const runtime = {
  ...f.runtime,
  DB: f.db,
  RESOURCE_ACCOUNT_ID: account,
  RESOURCE_ENVIRONMENT: "production",
};
f.sqlite
  .prepare(
    "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
  )
  .run(resource, workspace.id, account, "production", origin + "/guestbook");
const handler = async (request) => {
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
      format: "guestbook.private-enquiries/v2",
      source,
      resource: {
        id: resource,
        workspace_id: workspace.id,
        account_id: account,
        environment: "production",
        target: origin + "/guestbook",
        version: 2,
        active_revision: 1,
      },
      retentionDays: 30,
      items: [item],
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
};
f.runtime.GUESTBOOK = { fetch: handler };
runtime.GUESTBOOK = { fetch: handler };

const call = (input, caller = owner) =>
  manageInboxJourney(
    {
      user: caller,
      input: { workspace: workspace.id, resource, ...input },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/journey" +
          (input.action === "journey" ? "Read?action=journey" : "Write"),
        {
          method: input.action === "journey" ? "GET" : "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1" },
        },
      ),
    },
    runtime,
  );
const states = {};
states.initial = await call({ action: "journey", item: item.id });
if (!states.initial.ok) throw Error(states.initial.message);
states.draft = await call({
  action: "replyDraft",
  item: item.id,
  expectedRevision: 0,
  body,
  generator: "agent",
  generatorId: "composer-agent/reading-club",
});
if (!states.draft.ok) throw Error(states.draft.message);
states.approved = await call({
  action: "replyApprove",
  item: item.id,
  expectedRevision: states.draft.reply.draft.revision,
  expectedDigest: states.draft.reply.draft.digest,
});
if (!states.approved.ok) throw Error(states.approved.message);
const jobRow = f.sqlite
  .prepare("SELECT id,approval_expires_at FROM creator_enquiry_reply_jobs")
  .get();
f.sqlite
  .prepare(
    "UPDATE creator_enquiry_reply_jobs SET approval_expires_at=? WHERE id=?",
  )
  .run(new Date(now - 60 * 1000).toISOString(), jobRow.id);
states.expired = await call({ action: "journey", item: item.id });
if (!states.expired.ok) throw Error(states.expired.message);
f.sqlite
  .prepare(
    "UPDATE creator_enquiry_reply_jobs SET approval_expires_at=? WHERE id=?",
  )
  .run(jobRow.approval_expires_at, jobRow.id);
states.exported = await call({
  action: "replyExport",
  item: item.id,
  expectedApproval: states.approved.reply.approval.id,
  expectedDigest: states.approved.reply.draft.digest,
});
if (!states.exported.ok) throw Error(states.exported.message);

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
const componentDirectory = join(
  root,
  ".private",
  "enquiry-reply-evidence-" + process.pid,
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
const page = (title, journey) => {
  const detail = renderToStaticMarkup(
    React.createElement(JourneyDetail, {
      journey,
      busy: false,
      onAction() {},
      onEnquiryAction() {},
      onPreference() {},
      onRefresh() {},
      onReply() {},
    }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 24px; line-height: 1.5; }
  main { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 20px; }
  .evidence { margin-top: 24px; font-size: 13px; opacity: 0.8; }
  ${css}
  </style></head><body><main><h1>${title}</h1>${detail}<p class="evidence">Rendered from the actual JourneyDetail component with fictional data and the real in-memory D1 route handlers. No email, provider, authentication session or recipient was involved.</p></main></body></html>`;
};
for (const [name, journey] of Object.entries(states))
  writeFileSync(
    join(output, name + ".html"),
    page("Reply job · " + name, journey),
  );

const job = f.sqlite.prepare("SELECT * FROM creator_enquiry_reply_jobs").get();
const events = f.sqlite
  .prepare(
    "SELECT kind,at,actor_id,draft_revision,approval_id FROM creator_enquiry_reply_events ORDER BY at,rowid",
  )
  .all();
const receipt = {
  format: "composer.enquiry-reply-evidence/1",
  source,
  scope: {
    workspace: workspace.id,
    resource,
    account,
    environment: "production",
    target: origin + "/guestbook",
  },
  brief: {
    id: item.id,
    revision: item.revision,
    consentVersion: item.reply.version,
    recipientFingerprint: states.exported.reply.consent.recipientFingerprint,
  },
  job: {
    id: job.id,
    state: job.state,
    draftRevision: job.draft_revision,
    draftDigest: job.draft_digest,
    approvalId: job.approval_id,
    approvalDigest: job.approval_digest,
    approvedBy: job.approved_by,
    approvedAt: job.approved_at,
    approvalExpiresAt: job.approval_expires_at,
    exportedAt: job.exported_at,
  },
  events: events.map((event) => ({
    kind: event.kind,
    at: event.at,
    actorId: event.actor_id,
    draftRevision: event.draft_revision,
    approvalId: event.approval_id,
  })),
  manualExport: {
    method: states.exported.manualExport.method,
    sent: states.exported.manualExport.sent,
    idempotent: states.exported.manualExport.idempotent,
    subject: states.exported.manualExport.subject,
    receiptIncludesExactBody: states.exported.manualExport.receipt.includes(
      states.exported.manualExport.body,
    ),
    receiptIncludesNotSent: states.exported.manualExport.receipt.includes(
      "Sent by Composer: no",
    ),
  },
  renderedStates: Object.keys(states),
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
console.log(
  "Wrote " +
    Object.keys(states).length +
    " reply-state pages and receipt.json to " +
    output,
);
f.close();
