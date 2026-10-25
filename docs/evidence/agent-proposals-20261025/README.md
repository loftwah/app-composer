# Agent proposals — bounded local evidence

Reviewed 2026/10/25 (Australia/Melbourne). This directory holds the compact
receipt for the local-first proposal slice. The full local run kept its SQLite
database and command responses under ignored `output/agent-proposals-20261025/`.

## What ran

- Node 22.23.4 for `astro check` and the production build; Node 22.23.1 for the
  focused test command.
- One local SQLite file, migration `0016_agent_proposals.sql`, fictional
  workspace `ws-fiction-trail`, app `trail-notes`, isolated Preview
  `env-preview-qa`, account `fiction-composer-preview`.
- `grant → brief → submit v1 → self-approval refused → request changes →
submit v2 → accept → verify → execute refused → handoff → verify`.
- Final state: one proposal, version 2, accepted digest
  `533277ad79fa70e8fc08a5e3b9887c61aec0c597a35e4f16bd139552efee88b3`.
  The handoff is `prepared` with `execution: not-performed`.

The transcript is [transcript.md](transcript.md). The deterministic briefing is
[brief.md](brief.md).

## Checks

- `node --test tests/agent-proposals.test.mjs` — 15 tests, 15 pass.
- `node --test` against the full suite — 1,032 tests, 1,030 pass, 2 pre-existing
  optional-lab failures. On a clean worktree at origin/main `8651468` without the
  sibling Guestbook checkout, the same two tests skipped (7 tests, 5 pass, 2
  skipped, 0 fail). This worktree auto-detects a sibling at a different revision
  (`376129c8…` vs the expected `5075d7be…`). The diff does not touch those tests
  or the Guestbook source.
- `astro check` with Node 22.23.4 — 571 files, 0 errors, 0 warnings, 56 hints.
- Production build with Node 22.23.4 — publication guard passed, 1,244 files and
  150 archive members.
- `pnpm lint` and `pnpm format:check` passed.

`pnpm check` itself cannot run end to end under the default Node 22.23.1 because
Astro 7.4 refuses runtimes below 22.23.4. The equivalent checks above were run
with 22.23.4 where the engine gate applies.

## Admin surface check

The native page was type-checked with the rest of the Astro source. A static CSS
and markup harness using the actual `proposals-page.css` classes measured at
390 × 844:

- `document.documentElement.scrollWidth` = 390, no element exceeded the viewport;
- every button was 44px high; the textarea was 358px wide;
- Tab moved through links, the select, proposal rows, the textarea and the review
  buttons, with a visible 2px solid focus outline and 3px offset;
- public-style links had no underline until hover.

The screenshot [admin-390-harness.png](admin-390-harness.png) records that
harness. It is **not** an authenticated native EmDash capture. Production D1,
Access admission, the real admin route and screen-reader use were not exercised.
