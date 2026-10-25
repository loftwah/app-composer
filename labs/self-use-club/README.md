# Self-use club fixture

An App Composer self-use run from 25 October 2026. A fictional club was described
in the real public forms, the resulting specification was exported, a fresh agent
implemented it against an app-owned local D1 database, and a second request was
applied without losing existing content.

This is **one recipe**, not proof that Composer autonomously creates arbitrary
applications. The public forms produced prompt/specification artefacts; the agent
chose the stack, wrote the schema, code, interface and tests. The full account is
[`docs/self-use-club.md`](../../docs/self-use-club.md).

## Layout

| Path | What it is |
| --- | --- |
| `spec/` | Exact Composer outputs: setup guide, build request, three content models, seeds, handoffs and the second change request |
| `app/` | The local Worker/D1 implementation. Fictional records only; no deployment |
| `scripts/` | Replayable acceptance journeys |
| `docs/evidence/selfuse-club-20261025/` | Screenshots, acceptance logs, migration comparison and capture manifest |

## Provenance

- Composer source: `86514680720702ce30157671652981e388b77f65`
- Composer destination: <https://composer.loftwah.com> (production `/build.json`
  returned the same commit)
- Lot: `labs/self-use-club` only. No cloud provisioning, provider account, DNS,
  Access policy, secret, paid service or GitHub Action was used.

## Reproduce

```sh
cd labs/self-use-club/app
pnpm install --prefer-offline
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then run the acceptance scripts in another terminal, with a Playwright module that
is already installed on the host:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/self-use-club/scripts/acceptance.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/self-use-club/scripts/acceptance-volunteers.mjs
```

Both scripts expect a fresh seeded database and are run in that order. They write
the JSON and screenshots under `docs/evidence/selfuse-club-20261025/`. The owner
token is the local fictional default; override it with `RIVERTON_ADMIN_TOKEN` if
the app was started with a different value. Do not use a generic `ADMIN_TOKEN`
environment variable: this host already defines one for unrelated work.

Migration order matters: `0002_volunteers.sql` must be applied before code that
queries the volunteer tables is served. In this run it was applied first; a code
deploy before its migration produced a 500 on `/` and is recorded as a release
ordering lesson, not a data failure.

## Measured checks

At the recorded revision:

- app `pnpm check`: TypeScript clean and **18 tests pass**.
- app `pnpm build`: local Wrangler dry-run build passes (103.74 KiB / 22.14 KiB
  gzip); it uploads nothing.
- Composer changes (download names and setup label): **3 focused tests pass** in
  `tests/content-model-downloads.test.mjs`; the project-setup suite includes the
  label assertion.
- acceptance run 1: 10 journey steps, no unexpected console errors.
- acceptance run 2: 10 journey steps, no unexpected console errors.
- 55 captures at 390/1440 in both themes; no horizontal overflow asserted.

## Boundaries

- Fictional people, addresses, emails, events and notices. No real records.
- No deployment, provider identity, real owner credential, email delivery,
  payment, backup or restore.
- The admin secret is a local bearer secret checked server-side; the public form
  path is not an identity system and grants no account.
- “Reviewed” is an owner decision, not a reply, conversion or sale.
