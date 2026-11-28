# Connect your agent

Reviewed 2026/10/25 (Australia/Melbourne) for
[#311](https://github.com/loftwah/app-composer/issues/311). This page covers the
owner-facing connection, the credential an agent receives and the two supported
interfaces. The durable proposal contract itself is in
[Agent proposals](agent-proposals.md); this page adds the grant workflow and the
connected-client transport without changing the digest, review or handoff rules.

A connection is **proposal-only**. It can read its own scope, read the scoped
briefing and submit a proposal. It cannot accept, reject, request changes,
prepare a handoff, deploy, merge, spend, read secrets or change access. Those
stay on a signed-in human session.

## What a permission is

One fixed catalogue, shown to the owner before authorising and to the agent when
it asks for its scope:

| Capability        | Authority | What it covers                                                                                             |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `scope:read`      | read      | The one workspace, app, environment, account, role pack, agent, owner, fallback and expiry for this grant  |
| `briefing:read`   | read      | The role pack inputs, permitted evidence for that environment, output schema, stop rules and prohibitions  |
| `proposal:submit` | propose   | One reviewable record with source identity, cited evidence, risk and a bounded change. Nothing is executed |

Deliberately absent, and listed in the UI under **Reserved for humans**: review
and accept, handoff, deploy or publish, merge or migrate, provider credentials,
membership and access policy, spending, secrets and other workspaces' data.

The grant row has no column that could express approval or deployment, and the
agent interface has no tool that maps to those actions. That is why scope
selection is a fixed list rather than free-form permissions.

## Credentials stay separate

| Credential                 | Issued by                                         | Opens                                                       | Cannot open                            |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| EmDash session             | Cloudflare Access → EmDash                        | The native admin pages, including review and revocation     | An agent tool                          |
| EmDash API token `ec_pat_` | `POST /_emdash/api/admin/api-tokens` (admin role) | EmDash MCP, subject to its scopes                           | Plugin routes unless scoped `admin`    |
| Agent grant credential     | The owner, once, at issue time                    | The scoped local endpoint only                              | EmDash, Cloudflare, Git, provider APIs |
| Cloudflare API token       | Cloudflare                                        | Cloudflare resources                                        | Nothing in this workflow               |
| Git credential             | Git host                                          | Repository access for the human or the agent's own identity | Nothing in this workflow               |

The agent grant credential is `ec_agent_` + 32 random bytes in base64url. EmDash
1.3.1 resolves only `ec_pat_` and `ec_oat_` bearer tokens and rejects every other
prefix (`else return "invalid"` in its auth middleware), so this value cannot
authenticate to EmDash by construction. A focused test asserts that behaviour
against the installed package.

## Owner workflow

The native **Agent proposals** page (`/_emdash/admin/plugins/composer-stacks/proposals`)
now opens with **Connect an agent**:

1. **Select the scope.** App (from the shipped catalogue), environment kind
   (`local` or isolated `preview`; production is refused), environment id,
   account label, role pack, agent id and name, fallback owner (an existing
   workspace owner or editor) and an expiry between 1 and 72 hours.
2. **Read the capabilities.** The exact permitted list and the reserved-human
   list are on screen before the button is enabled.
3. **Authorise.** The route resolves the owner from the signed-in session, the
   fallback from `creator_members`, and refuses anyone who is not the workspace
   owner. The credential is displayed once with the launch commands.
4. **Review proposals.** Accept/Request changes/Reject are unchanged and require
   the browser session.
5. **Rotate or revoke.** Rotation invalidates the previous value immediately.
   Revocation keeps the proposals reviewable and refuses all further agent use.

Only SHA-256 of the credential is stored (`connection_hash`, plus a display
`connection_prefix`, `connection_issued_at` and `connection_last_used_at`).
Existing grants keep working after migration `0018` with `connection.issued = false`.

### CLI equivalent

```sh
node scripts/agent-proposal.mjs grant \
  --db <file> --workspace <id> --workspace-name "<name>" \
  --app app-composer --environment env-local-lane-d --environment-kind local \
  --account local-checkout --role qa \
  --agent-id agent:codex/0.145.0 --agent-name "Codex CLI 0.145.0" \
  --owner-id <owner> --owner-name "<owner>" \
  --fallback-id <fallback> --fallback-name "<fallback>" \
  --issued-by "<owner>" --expires-at 2026-10-25T07:45:24Z --confirm-owner

COMPOSER_AGENT_TOKEN=<shown once> node scripts/agent-proposal.mjs scope \
  --db <file> --grant <grant>
```

The CLI asserts identities from flags and is a local lab, not authentication.
The native route is the supported path because it uses the EmDash session and
workspace membership.

## Interface 1 — scoped local endpoint (MCP over stdio)

```sh
COMPOSER_AGENT_TOKEN=<shown once> node scripts/agent-proposal-mcp.mjs \
  --db <file> --grant <grant> --workspace <workspace> --repo-root <checkout>
```

The process speaks MCP over stdio and registers exactly three tools:
`agent_capabilities`, `agent_brief` and `agent_submit`. It reads the credential
from the environment, never from a tool argument, so a model never handles it. It
verifies the grant at startup and again on every call, and it exits without a
scope when the grant is missing, expired, revoked or rotated.

Register it with an installed Codex CLI without editing global configuration:

```sh
codex exec \
  -c 'mcp_servers.composer_agent.command="node"' \
  -c 'mcp_servers.composer_agent.args=["scripts/agent-proposal-mcp.mjs","--db","<file>","--grant","<grant>","--workspace","<workspace>","--repo-root","<checkout>"]' \
  -c 'mcp_servers.composer_agent.env={COMPOSER_AGENT_TOKEN="<shown once>"}' \
  "Call agent_capabilities, then agent_brief, then agent_submit. Do not approve anything."
```

A local path source is hashed by the endpoint itself from the selected checkout
(bounded to 50 files and 2 MB, secret-like files excluded). A `repo` source pins
the repository and commit and, when a checkout is supplied, is verified to
contain that commit.

## Interface 2 — EmDash MCP

The `composer-stacks` plugin declares the same three operations as MCP tools, so
an owner-held EmDash token can drive them from `/_emdash/api/mcp`:

1. Create a token with **only** `mcp:tools:composer-stacks`:
   `POST /_emdash/api/admin/api-tokens {"name":"composer-agent","scopes":["mcp:tools:composer-stacks"],"expiresAt":"…"}`
   (requires the EmDash admin role; the raw value is returned once).
2. Enable the plugin's MCP tools once, which records EmDash's own tool consent:
   `PUT /_emdash/api/admin/plugins/composer-stacks/mcp {"enabled":true}`.
3. Call `composer-stacks__agent_scope`, `__agent_brief` and `__agent_submit` with
   the grant id and the agent identity from the grant.

The tool handler requires the caller to be the grant's accountable owner, the
declared agent to match the grant, a live grant and a current workspace
membership. The hosted path accepts only an immutable repository pin because the
server cannot read the agent's disk.

Scope separation is enforced by EmDash, not by this repository: MCP requests skip
the route scope table, while `/_emdash/api/plugins/**` requires the `admin` token
scope. A token that carries only `mcp:tools:composer-stacks` therefore cannot
call the review route at all, and a browser session is still required for
Accept, Request changes, Reject or handoff. A test asserts the installed rule and
that `hasScope(["mcp:tools:composer-stacks"], "admin")` is false.

## Portfolio decisions in EmDash and MCP

[Decisions](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review)
is a private admin queue. It includes written alternatives, a recommendation,
expected outcomes, pros and cons, sources, and rendered artwork where available.
Save choices, a reaction to the question, a note about what you think or feel,
or media. A save keeps a private revision without applying the decision. Use
**All of the above** where the question allows a combined answer. **Reject the
premise**, **Defer this question** and **Delegate this question** record what
should happen next. **Skip for now** leaves a question open.
Attach a PNG, JPEG or WebP up to 512 KB, or add up to four HTTPS references
for audio, video or larger files. Earlier versions of an answer and its image
are available under **Earlier responses for this question**.

The review opens on the highest-priority ready question. **Why this ranks
here** shows the evidence and provisional policy behind its score. The initial
rank uses the 28 November rendered portfolio comparison and the five mission
weights. Earlier and unassessed questions stay in the question list, and the
active review keeps its order until you return to the question list. **How the
saved response reads** shows a conservative assessment linked to the exact
response revision. It can identify explicit phrasing, split mixed feedback and
leave unclear meaning for an agent to investigate. The original response and
its history remain available. Record delivery and owner satisfaction in the
owning work and incident records.

EmDash and MCP use the same records for the signed-in administrator. MCP access
uses the existing Cloudflare Access boundary and an owner-issued EmDash token
scoped to `mcp:tools:composer-decisions`. Keep the Access session or supported
client authentication active for the existing endpoint
`https://composer.loftwah.com/_emdash/api/mcp`. A plugin token alone does not
satisfy the Access policy. In EmDash Plugins, an administrator enables the
`composer-decisions` MCP tools and reviews the listed permissions.

| Tool | Use |
| --- | --- |
| `composer-decisions__read` | Call with `{}` for mission order, readiness and next actor. Pass `{"id":"composer-art"}` for the brief, its revision, the original response and the separate interpretation. Preview links open in the signed-in admin browser. |
| `composer-decisions__record` | Save choices and context after explicit owner direction. Send `id`, the current `briefRevision`, the response `revision` (or 0), the full `selected` list and the full `note`. Read again after a stale-revision response. |
| `composer-decisions__feedback` | Search your private question responses and Share artwork reactions. Use `query`, `feedbackProject`, `category` and `page` to find the source material. |
| `composer-decisions__add` | Add a private brief with distinct options, sources, a choice limit and recommendation evidence. Add `category`, `tags` and `followUpTo` when the brief responds to a previous question. Supply a client UUID in `requestId` and reuse it on retries. |

The starter queue uses Clef-flash responses and keeps provider confidence separate
from each option weight. The numbers are model judgements, with no audience
measurement or owner approval. An added brief reports the submitter's stated
confidence and basis. See [the starter model inputs and results](../src/data/portfolio-decision-results.json)
and [the campaign comp renderer](../scripts/render-decision-art.py). The source
artwork is the existing Composer press, the LoftwahFM cover used in the published
[Studio teaser](https://composer.loftwah.com/media-studio/films#studio-teaser),
and the approved Composer mark and type. The comp review does not replace the
separate [portfolio design work](https://github.com/loftwah/app-composer/issues/1422).
See [#1432](https://github.com/loftwah/app-composer/issues/1432) for delivery and verification.

### Project interviews, Share index and saved feedback

The [project directory](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=projects)
combines the public Woodhouse portfolio register with Composer’s working apps.
It records active, paused and retired status. Start an interview from a project
or choose **Your preferences**. Interviews ask about familiar tasks, knowledge
gaps, what the owner actually values, where the real journey goes wrong and
what evidence would justify showing it to someone else. A note alone is a valid
answer. Personal taste has no model-selected answer.

The [Share index](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=share)
searches the current eligible public artwork catalogue, films, experiences and
examples. **Review artwork** opens a private question bound to that asset
revision. Use [Saved feedback](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=feedback)
to find the owner’s saved Decisions responses and existing Share reactions.
Filter by project or category and search the brief's tags, the reaction or the
words you wrote. Project and artwork interviews use the same Decisions tools.
When drafting follow-up work, read the relevant saved feedback first and link the
new question to its predecessor. The follow-up displays the earlier context and
the original question links to its follow-ups. Feedback stays in the owner's
store and supplies context to authorised agents. It is separate from Clef
evaluation and the public Share catalogue.

The useful Clef questions have a specific job and an evidence source:

- **Choice** for an editorial role, a plausible next project question or a
  comparison of genuinely different alternatives. Include an unclear choice.
- **Yes/no** for a testable condition such as whether an actual user example is
  still needed. Ask one thing per question.
- **Score** for a defined rubric such as evidence quality, from no evidence
  through a complete repeatable task. Keep scores and human judgements visible.

[The public Clef run](../src/data/decision-research-clef.json) stores the exact
project state, score distributions, input receipts and artwork revision-scoped
metadata classifications. Artwork labels do not establish image quality,
reuse rights or a preference. The catalogue and human records remain in their
owning systems. Clef evaluates supplied evidence. Composer retains the output
and D1 retains the owner’s feedback. The batch runner reads public project and
Share information only. No private response is sent to Workers AI by the app.
To refresh the public batch deliberately, run
`node scripts/evaluate-decision-research.mjs --run` with the existing authorised
Workers AI account. Keep prior evidence in source history and inspect the build
before release. See [Cloudflare’s Clef documentation](https://developers.cloudflare.com/workers-ai/models/clef-flash/).

Use `node --env-file=.env scripts/evaluate-decision-research.mjs --recommend`
to run a bounded public preflight for the active authored Decisions queue.
An optional file argument supplies observed public tasks for the selected
projects. The existing full research command refreshes the broader index
and is independent of this preflight. The review keeps the run date and a
hash of the exact question, choices and links. The suggested answer expires
after 14 days or a change to the brief. Refresh when the linked release or
evidence changes. Weak leads and working preferences are surfaced as
questions requiring judgement. Private replies and attachments are excluded.

In Decisions, **Use suggestion & next** records the shown choice as an
ordinary revision before advancing. **Choose my answer** moves to the
options. An existing response can be edited through the regular form and
its earlier revisions stay accessible. Read the [first quick portfolio
comparison](design-evidence/20261128/quick/README.md) for the screens and
checks that informed the new design questions.

## Refusals

| Case                                             | Result                                                       |
| ------------------------------------------------ | ------------------------------------------------------------ |
| No credential issued for the grant               | `CONNECTION_NOT_ISSUED`                                      |
| Wrong credential, or the value was rotated       | `CONNECTION_INVALID`                                         |
| Grant revoked                                    | `GRANT_REVOKED` (the endpoint refuses to start)              |
| Grant expired, or the credential is past expiry  | `GRANT_EXPIRED`                                              |
| Grant belongs to another workspace               | `GRANT_NOT_FOUND`                                            |
| Proposal for another app/environment/role/agent  | `SCOPE_MISMATCH` / `INVALID`                                 |
| Agent tries to review or hand off                | No such tool; the review action also refuses `SELF_APPROVAL` |
| Non-owner, viewer or outsider tries to authorise | `FORBIDDEN`                                                  |
| Production environment                           | `INVALID` with “Production proposals are not supported”      |
| Fallback is not a current owner/editor           | `MEMBER_NOT_FOUND` / `INVALID`                               |

## What was exercised

The scoped endpoint was driven over the real MCP protocol by
`@modelcontextprotocol/client` 2.4.0: tool discovery, `agent_capabilities`,
`agent_brief`, `agent_submit` and a refused `agent_review`. The native route then
listed the proposal, accepted the exact digest and recorded
`execution: not-performed` with no handoff row. After revocation the endpoint
refused to start with `GRANT_REVOKED`. The transcript is
[here](evidence/agent-connect-20261025/transcript.md).

A **model-driven** Codex turn was not possible on this machine: Codex CLI 0.145.0
reports the account usage limit is reached until 2026-10-31, the environment's
`OPENAI_API_KEY` is rejected by the API, and the only local Ollama model declares
no thinking support and overflows Codex's request against its 32k context. The
smallest operator step is either to restore Codex usage or supply a valid API key,
then run the `codex exec` command above unchanged. No client is claimed to work
until that turn is run.

## Remaining gaps

- The native page was type-checked and its workflow was exercised through the
  same route handler the browser calls, but the authenticated browser page and a
  screen reader were not exercised here.
- EmDash MCP tool invocation itself was not driven against a deployed EmDash; the
  route checks, the plugin declaration and EmDash's own scope rule are tested.
- Local-path acceptance still needs a source observation within ten minutes, the
  existing `SOURCE_UNVERIFIED` rule.
- No execution adapter exists. Accepting a digest executes nothing; the handoff
  remains a prepared artifact for the existing release flow.

## Contextual feedback observer

The distinct `composer-feedback-observer` MCP plugin exposes **read** and
**propose** against the issuing administrator's contextual Inbox threads in this
Composer installation. Pass `workspace: "app-composer"`. A proposal needs the
thread's latest revision, a request UUID to reuse on retry and at least one
HTTPS evidence reference. The stored author is the named credential.

The plugin accepts only a named EmDash API token with exactly
`mcp:tools:composer-feedback-observer` and an expiry within 30 days. Use the
existing EmDash token settings to inspect expiry and last use or revoke the
token. Enable the two MCP tools in EmDash Plugins only for the intended grant.
Both Cloudflare Access and EmDash must accept the external client. Use a
supported client credential for the MCP route and retain administrator browser
credentials in their existing sign-in path.
