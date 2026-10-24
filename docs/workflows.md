# Native workflows

The EmDash **Workflows** page offers two small recipes on the existing Composer
workspace, stack and platform-request machinery:

| When                               | Condition                                         | Result                                                                         |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| A stack has a published revision   | The exact immutable publication is readable       | A private summary draft with its public link                                   |
| A platform request needs attention | The same scoped request revision is still failing | One actionable attention item linking to the existing platform recovery screen |

**Turn on** enables bounded follow-ups after the canonical native stack publish/
republish and platform mutation routes confirm a saved result. Only the affected
server-derived source is considered. GET reads and the existing scheduler never
trigger these recipes. **Scan now** remains explicit recovery and inspects up to
20 current source rows, including matching frozen plan account/environment and
the fixed app destination. Neither recipe
sends mail, executes an agent, changes source records, publishes a post or
performs remediation. A publication check is not a Worker-release or link-check
receipt. Inbox/mail remains owned by #117; scheduled and external automation,
contribution sharing and provider callbacks remain #289/#291 qualification work.

Source mutation and follow-up capture are separate transactions. A missing table,
interruption, full receipt limit or failed follow-up cannot roll back or repeat
the confirmed source operation. Its original response object remains unchanged;
a fixed, redacted `WORKFLOW_POST_WRITE_CAPTURE_UNAVAILABLE` warning identifies
the recovery path. A missed follow-up needs **Scan now** after the cause is
resolved. This is tested request-path automation, not durable outbox delivery or
autonomous scheduling/reliability. Writes through other interfaces remain outside
these two native route hooks. Paused recipes and revoked membership stop effects
at the same persisted SQL boundary as explicit scans.

Choose the workspace through the existing workspace selector. The server derives
account/environment from its runtime. A saved recipe records that exact scope;
changed account/environment stops its activation until explicit review/save.
Editor/owner membership and the existing EmDash creator permission protect
writes; viewers can read/export. Origin and native-request checks remain on
mutations. Incoming event payloads and executable expressions cannot be imported.

The recipe name is editable. Save paused or save and turn on. Exported
`composer.workflow/1` definitions retain recipe/trigger/action identity and an
empty connection-reference list. Imports validate this finite schema and update
the editor only; save and activation remain explicit. Unsupported actions,
expressions and secret-bearing fields are rejected.

**Try with sample data** creates a labelled fictional result. **Try an unavailable
source** persists a real failure branch in the same history, with its completed
observation step. **Restore sample & retry** checks the restored fictional source
and completes the draft. No live stack or provider is involved. Real-source
retries check current membership, activation, environment and source revision.
They never repeat an already finished run. Attempts stop at three.

`0012_workflows.sql` stores recipes and run receipts in the existing D1. A unique
workspace/recipe/event identity deduplicates repeated scans. SQL predicates
recheck membership, recipe revision/activation and successful source state at
the write boundary. Draft result and completed steps are persisted together, so
interruption does not leave an unknown external effect. Reopen/Refresh reads
saved receipts. The view shows the latest 50; the workspace retains at most 500.
At the limit, existing results remain readable and duplicates remain harmless;
new records require a future explicit retention/export policy. No cleanup of
owner/source data is performed.

The public preparation prompt is `/prompts#workflow`. `/resources#hook` includes
the broader hook runbook. Native runtime proof and fixture proof are separate;
the actual native phone/desktop/admin journey and deployed source/Worker receipt
belong in #11 before production acceptance.

## External examples to adapt

These are inspectable preparation examples, not installed or verified Composer
connectors. Configure credentials in the selected server/connection facility;
do not paste a webhook URL or key into recipe JSON.

For n8n: a Webhook node receives a bounded fictional event, requires Header or
Basic authentication, and routes a known event type to a review-only draft step.
Use the node's separate test URL while listening for a test event, then explicitly
select its production URL when the integration is qualified. An immediate
“started” response is not downstream completion. Authentication precedes any
filter or expression. Return a bounded operation reference that can be reconciled
before retrying. These authentication modes and distinct URL types are described
in the [official n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook).

Example non-secret event body:

```json
{
  "version": "composer.external-example/1",
  "event": "fictional.release.summary",
  "id": "fictional-release-001",
  "workspace": "fictional-reading-club",
  "environment": "sandbox",
  "result": {
    "title": "A fictional reading list",
    "url": "https://example.test/reading"
  }
}
```

For IFTTT: a **Receive a web request** trigger can map `value1` to a fictional
title, `value2` to a safe public result URL, and `value3` to a non-secret operation
reference. Keep the complete credential-bearing endpoint server-side and redact
it as one value. Use an actual supported authenticated callback before accepting
any response as a Composer operation. The [official Webhooks FAQ](https://help.ifttt.com/hc/en-us/articles/115010230347-Webhooks-service-FAQ)
documents the endpoint key, the three fields and custom headers for outbound
Webhooks Actions. No IFTTT account, plan, vendor run or callback was exercised by
this native implementation.

## Verification

```sh
node --test tests/workflows.test.mjs
```

The tests use FK-enabled local SQLite and fictional app fixtures. They exercise
the exact native route function, durable samples, unavailable-source recovery,
publication scope, duplicate events, stale revisions, pause/revocation, unsafe
imports and current permissions. This is deterministic local contract evidence,
not a hosted owner session or external provider proof.
