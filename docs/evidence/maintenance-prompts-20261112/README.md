# Maintenance task catalogue — 12 November 2026

Public catalogue release for #428, delivered by PR
[#429](https://github.com/loftwah/app-composer/pull/429).

| Fact | Value |
| --- | --- |
| Production source | `3292200c9951a979fc08e000790e82a6857d5f76` |
| Worker | `app-composer`, version `adab0620-4a81-45ea-8e88-a1add6048899` |
| Live URL | <https://composer.loftwah.com/prompts> |
| Live identity | `/build.json` reports the same source |
| Catalogue | 46 jobs: 28 existing, 18 new maintenance tasks |
| Source mapping | H0 and prompts 1–22 all mapped in `maintenancePromptSourceMap` |

## What changed

- 18 new task modules covering health, bugs, failing checks, regressions, unused
  code, simplification, updates, performance, accessibility, security, data
  integrity, queries, documentation, unfinished work, review, instructions,
  skills and reusable workflows.
- Existing incident, verification and operating-kit jobs reuse the same
  contract instead of duplicating outcomes.
- Two maintenance shortcuts and new search examples on `/prompts`.
- New tasks assess and report by default. The optional **Changes already
  authorised** field records existing change scope; blank keeps the task
  read-only.
- No renderer, draft-key, Init, executor or schedule format changed.

## Verification

Local preview used the normal `pnpm dev` app; production checks ran against
`https://composer.loftwah.com`.

- 46 jobs render; every nav target and related-job link resolves. All 23 source
  entries map to existing job IDs.
- `/prompts#health` and `/prompts#updates` inspected at 1440 × 1000 and
  390 × 844 in both themes. No horizontal overflow; the index scrolls on phone
  and stays sticky on desktop.
- Quick links, sidebar links, direct fragments, browser history, search
  (`bug`, `updates`) and the no-results state work.
- Missing required review input is reported, marked invalid and focused. The
  completed preview, clipboard text and downloaded Markdown are identical;
  template copy contains `Your project: [PROJECT]`.
- Old existing-module drafts and new health-task drafts save and restore.
  Version 2, unknown fields and unknown modules are rejected without changing
  current entries. The Init draft key is not touched.
- Server HTML contains all 46 articles and 46 non-empty templates with
  enhancement controls hidden.
- Keyboard activation now reveals the focused task heading with the 3px focus
  outline. This was the one defect found in the prepared branch and is fixed in
  `4574984`.
- `pnpm check:fast -- tests/fast-delivery-prompt.test.mjs` passed during
  implementation. The guarded `pnpm deploy` then ran the required 608-test
  check, production build, migrations, upload and every live gate on the merged
  candidate.

The first guarded attempt stopped before any remote mutation because
`tests/content-project.test.mjs` timed out its 10-second project-write helper
under full-suite load. The same test passed alone; the rerun passed the full
608-test gate. No test or guard was skipped.

## Screenshots

Production, 12 November 2026:

- `prompts-desktop-dark.png`
- `prompts-desktop-light.png`
- `prompts-phone-dark.png`
- `prompts-phone-light.png`

## Limits

This is the catalogue slice. It does not select tasks during Get Ready/Init,
run an agent, persist run results or enable recurrence. Those outcomes remain
open in #428, with connected execution in #311 and scheduling in #289. A copied
prompt is not a running task, and a proposed fix is not verified delivery.
