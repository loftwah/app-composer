# Connected agent — bounded local transcript

2026-10-25 (Australia/Melbourne). One explicitly owned temporary root,
`<TMPDIR>/composer-lane-d-20261025`, holding one SQLite file and the disposable
client probes. It was removed after the run; only this redacted transcript is
committed. Node 22.23.4. No deployment, production D1 change, Cloudflare
credential, Git credential or paid action was used.

## Client

- Transport: MCP over stdio, `scripts/agent-proposal-mcp.mjs`.
- Driving client: `@modelcontextprotocol/client` 2.4.0 (`Client` +
  `StdioClientTransport`), the same protocol an OpenCode or Codex client speaks.
- Installed Codex CLI 0.145.0 was configured for the endpoint, but a
  model-driven turn was blocked before any tool call. See **Blocker** below.

## Grant

```
grant  grant-41c06fc5-bad9-4feb-9d59-dc8664a472a9
state  active → revoked
mode   proposal-only
scope  workspace ws-lane-d-20261025 · app app-composer · local/env-local-lane-d · account local-checkout · role pack qa
agent  agent:codex/0.145.0 (Codex CLI 0.145.0)
owner  fictional-owner-0001 / Ada Nguyen · fallback fictional-owner-0002 / Sam Okafor
expiry 2026-10-25T07:45:24Z (six hours, requested by the owner)
credential prefix ec_agent_nrx8GmNk · hash only at rest
```

The raw credential is deliberately not reproduced here. The end-of-run grant row
reads:

```json
{
  "connection_hash": "2ee5f980a9d70ae05ee084b43f38e8bcfa37ea8575a4decbfa40afc87375d671",
  "connection_prefix": "ec_agent_nrx8GmNk",
  "connection_issued_at": "2026-10-25T01:45:24.473Z",
  "connection_last_used_at": "2026-10-25T01:51:59.686Z",
  "revoked_at": "2026-10-25T01:53:22.604Z"
}
```

The serialized row does not contain the raw value or its tail.

## Owner view (native route, same handler the admin page calls)

`grants`:

```json
{
  "workspace": {
    "id": "ws-lane-d-20261025",
    "name": "Lane D connected agent",
    "role": "owner"
  },
  "capabilities": ["scope:read", "briefing:read", "proposal:submit"],
  "reserved": 7,
  "apps": 8,
  "members": [
    { "id": "fictional-owner-0002", "name": "Sam Okafor", "role": "editor" },
    { "id": "fictional-owner-0001", "name": "Ada Nguyen", "role": "owner" }
  ],
  "grants": [
    {
      "id": "grant-41c06fc5-bad9-4feb-9d59-dc8664a472a9",
      "state": "active",
      "app": "app-composer",
      "environment": {
        "id": "env-local-lane-d",
        "kind": "local",
        "account": "local-checkout"
      },
      "rolePack": "qa",
      "agent": { "id": "agent:codex/0.145.0", "name": "Codex CLI 0.145.0" },
      "owner": { "id": "fictional-owner-0001", "name": "Ada Nguyen" },
      "fallback": { "id": "fictional-owner-0002", "name": "Sam Okafor" },
      "expiresAt": "2026-10-25T07:45:24Z",
      "connection": {
        "issued": true,
        "prefix": "ec_agent_nrx8GmNk",
        "issuedAt": "2026-10-25T01:45:24.473Z",
        "lastUsedAt": "2026-10-25T01:51:59.686Z"
      }
    }
  ],
  "execution": "not-performed"
}
```

Before the owner's `creator_members` row existed, the same request was refused:

```json
{
  "refused": true,
  "code": "FORBIDDEN",
  "message": "This workspace is not yours."
}
```

That is the membership check, not the grant, deciding access.

## Connected client

`tools/list` — exactly three tools, no review or handoff:

```
agent_capabilities  Read the granted scope … plus the actions reserved for humans. Read-only. No arguments.
agent_brief         Derive or re-read the scoped briefing … Briefing is not approval.
agent_submit        Submit a reviewable proposal version … performs no execution.
```

`agent_capabilities` (excerpt):

```json
{
  "ok": true,
  "version": "composer.agent-connection/1",
  "workspace": "ws-lane-d-20261025",
  "app": "app-composer",
  "environment": {
    "id": "env-local-lane-d",
    "kind": "local",
    "account": "local-checkout"
  },
  "rolePack": "qa",
  "rolePackVersion": "1.0.0",
  "agent": { "id": "agent:codex/0.145.0", "name": "Codex CLI 0.145.0" },
  "owner": { "id": "fictional-owner-0001", "name": "Ada Nguyen" },
  "fallback": { "id": "fictional-owner-0002", "name": "Sam Okafor" },
  "grant": "grant-41c06fc5-bad9-4feb-9d59-dc8664a472a9",
  "expiresAt": "2026-10-25T07:45:24Z",
  "capabilities": [
    { "id": "scope:read", "authority": "read" },
    { "id": "briefing:read", "authority": "read" },
    { "id": "proposal:submit", "authority": "propose" }
  ],
  "reserved": [
    "Review, accept, request changes on or reject any proposal.",
    "…"
  ],
  "execution": "not-performed"
}
```

