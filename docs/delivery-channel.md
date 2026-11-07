# Delivery channel

The project posts one short update to its Discord channel each time a coherent
batch reaches `main` or production. It is the owner's showcase and running
ledger: what shipped, which issues it belongs to, what to look for, and what is
still blocked.

It is not a second release system. Issues, `docs/STATUS.md`,
`docs/evidence/<batch>/README.md` and issue #11 stay authoritative.

## Configuration

The webhook lives in the ignored `.env` or the process environment:

```sh
WOODHOUSE_DISCORD_CHANNEL=https://discord.com/api/webhooks/...
```

Never commit, print, screenshot or quote it. `scripts/delivery-channel.mjs`
redacts any webhook-shaped URL before building a payload.

## Command

```sh
pnpm delivery:announce --file announcement.json          # dry run
pnpm delivery:announce --file announcement.json --send    # post
```

A dry run prints the exact message and whether a webhook is configured. It never
opens a connection.

## Stage labels

[AGENTS.md](../AGENTS.md) and the shared
[Woodhouse showcase contract](https://github.com/loftwah/woodhouse-new/blob/main/docs/DISCORD_SHOWCASE.md)
own the current stage vocabulary. Put the exact stage in the entry title:

- `MERGED_TO_MAIN` — integrated code, not a shipped claim.
- `PRODUCTION_VERIFIED` — the released source/version and a real affected-flow
  live check.
- `DOCS_TOOLING_DONE` — non-runtime work on `main` with its focused check; do
  not redeploy an unchanged product.
- `BLOCKED` / `RELEASE_FAILED` — with the exact reason and next action.

Use one transport per outcome. The native command below is sufficient; never
post the same outcome through both it and the shared wrapper. The native command
has no durable deduplication, so reconcile an uncertain send before retrying.

## Announcement shape

```json
{
  "title": "Monorepo source locator",
  "summary": "A composition can pin a mini-app subdirectory at an exact commit.",
  "commit": "3e86a5c",
  "production": "bbe9e224",
  "deployed": false,
  "issues": [
    { "number": 408, "state": "slice", "note": "Promotion still gated" }
  ],
  "checks": ["36 focused tests passed", "lint passed"],
  "evidence": "https://github.com/loftwah/app-composer/blob/main/docs/evidence/monorepo-source-locator-20261107/README.md",
  "ownerActions": "None for this slice",
  "next": "Plugin Trust watch depth"
}
```

- `title` and at least a truthful state are required. `title` is capped at 120
  characters; free text is capped so the post stays inside Discord's limit.
- `issue.state` is one of `closed`, `slice`, `status`, `still-open` or `blocked`.
  Use `closed` only when the issue's own acceptance is met.
- `deployed: true` means the changed runtime was released and the live source
  identity was verified. Documentation, tests and internal tooling set it to
  `false` even though they reached `main`.
- `checks` lists what actually ran, including honest failures. Never list a
  skipped or fabricated check.
- `ownerActions` names the exact human step when one is required.

## What makes a useful entry

- Plain language first: what a person can now do that they could not before.
- The issue numbers, so the channel and the backlog line up.
- The evidence link, so a reader can inspect the receipt rather than trust the
  summary.
- The next step, so the channel shows direction rather than a pile of finished
  tickets.
- No claim of physical-device, provider, security-assurance or commercial
  acceptance unless that specific check was performed.
