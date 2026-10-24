# Portable setup guide evaluation

The public `/setup` UI exports `app-composer.project-setup/1`. This lab records actual fresh-agent attempts; deterministic renderer tests are never agent attempts. `runs.json` starts empty. No first-account, external-stack or continued-reliability qualification is inferred from that baseline.

## Run a case

1. Use one explicitly owned disposable root and register its cleanup before preparing a fixture. Preserve unrelated worktrees, sessions and data. Use only fictional data and an authorised local target.
2. Obtain the actual copy/download from `/setup`. Keep the exact Markdown privately under ignored `output/` and run `node scripts/setup-evaluation.mjs --hash-export /absolute/export.md`. Do not repair it offscreen or put private project values into the public ledger.
3. Start a fresh agent session with that Markdown, a named fixture checkout and only documented access. Record client/model, OS, tools and provisioned accounts. A new checkout with an existing signed-in account is not first-account onboarding.
4. Observe its execution. Independently run the documented assertions and exercise the resulting app. Retain every failure and retry. Record documented sign-in/consent in `humanActions`; record avoidable coaching/rescue in `interventions`. A required documented human step can still be a first-attempt completion; rescue must use `completed-after-rescue`. Date each attempt in UTC; evidence receipts also display Australia/Melbourne and UTC as YYYY/MM/DD.
5. Publish a sanitised issue/source receipt with actual guide hash, fixture commit, checks, results, timestamps and intervention details. Add its bounded record to `runs.json`; unknown fields and duplicate identities fail validation. Do not publish secret values, private logs, personal project inputs or credential locations.
6. Run `node scripts/setup-evaluation.mjs --summary` and `node --test tests/project-setup.test.mjs`. The public Tested setups view consumes this same ledger. Clean only the owned disposable root on success and failure; retain useful bounded evidence, never an entire temporary project.

## Versioned external fixtures

`fixtures/existing-python` is a complete fictional Python standard-library site with owner configuration, an unrelated exact-byte marker and five independent assertions. Check its baseline without writing bytecode:

```sh
cd labs/setup-evaluation/fixtures/existing-python
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v
```

The tests start and stop only their own localhost HTTP server. A deterministic baseline is not an agent run or a browser check. For an actual attempt, copy the fixture into the one owned disposable root, make a separate local Git commit, record that exact commit, and retain a deliberately dirty unrelated edit in addition to the committed owner marker. The independent verifier compares both after setup. Never run an agent against this maintained fixture in place.

`fixtures/new-python` documents a new-project starting folder and the exact ordinary user choices to put into the real UI export. Its local inspect-and-adapt result remains distinct from the supported Composer Hello deployment path. No hidden operator instruction or repair is part of the fresh-session input.

## Initial fixture rotation

- **new:** the maintained Hello path on its declared Mac/Node 22 environment; an existing authorised account and an unused existing-account destination when deployment is explicitly selected.
- **existing:** a pinned external project on a different stack, such as a small fictional Python standard-library HTTP app. Include a custom text/config file and a dirty unrelated edit; independently compare their bytes after setup.
- **prepared:** repeat the same fixture, checking that prepared dependencies/resources are reused.
- **resume:** a controlled missing-access step; record `simulated: true` for simulated provider failures. Reopen with documented progress and check that no duplicate effect occurs.
- **follow-up:** a second fresh session changes a small feature and verifies both the previous customisation and new behaviour.
- **failure:** missing permissions or incompatible runtime must be accurately diagnosed without a guessed repair or account switch.

At least three independent fresh sessions for each new/existing core path are required by #292. Other clients/models and later dated revalidation remain separate coverage. The evidence must state exactly what was exercised. A deterministic script cannot substitute for those sessions.

## Revalidation ownership

The existing Composer operator workflow under #19 owns execution. Proposed cadence is a weekly representative rotation **after a measured initial baseline establishes an explicit per-run model/resource budget**. No automatic task, paid agent invocation or provider mutation is created by this lab. Until that owner/budget is recorded and the first recurring run is executed, ongoing operation remains an open #292 gate. On a failed run, retain it, stop repeated unchanged retries, and update one actionable regression with the reproduction before the next attempt. Re-run affected cases after substantive instruction, dependency, model or provider changes. Do not claim reliability over time until later dated attempts exist.
