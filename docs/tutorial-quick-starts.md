# Tutorial quick starts

Reviewed 16 November 2026. Issue [#489](https://github.com/loftwah/app-composer/issues/489).

Substantial tutorials in this Astro repository use one shared component,
[`src/components/TutorialQuickStart.astro`](../src/components/TutorialQuickStart.astro).
The TL;DR facts, links and prompts live in
[`src/lib/tutorial-quick-start.mjs`](../src/lib/tutorial-quick-start.mjs); the
component renders that data and copies the visible prompt panel without a second
copy of the text.

`validateQuickStart` rejects a guide with no outcome fields, an unsafe link, a
prompt that is empty, too short, duplicated, contains a placeholder, or omits
prerequisites, verification and a human-authority boundary.
[`tests/quick-start.test.mjs`](../tests/quick-start.test.mjs) checks each page
renders the component above its long body, that prompts stay specific and that
the copy helper preserves the exact text and handles denial.
[`tests/tutorial-copy-surfaces.test.mjs`](../tests/tutorial-copy-surfaces.test.mjs)
checks every real prompt against the same copy contract and holds `/learn`'s
lesson-level requests to the shared fallback.

## Covered tutorials

| Route | Source | Guide | Prompt copy | Why it is applicable |
| --- | --- | --- | --- | --- |
| `/learn` | `src/pages/learn.astro` | `firstAppQuickStart` | Visible panel | A step-by-step first-app journey from the workspace check to a verified Hello change. |
| `/media-studio` | `src/pages/media-studio.astro` | `mediaStudioQuickStart` | Visible panel | The build story for an independently owned Media Studio, with source, costs, limits and evidence. |
| `/media-studio/tutorial` | `src/pages/media-studio/tutorial.astro` | `mediaStudioQuickStart` | Visible panel | The chapter walkthrough for the same studio build. |
| `/building` | `src/pages/building.astro` | `buildingQuickStart` | Visible panel | A walkthrough of two independent Workers, a versioned contribution contract and a reproducible local run. |
| `/creator-hub` | `src/pages/creator-hub.astro` | `creatorHubQuickStart` | Visible panel | A two-app Creator Hub reference with an exported Init plan and a real moderation journey. |
| `/paperwork` | `src/pages/paperwork.astro` | `paperworkQuickStart` | Visible panel | A browser-local PDF app with a documented Init reproduction path, pinned source and acceptance record. |
| `/launch-kit` | `src/pages/launch-kit.astro` | `launchKitQuickStart` | Visible panel | A local card/icon/package editor, a CLI renderer and a deliberate publication path. |

Each covered guide offers a reproduction prompt. Where the distinction is real,
it also offers a separate existing-app prompt and either a read-only explanation
or a bounded next step. The prompts name services only, never secret values, and
stop for account sign-in, permissions, publication and spending.

## Copy contract

The prompt panel is the only source of the copied text. The component renders
`{prompt.text}` inside `<pre data-prompt>` and the client copies that element's
`textContent`, so a reader can read and select exactly what the clipboard
receives. `validateQuickStart` also rejects leading or trailing whitespace,
which is the one thing a panel and a copied string could otherwise disagree on.

- `copyTutorialPrompt` reports `copied`, `manual` or `empty`. It never rewrites
  or trims the text it is given.
- A denied permission, a missing Clipboard API or a lost document focus all
  report `manual`. The control then selects the visible text and moves focus to
  it, so the fallback also works with a keyboard.
- Each copy button is a native `<button>` with an accessible name that includes
  the action and the prompt label, and each result is announced through
  `role="status" aria-live="polite"`.
- Copy buttons are server-rendered `disabled` and enabled only when the client
  script runs, so a page with JavaScript unavailable never offers a dead control.
- The disclosure uses native `<details>`/`<summary>`, so keyboard activation and
  touch targets do not depend on script.

Safari's clipboard rules were reviewed by inspection: writes need a secure
context and a transient user gesture, and a rejection must fall back rather than
fail silently. The recorded live check in #489 copied 3,427 characters from
`/building` with the clipboard and the panel byte-identical. A real Safari run is
still outstanding because Remote Automation is disabled on the available host;
no Safari browser check is claimed here. Screen-reader speech and a physical
phone are also unverified.

## Lesson-level requests on `/learn`

`/learn` also carries seven lesson-level agent requests in its article markup.
They are intentionally reader-specific and contain bracketed fields the reader
replaces, so they are not part of the quick start's copy-paste-complete prompts.
They now use the same `copyTutorialPrompt` outcome handling as the shared
component: a denied clipboard selects the request and moves focus to it instead
of only describing the manual step. They remain additive to, not a replacement
for, the shared quick start at the top of the page.

## Excluded tutorials

| Route | Source | Why there is no build prompt |
| --- | --- | --- |
| `/platform/demo` | `src/pages/platform/demo.astro` | Recorded films and evidence, not a reproducible build. The page uses fictional local accounts, virtual passkeys and a film still in preparation; a copied prompt would invent an outcome the page does not claim. |
| `/studio` | `src/pages/studio.astro` | The creator-stacks feature page. The workspace is behind an invited administrator sign-in with no public signup or public build path to copy. |
| `/guide` | `src/pages/guide.astro` | A decision reference across CMS, cloud, commerce and email providers, not one build outcome. Several provider connections are explicitly future work. |
| `/ready` | `src/pages/ready.astro` | Get Ready's `ReadyHandoff` already copies the canonical task prompts from `src/lib/ready-handoff`, with its own status and manual step. A second prompt would duplicate that source. |
| `/ready/guide` | `src/pages/ready/guide.astro` | A human sign-in and domain walkthrough. Its single agent request is the same canonical `ReadyHandoff`; the rest is account and registrar guidance an agent cannot do for the reader. |
| `/setup` | `src/pages/setup.astro` | An interactive generator that already builds and copies one audience-specific project guide, including a manual path in `src/browser/project-setup.ts`. |
| `/prompts` | `src/pages/prompts.astro` | The prompt desk. Templates and previews come from `src/lib/prompt-library` and already offer copy, download, a manual textarea and a status. |
| `/agent` | `src/pages/agent.astro` | One canonical assessment request from `renderPrompt('assess')`, with its own copy control and Markdown download. |
| `/docs`, `/docs/how-it-works` | `src/pages/docs.astro`, `src/pages/docs/how-it-works.astro` | Documentation hub and system explanation, not one reproducible build. |
| `/architecture`, `/platform` | `src/pages/architecture.astro`, `src/pages/platform.astro` | Mission and system explainers. |
| `/migration-example` | `src/pages/migration-example.astro` | A case study of one completed local WordPress migration. The page records observations and open gates rather than a supported reader reproduction, so a copied prompt would over-claim. A follow-up candidate if a migration tutorial is commissioned. |
| `/demo/connected-apps` | `src/pages/demo/connected-apps.astro` | A live composition demo, not a build. |
| `/php2shell`, `/incident-replay`, `/review`, `/effect`, `/benchmarks/compare` | matching pages | Analysis and review tools. |
| `/for/[role]`, `/jobs/[job]`, `/roles` | matching pages | Discovery and role landing pages. |

## Media Studio ownership note

The implementation brief described the `/media-studio` article as CMS-owned and
excluded. In this checkout `/media-studio` and `/media-studio/tutorial` are Astro
pages owned by this repository and both already render the shared component. No
CMS-owned Media Studio article is present here. The existing coverage was
verified and kept rather than duplicated.

## Check

```sh
node --test tests/quick-start.test.mjs tests/tutorial-copy-surfaces.test.mjs
```
