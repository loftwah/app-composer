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
