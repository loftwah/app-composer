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
[`tests/quick-start.test.mjs`](../tests/quick-start.test.mjs) also checks each
page renders the component above its long body, that prompts stay specific and
that the copy helper preserves the exact text and handles denial.

## Covered tutorials

| Route | Source | Guide | Why it is applicable |
| --- | --- | --- | --- |
| `/learn` | `src/pages/learn.astro` | `firstAppQuickStart` | A step-by-step first-app journey from the workspace check to a verified Hello change. |
| `/media-studio` | `src/pages/media-studio.astro` | `mediaStudioQuickStart` | The build story for an independently owned Media Studio, with source, costs, limits and evidence. |
| `/media-studio/tutorial` | `src/pages/media-studio/tutorial.astro` | `mediaStudioQuickStart` | The chapter walkthrough for the same studio build. |
| `/building` | `src/pages/building.astro` | `buildingQuickStart` | A walkthrough of two independent Workers, a versioned contribution contract and a reproducible local run. |
| `/creator-hub` | `src/pages/creator-hub.astro` | `creatorHubQuickStart` | A two-app Creator Hub reference with an exported Init plan and a real moderation journey. |
| `/paperwork` | `src/pages/paperwork.astro` | `paperworkQuickStart` | A browser-local PDF app with a documented Init reproduction path, pinned source and acceptance record. |
| `/launch-kit` | `src/pages/launch-kit.astro` | `launchKitQuickStart` | A local card/icon/package editor, a CLI renderer and a deliberate publication path. |

Each covered guide offers a reproduction prompt. Where the distinction is real,
it also offers a separate existing-app prompt and either a read-only explanation
or a bounded next step. The prompts name services only, never secret values, and
stop for account sign-in, permissions, publication and spending.

## Excluded tutorials

| Route | Source | Why there is no build prompt |
| --- | --- | --- |
| `/platform/demo` | `src/pages/platform/demo.astro` | Recorded films and evidence, not a reproducible build. The page uses fictional local accounts, virtual passkeys and a film still in preparation; a copied prompt would invent an outcome the page does not claim. |
| `/studio` | `src/pages/studio.astro` | The creator-stacks feature page. The workspace is behind an invited administrator sign-in with no public signup or public build path to copy. |
| `/guide` | `src/pages/guide.astro` | A decision reference across CMS, cloud, commerce and email providers, not one build outcome. Several provider connections are explicitly future work. |

Other code-owned pages reviewed and left alone: `/setup` is an interactive
setup-guide generator that already produces and copies an audience-specific
guide; `/demo/connected-apps`, `/ready/guide` and `/docs/how-it-works` explain a
system rather than walk through one reproducible build; `/php2shell` is an
incident analysis.

## Media Studio ownership note

The implementation brief described the `/media-studio` article as CMS-owned and
excluded. In this checkout `/media-studio` and `/media-studio/tutorial` are Astro
pages owned by this repository and both already render the shared component. No
CMS-owned Media Studio article is present here. The existing coverage was
verified and kept rather than duplicated.

## Check

```sh
pnpm check:fast -- tests/quick-start.test.mjs
```
