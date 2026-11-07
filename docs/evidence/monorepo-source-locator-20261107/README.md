# Monorepo source locator — in-repo mini-app authoring

Date: 7 November 2026. Issue:
[#408](https://github.com/loftwah/app-composer/issues/408). This is a slice, not
the issue's full acceptance.

## What shipped

A composition source can now name **repository + exact commit + relative
manifest path**. Separate-repository pins keep the implicit root path, so the
active Guestbook/Showcase pins and the guarded promotion pair are unchanged.

- `scripts/source-locator.mjs` — path normalisation, locator validation,
  duplicate and overlapping identity rejection, exact-commit Git tree reading,
  symlink refusal, bounded workspace discovery, and mixed-composition
  validation through the existing contract.
- `scripts/compose-sources.mjs` + `pnpm compose:sources` — validates a
  `composition.sources.json` plan, resolves each manifest from GitHub at the
  exact commit or from an explicitly supplied local checkout, and prints a
  deterministic plan with a content digest. `--stage` writes only to
  `.private/candidates/`. It never writes the active lock, uploads a Worker or
  reads a token.
- `scripts/compose.mjs` — accepts repeatable
  `--source id=owner/repo@sha[:path]` and `--origin id=https://host`, records
  the relative `path` on the lock entry only when it is non-empty, and refuses a
  composition where an app has no own deployed origin. Default behaviour for
  the existing pair is byte-unchanged in meaning.
- `docs/monorepo-composition.md` — the supported shape, path rules, trade-offs,
  commands and the still-open promotion gate.
- `scripts/delivery-channel.mjs` — the project delivery ledger, configured from
  the ignored `.env`. Added in this batch so later deliveries and owner
  visibility use one path.

## Path and identity rules

Relative only; no leading or trailing slash, empty segment, `.`/`..`, backslash,
colon, control character or space. Each segment is
`[A-Za-z0-9][A-Za-z0-9._-]{0,63}` without a trailing dot; hidden segments and
reserved device names are refused. At most 6 segments and 160 characters.

Two sources cannot share the same repository and path, and one path cannot
contain another in the same repository. Manifests must be regular blobs at the
pinned commit; a symbolic link is refused.

## Checks that ran

| Check | Result |
| --- | --- |
| `node --test tests/source-locator.test.mjs` | 9 passed, 0 failed |
| `node --test tests/source-locator.test.mjs tests/core.test.mjs tests/promotion-boundary.test.mjs tests/app-capability-declaration.test.mjs` | 36 passed, 0 failed |
| `node --test tests/delivery-channel.test.mjs` | 4 passed, 0 failed |
| `node scripts/state-ownership.mjs && node scripts/content-source.mjs --lint && node scripts/creator-source.mjs --lint` | passed |
| `node --check` on all three changed scripts | passed |

The source-locator tests use real temporary Git repositories: committed
manifests at exact commits, a committed symlinked manifest, missing paths,
invalid JSON, a 33-app discovery bound, mixed in-repo and external composition,
duplicate and overlapping identities, local exact-commit resolution, a stubbed
GitHub API response, staging, and the refusal to rewrite `composition.lock.json`.

## Fixture plan output

`fixture-plan-output.json` records a real run of the command against a
temporary two-app monorepo, using `--local`. The fixture commit in that file is
synthetic and is not a public repository.

```sh
node scripts/compose-sources.mjs --workspace <tmp> \
  --local guestbook=<tmp>/product --local showcase=<tmp>/product
```

Observed: `state: "checked"`, `lockWritten: false`, `deployed: false`, one
digest, and each source labelled
`fixture/product@<sha>#apps/guestbook` /
`fixture/product@<sha>#packages/miniapps/showcase`.

## What did not run

- No production deployment: this batch changes authoring and validation tooling
  only. The deployed runtime does not import these modules.
- No public page changed, so no browser journey was required.
- No GitHub-hosted monorepo was registered: no first-party host currently keeps
  two mini-app manifests in subdirectories, and creating a new public repository
  is outside this batch. The GitHub resolution path is covered by the stubbed
  API test, not by a live repository.
- No mini-app was promoted from an in-repo path.

## Remaining #408 gates

- A real host repository with two mini-app subdirectories registered and
  composed, with tested route/configuration/action boundaries.
- Promotion support for a same-repo source: `scripts/promotion-boundary.mjs`
  still accepts only the reviewed Guestbook/Showcase pair and derives service
  names from the two known app ids.
- Update, customisation-preservation, incompatible-update rejection and
  rollback evidence for an in-repo app.
- Workspace-aware build scoping and per-app change detection.
- Init/onboarding copy and agent prompts for both layouts. Public pages must not
  imply promotion support before it exists.
