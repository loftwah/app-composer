# Commit identity

Agents commit as **`Worker <worker@minimax.local>`**. The owner commits as
`Dean Lofts <dean@deanlofts.xyz>`. Both are approved in
`scripts/commit-identity.mjs`.

Lane, worker and model names belong in the branch, PR and work record. They are
not identities, and they must never be turned into a GitHub address.

## Why this exists

On 25 October an agent authored commit `b1a0a145` as
`OpenCode Lane E <lane-e@users.noreply.github.com>`. GitHub attributed it to the
real, unrelated `@LAne-E` account. That is a provenance collision, not evidence
of third-party write access. History was left intact; no signature or past
credit was changed.

## The rule

Blocked:

- `name@users.noreply.github.com` without a numeric account prefix. The real
  form is `12345678+login@users.noreply.github.com`; anything else is a claim
  about an account the author does not own.
- A lane or agent local part (`lane-e@`, `agent.1@`, `bot-3@`) on any domain
  except the approved worker address.
- An empty author email.

Warned, not blocked: a placeholder domain (`example.com`, `localhost`) and an
empty author name. Ordinary addresses pass.

## Commands

```sh
node scripts/commit-identity.mjs --check-config        # the identity this clone will use
node scripts/commit-identity.mjs --range origin/main..HEAD
node scripts/commit-identity.mjs --message .git/COMMIT_EDITMSG
node scripts/commit-identity.mjs --install             # core.hooksPath=.githooks
```

`--install` is opt-in per clone; it points `core.hooksPath` at the tracked
`.githooks/commit-msg`, which rejects a fabricated author or authorship trailer
before the commit exists. Nothing forces it on an existing clone, and no
published commit is rewritten.

`pnpm identity:check` checks the configured name and email. During a commit,
the hook checks the author Git selected, including an explicit author override.

## Portfolio

This follows the Woodhouse portfolio agent-identity guidance
([woodhouse-new AGENTS.md](https://github.com/loftwah/woodhouse-new/blob/main/AGENTS.md))
and the incident record in [App Composer #478](https://github.com/loftwah/app-composer/issues/478).
The checker is small enough to copy into another maintained repository without
pulling a dependency.
