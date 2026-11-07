# Owner-enabled daily Plugin Trust watch — 8 November 2026

Issue: [#365](https://github.com/loftwah/app-composer/issues/365). This is the
scheduled watch slice. The shared Inbox item, advisory feeds and installation
receipts remain separate gates.

## Production identity

- Composer source `c3149d90a1db56b6e02d98b9198c2f93d5887ea3` (`c3149d9`).
- Worker version `2a1bdf8c-435a-4d07-a6d3-dbc14cbaac8b`.
- Released through `pnpm deploy` from clean pushed `main`; the full check, build,
  remote migration `0022_plugin_trust_watch.sql`, upload and live gates passed.
- `/build.json` returns the same commit.

The feature first shipped at `c2b63c5` / `0da78541`; the public copy was
corrected at `c3149d9` so it stays true after the owner enables the control.

## What now works

- **Owner control in the existing Trust Centre.** The private page shows whether
  the daily watch is off or on, the last run and its state, the last successful
  observation and any failure code. **Enable daily watch** / **Pause daily
  watch** calls the existing owner-only plugin route. The default is off.
- **Scheduled, bounded observation.** The existing `* * * * *` Worker cron now
  runs the watch at 00:00 UTC when enabled. A 20-hour guard prevents a second
  run. The Worker adapter issues only two fixed aggregator GETs, refuses
  redirects, times out at 10 seconds and caps each response at 512 KB.
- **Shared refresh mapping.** The CLI and the Worker use the same
  `refreshPluginTrust` function. The installed discovery client is still used by
  the CLI; the Worker uses its own bounded adapter. A new release drops stale
  artifact inspection evidence instead of carrying it forward.
- **Durable, deduplicated review items.** Migration `0022` adds
  `composer_plugin_trust_watch` (single row, disabled by default) and
  `composer_plugin_trust_reviews` (stable key, first/last seen, open/resolved).
  A repeated observation does not create another item. The owner can **Mark
  reviewed** on any open item.
- **Honest failure states.** A failed or partial observation keeps the last good
  snapshot and records `registry-unavailable`, `partial-observation` or
  `snapshot-too-large`; it never looks green.

## Checks that ran

| Check | Result |
| --- | --- |
| Real `workerDiscovery` + `refreshPluginTrust` against the live registry | Both curated packages returned `ok`; Freeform 1.3.0 and Stripe 0.10.6; inspected SHA-256 and capability/host evidence retained |
| `node --test tests/plugin-trust-watch-run.test.mjs` | 8 passed |
| `node --test tests/plugin-trust-route.test.mjs` | 8 passed |
| `node --test tests/plugin-trust-discovery.test.mjs` | 5 passed |
| Existing `tests/plugin-trust-watch.test.mjs` | 7 passed |
| `pnpm check:types` | 0 errors |
| `pnpm build` | publication guard passed (1,294 files, 150 archive members) |
| `pnpm deploy` | full check, build, migration, upload and every live gate passed |
| Live D1 after deploy | `composer_plugin_trust_watch` and `composer_plugin_trust_reviews` exist; zero rows until the owner enables the watch |

## Remaining gates

- The admin control was not clicked in this run: the available automation
  browser had no Cloudflare Access session. The route, persistence, review and
  scheduled engine are covered by the tests above; the owner action is to open
  the signed-in Trust Centre, enable the daily watch and confirm the first run
  after 00:00 UTC.
- Review items are persisted and shown in the Trust Centre, not yet written into
  the shared Inbox. Advisory feeds, install receipts, financial fields and the
  owned fork/rescue workflow remain open on #365.
- A failed run is recorded and the previous evidence is retained; no alert is
  emailed because owner email is #117/#367 work.
