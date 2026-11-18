# Two-minute routine delivery

[AGENTS.md](../AGENTS.md) sets the two-minute maximum from first relevant edit
through verified production. The [copyable prompt](https://composer.loftwah.com/prompts#delivery)
uses the same budget.

Choose one observable result and the smallest check for its risk. For targeted
tests use `pnpm check:fast -- tests/<area>.test.mjs`. After integrating to main,
run the guarded production release once and verify the affected behaviour.

```sh
COMPOSER_FIRST_EDIT_AT="2026-11-18T01:23:45Z" pnpm deploy
```

Use the timestamp recorded at the first edit. The release writes a redacted receipt to
`.release/timing/` with the guard duration and, after an exact live match, the
first-edit-to-live duration. Composer reports a breach at 120 seconds. A breach
records the bottleneck without interrupting an upload or migration.

At two minutes, record elapsed time, the cause and the next action. Continue
resolving any blocker. Retry pending timing alerts separately from the release
and inspect stale runs with the existing watchdog.

```sh
pnpm release:watchdog --retry-pending
pnpm release:watchdog --check-stuck
```

The [timing report](../benchmarks/release-timing/README.md) reads current and
historical receipts using their recorded limits.
