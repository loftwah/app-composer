# Agent discovery and fit assessment — 7 November 2026

Scoped [#376](https://github.com/loftwah/app-composer/issues/376) live acceptance.
The public one-URL agent path, its copy/download behaviour, and the recorded
fresh-agent fit/adoption evidence were checked on production.

Production: Composer `bbe9e2246a853b37904ae22a55350f3d2ad3cf43` / Worker
`4c2683dd-9916-4864-aa2d-09e3c35cd164`.

## Public paths

- `https://composer.loftwah.com/agent` returned `200`. The page serves the
  complete 3,448-byte assessment request, a copy button and a Markdown download.
  Clicking **Copy the request** in the real browser produced:
  “Request copied. Paste it into a fresh agent session in your project folder.”
- `https://composer.loftwah.com/agent.md` returned `200` as
  `text/markdown; charset=utf-8` (6,037 bytes).
- `https://composer.loftwah.com/prompts` returned `200` and contains the
  prominent **Should we use App Composer? Assess this project →** link to
  `/agent`.
- `/setup` and `/roles` returned `200`; the page links both as supporting
  material.

The request tells an agent to start at the public origin, inspect the selected
project read-only, preserve owner work, separate supported/bounded/documented/
planned claims, avoid credentials and private records, and stop before any
change without authorisation. A successful answer can be **yes, partly or no**.

## Fresh-agent evidence already recorded

- **Codex CLI 0.145.0 / gpt-5.6-sol** on the unrelated
  [Liferaft](https://github.com/loftwah/liferaft) Electron app: partial fit,
  keep Electron and local mailbox recovery, adopt verification practice. One
  separately authorised two-script adoption was independently verified (11
  tests, 0 fail) and merged as Liferaft PR #2. No Composer runtime was adopted.
- **OpenCode CLI 2.1.4** five fresh sessions: new project, existing change,
  interrupted resume, unsafe QA refusal and owner-customisation preservation;
  42/42 assertions, 0 human interventions, 0 contaminated sessions.
- Reports: [`real-project-adoption-20261025.md`](../../evaluations/real-project-adoption-20261025.md),
  [`url-first-20261025.md`](../../evaluations/url-first-20261025.md),
  [`fresh-agent-20261025.md`](../../evaluations/fresh-agent-20261025.md),
  [`existing-projects-20261025.md`](../../evaluations/existing-projects-20261025.md).

No account, paid model call, provider credential, deployment or customer data
was needed for the public path.

## Checks

- `/agent`, `/agent.md`, `/prompts`, `/setup` and `/roles` all returned `200`.
- Copy action and status message verified in the real browser.
- 1440 × 1000 and 390 × 844 captures: `agent-1440.jpg`, `agent-390.png`.
- `receipt.json` records the exact live checks and bytes.

## Residual scope

The published evidence is from two client/model paths; another consumer is still
worth exercising over time. Physical-device/screen-reader acceptance remains a
general accessibility gate. This does not block the one-URL discovery, fit
decision, selective adoption and truthful publication acceptance.
