# Activity, outcomes, Creator Hub follow-up and maintenance choice — 12 November 2026

Public and protected verification for the 12 November 2026 delivery plan. This
record states exactly what ran and what remains unverified.

## Release identity

- First release source `75d1b923884d07ba66a480b7101961c1c2537dd7`, Worker
  `c220ace0-6349-4688-bb09-641607733372`.
- Day-preservation follow-up source `1a93d4b59f7f20aadc5ceed8dec7c58b75958634`,
  Worker `64f160ea-70f6-42d5-91da-55ff40739584`; live `/build.json` matches this
  commit.
- Public origin: https://composer.loftwah.com.
- Creator Hub app: `creator-hub.loftwah.com` at
  `b7cd3b3e8f19dbbb76d33fb4266053da928cf586`; no app-source release was needed
  for the presentation follow-up.

## Public Activity

Changed `src/pages/activity.astro`, `src/pages/activity/[app].astro`,
`src/components/AnalyticsTrend.astro`, `src/browser/activity.ts`,
`src/lib/activity-view.ts`, `lib/usage/portfolio.mjs` and
`src/lib/public-report.ts`.

Observed live:

- `/activity?days=30&surface=all&metric=app_opens`: one chart above the app
  comparison and findings, four signal tabs, a scope strip and a UTC day
  readout. The 30-day window showed 3,599 recorded opens and a partial today.
- Selecting 7 Nov 2026 with a pointer updated the URL to
  `...&day=2026-11-07` and the readout to “Sat, 7 Nov 2026 · UTC / 105 /
  Recorded count”. ArrowLeft on the labelled range moved to 6 November and
  updated both the readout and `aria-valuetext`.
- Switching to Guest postcards received kept the inspected day and changed the
  heading in place. The live series showed 3 unavailable days, 26 retained
  zeros, 2 partial days (first retained and today) and no capped day.
- `/activity/linkcheck?days=30&surface=all&metric=inspection_completed&day=2026-11-06`
  opened at the same day and metric. Its comparison links kept the window and
  day, while unsupported signals fell back to app opens.
- `/reports/new?days=30&surface=all&metric=inspection_completed&app=linkcheck`
  previewed “48 Link Check inspections completed” for the same 14 October–12
  November window. The older frozen report
  `/reports/r69e0e7b9ecc786a62746669e` and its landscape, square and portrait
  images returned 200.
- `/activity/linkcheck?surface=composed` kept the unsupported-route explanation
  and the standalone recovery link. It does not report a composed zero.
- No-script HTML contained four chart panels with exactly one visible, four
  native metric links and 120 daily table rows. The chart uses classes only, not
  inline styles.
- Live phone width 390 px: no horizontal overflow; the selected-day readout was
  fully visible at 697–778 px and the plot began at 794 px. Reduced motion
  removed the short selection transition.

Focused checks: `node --test tests/activity-view.test.mjs` (5 passing),
`pnpm check` (620 passing at the first release), Astro check 0 errors/0
warnings.

Demonstrated states: retained zero, unavailable history, first retained day
partial, today partial, unsupported route and unavailable read (the receipt
signal and the composed Link Check scope). A capped lower bound is covered by a
fixture test and app-row `+` styling; no current production day reached the
1,000 ceiling, so a live capped day was not observed.

## Native Analytics & outcomes

Changed `src/plugins/outcomes.tsx` and `src/plugins/outcomes.css`.

Authenticated production check in the existing protected admin:

- Applied scope led the page: `14 Oct–12 Nov UTC · dean · Fictional Trail
  Notes / Trail postcards · both traffic classifications · today is partial`,
  with the last successful report time and export beside it.
- Changing stack, window and traffic showed the pending banner before apply:
  “Filters have changed but are not applied…”. The last successful report and
  its scope stayed visible.
- After apply: 2 published app Open actions, 2 approvals, 2 hides, deletion
  unavailable and 1 retained publication snapshot. The target table named the
  Trail postcards instance.
- ArrowLeft/ArrowRight on the day range, the previous/next buttons and the
  pinned readout worked. The selected day is retained when switching signals in
  the follow-up release.
- Export reported its own query time: “The export query ran at 12/11/2026,
  9:23:37 am UTC.”
- A report request for a workspace the account does not own returned
  `ok:false / FORBIDDEN / This workspace is not yours.`
- The owner-only public preview showed “2 recorded app-instance Open actions”
  for the exact period and traffic, with consent unchecked and no workspace
  name, instance label, record text or scope ID in the snapshot. Nothing was
  published; no new public snapshot was created.
- Phone width 390 px: no horizontal overflow; the applied scope and export
  remained readable.

Not claimed: `#116` closure. Two real stacks with independent actions,
duplicate/retry delivery, retention/deletion checks and supported
link/conversion semantics remain separate acceptance. No classification
setting was changed.

## Creator Hub follow-up

Brief: “Give my curated links more prominence while keeping my approved
postcards available.”

- Before: no featured picks; four links under Other links.
- After: Salt-glaze dinner set and Workshop notes: ash glazes are pinned as
  featured picks 01 and 02 through the app’s existing `/api/presentation`
  owner control. The full collection remains under Other links.
- The approved guest postcard still returned 200 at
  `creator-hub-guestbook.loftwah.com/item/a79f547a-…` and its media URL, and
  the showcase provider still returned it as public. It was not edited, hidden
  or deleted.
- Reversal is unpinning the two cards; no release is required.
- The [Creator Hub case study](https://composer.loftwah.com/creator-hub) now
  records the follow-up with a live after capture at
  `/creator-hub/profile-20261112.webp`.
- Remaining flagship gates (consenting newcomer, full newcomer setup, approved
  Cloudflare Dashboard extension evidence, opt-in Oyster capability) are
  unchanged.

## Optional maintenance choice

Changed `src/lib/spec.mjs`, `src/lib/spec.d.mts`, `src/pages/init.astro` and
`src/lib/init-client.ts`.

- Init offers four stable public tasks: health, live verification, dependency
  updates and accessibility. The selected task, revision 1 and assessment scope
  persist in the portable spec, preview and copied handoff.
- Saving a choice does not execute anything, grant edit/deploy authority or
  schedule a run. Older specs have no `maintenance` field and remain unchanged.
- Live `/init` showed the four options. Selecting “Check that my changes are
  live” produced `{task:"verify",scope:"assess",revision:1}` in the spec and the
  handoff paragraph naming the task, revision, scope and
  `https://composer.loftwah.com/prompts#verify`.
- Focused check: `node --test tests/maintenance-choice.test.mjs` (3 passing).
- The Creator Hub reference’s own `pnpm check` ran from its repository at
  `b7cd3b3e8f19dbbb76d33fb4266053da928cf586`: source check, lint, format check
  and 127 tests passed. This was a manual read-only handoff check; it did not
  deploy or change the app.

Not claimed: connected execution, persisted run receipts or recurrence. Those
remain #311/#289 work, and repeat controls stay unavailable.

## Limits

- The browser-saved Init draft is device-local; the production check used the
  live form without saving a new draft.
- Native outcomes is behind Cloudflare Access; the check used the existing
  authenticated operator session. A fresh unauthenticated request redirects to
  Access.
- No physical-device or social-unfurl proof was added by this delivery.