`agent_brief` — the agent supplied one evidence item it had just observed:

```json
{
  "briefing": {
    "id": "brf-27ac98e7964d3f33e258ca4472ae9688",
    "digest": "27ac98e7964d3f33e258ca4472ae968841b5a0bd3887300a9e625622346430db",
    "created": true,
    "asOf": "2026-10-25T01:51:59.681Z",
    "environment": {
      "account": "local-checkout",
      "id": "env-local-lane-d",
      "kind": "local"
    },
    "permittedEvidence": ["ev-build-json"]
  }
}
```

The evidence it recorded was a real failure it reproduced on the checkout by
removing the generated `src/lib/build.json`:

```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/lib/build.json'
#   imported from …/src/lib/private-outcomes.ts
```

`agent_submit`:

```json
{
  "proposal": {
    "id": "prop-e2767802-afa7-4d3f-a746-aea5ec4b8d69",
    "version": 1,
    "state": "submitted",
    "digest": "3f6c989513e70ea924714c531db4873a97f7523fce76102b34d200088955bc3c",
    "risk": "low",
    "app": "app-composer",
    "environment": {
      "id": "env-local-lane-d",
      "kind": "local",
      "account": "local-checkout"
    },
    "rolePack": "qa",
    "submittedAt": "2026-10-25T01:51:59.686Z",
    "nextAction": "Review the exact digest. Accept, request changes or reject. Accepting does not execute anything.",
    "execution": "not-performed"
  },
  "deduplicated": false
}
```

Source: local path `package.json`, content hash
`6d3a934b52894729557d1560ea36afb42682fa1cf90640b680b309d19e71342f`, 1 file,
5010 bytes, checked at submission by the endpoint itself.

`agent_review` — refused at the protocol boundary, before any store call:

```
{"refused": true, "code": -32602, "message": "Tool agent_review not found"}
```

## Native queue and human decision

`list` showed one proposal with state `submitted`, the same digest, the agent as
proposer and `execution: not-performed`.

`review` with `decision: accept`, the exact expected digest and a written reason:

```json
{
  "state": "accepted",
  "accepted": {
    "digest": "3f6c989513e70ea924714c531db4873a97f7523fce76102b34d200088955bc3c",
    "version": 1,
    "by": "Ada Nguyen",
    "at": "2026-10-25T01:53:11.272Z"
  },
  "reviews": [
    {
      "decision": "accept",
      "actor": { "id": "fictional-owner-0001", "name": "Ada Nguyen" },
      "reason": "Checked the exact digest, the real failing test reproduction and the bounded package.json diff. Accepting executes nothing."
    }
  ],
  "handoff": null,
  "nextAction": "The digest is accepted. Prepare a separate handoff for the existing release flow; acceptance alone executes nothing.",
  "execution": "not-performed",
  "handoffRows": 0
}
```

No handoff row, no deployment, no provider call. The accepted change is a
proposal about this repository; nothing in it was applied by this workflow.

## Revocation

`grant-revoke` by the accountable owner:

```json
{
  "grant": "grant-41c06fc5-bad9-4feb-9d59-dc8664a472a9",
  "state": "revoked",
  "revokedAt": "2026-10-25T01:53:22.604Z",
  "revokedBy": "Ada Nguyen",
  "execution": "not-performed"
}
```

Further use, with the same credential:

```
Agent endpoint did not start: GRANT_REVOKED: This proposal grant was revoked.
A new owner-issued grant is required.
```

```
$ COMPOSER_AGENT_TOKEN=… node scripts/agent-proposal.mjs scope --db … --grant …
Refused (GRANT_REVOKED): This proposal grant was revoked. A new owner-issued grant is required.
Human action: Ask the accountable owner for a new grant.
```

## Blocker: model-driven Codex turn

Codex CLI 0.145.0 was configured with `mcp_servers.composer_agent` (stdio, token
passed through `env`) and launched with `codex exec --json`. It never reached a
tool call:

```
$ codex exec -m gpt-5.6-luna … "…"
{"type":"turn.failed","error":{"message":"You've hit your usage limit. Visit
https://chatgpt.com/codex/settings/usage to purchase more credits or try again at
Oct 31st, 2026 4:59 AM."}}
```

Alternatives checked, each refused for its own reason:

- `gpt-6.1-sol` (the owner profile model) is not available to a ChatGPT account:
  `model_not_found`.
- The environment's `OPENAI_API_KEY` is rejected by `api.openai.com`:
  `Incorrect API key provided`.
- The only installed Ollama model
  (`hf.co/mradermacher/Skyfall-31B-v4.2-heretic-GGUF:Q4_K_M`) reports
  `does not support thinking` and, with reasoning disabled, the Codex request
  (…192k tokens) exceeds its 32k context.

Smallest operator step: restore Codex usage or supply a valid API key, then run
the unchanged `codex exec` command in [Connect your agent](../agent-connect.md).
The MCP endpoint, credential checks, proposal, review and revocation above are
real; the model-driven turn is not claimed.
