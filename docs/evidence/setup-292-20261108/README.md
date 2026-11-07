# `/setup` surface check — 8 November 2026

Live origin `https://composer.loftwah.com`. The check ran before the batch release
at source `bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` / Worker
`9b384c29-dd33-4172-8c9c-2cb79d7ca175`, and again after it at source
`220a7438545644506ffe6f545604f03a4e0a1f4f` / Worker
`09b67f2d-bca4-4397-ad3f-a871b2f19599`. Both runs returned the same 36 passing
checks; the committed JSON and screenshots are the post-release run, which shows
the updated **Tested setups** counts. Local comparison origin
`http://127.0.0.1:4322` served the same source with no page difference.

`setup-ui-check-live.json` is the raw result of one headless Chromium 156 run
against the live page: 36 checks, all passing. It records

- the initial preview against `/setup/template.md` byte for byte, and the
  `X-Setup-Guide-Version` header;
- blank-field instructions and the absence of unresolved placeholders;
- keyboard order and a visible focus ring for every control;
- copy and download against the preview, after filling the form and after a
  manual edit;
- the manual fallback for a rejected clipboard write and for a missing
  clipboard API;
- reload and reset scope, 600/1600/2400-character fields and a 10,462-character
  guide;
- the 390 layout with no horizontal overflow.

The same script passed 36/36 against the local origin; the live result is kept
because it is the public surface. Screenshots are light-theme full pages at
1440×1000 and 390×844. This check is separate from the agent runs; it never
starts an agent or changes an account.

`prepared-1-mistargeted-receipt.json` is the sanitised receipt of the discarded
first prepared attempt recorded in
[`fresh-agent-20261108.md`](../../evaluations/fresh-agent-20261108.md): it ran in
the source workspace because its copied manifest still named that path. It is
kept for the disclosure, not counted in the baseline.

Reproduce with the ignored script in the run's temporary root (not committed):
the equivalent steps are the preview/textarea, clipboard and download
interactions on `/setup`, plus `curl /setup/template.md`. No application defect
was found, so no runtime source changed for this check.
