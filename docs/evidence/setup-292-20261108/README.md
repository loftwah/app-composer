# `/setup` surface check — 8 November 2026

Live origin `https://composer.loftwah.com`, production source
`bcc8eca78c84cd5f2d7b6afad39150d81d51d89a`, Worker
`9b384c29-dd33-4172-8c9c-2cb79d7ca175`. Local comparison origin
`http://127.0.0.1:4322`, serving `main` `3819c953ce1b7844137c742d70c8f371e075f2d9`
with no source difference since the release.

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
