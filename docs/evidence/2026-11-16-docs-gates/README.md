# Documentation hub acceptance gates — 16 November 2026

Branch `codex/docs-hub-gates-1116`, based on `origin/main` `99d8c69`
(“Make the Apps menu task-first and project-aware”). Live pages were read at
production revision `99d8c699d30129958b429d571aa000b22d9acbf8`
(`/build.json`, 16 November 2026, Australia/Melbourne). Nothing here was
deployed; no issue was closed and no provider was called.

This record covers the remaining #609 acceptance work: deep-link integrity,
the copied-prompt consumer path, the no-JavaScript page, and the interaction
and reflow checks. Earlier copy, contrast and layout evidence is in
`docs/evidence/2026-11-16-docs-copy-a11y/`.

## What was observed, and what changed

### 1. Deep links resolve

Every distinct internal link on live `/docs` was requested at its real route:
**55 links, all HTTP 200**. The 17 `/docs/how-it-works#…` targets, the eight
`/prompts#…` targets and every task guide/next route resolved to an element
with the named id. No dead route or missing anchor was found.

The new test `every task, reference, guide and unavailable result deep-links to
a real route and anchor` now keeps that inventory: every task guide, next step
and related prompt; all 17 reference sections; all 17 guide links; and all six
“not available” closest routes must be a maintained `publicPagePaths` route,
a real prompt id, or a section id rendered by the reference page.

### 2. Copy text is the canonical template, and the note now says so

The live control copied 2,981 characters for “I’m new to AI agents”, matching
`renderPrompt('setup', {}, { template: true }).text`. Keyboard activation
(`focus()` + `Enter`) produced button state **Copied**, the recorded status
sentence, and the prompt on the clipboard.

The old note said the copy was “the same canonical text as the prompt library”.
That was misleading after the library's JavaScript enhancement: the library
defaults to a **completed** prompt (“Exactly what you will copy”), while `/docs`
copies the **template**. The note now says:

> Copies the canonical prompt template. The prompt library’s **Copy template**
> action produces this same text; its completed prompt includes any details you
> add there. Bracketed details are for your agent to inspect, or you can fill
> them in first. Copying runs nothing.

Both actions still come from the single `prompt-library.ts` renderer; no prompt
prose was forked.

### 3. Keyboard Escape after ArrowDown

Observed on live `/docs`:

| Step | Result |
| --- | --- |
| First Tab | “Skip to content” (`href="#main"`) |
| `/` | Search field focused |
| Type `publish` | 1 task, 0 reference, 0 guides, 1 unavailable |
| ArrowDown | Focused `#path-publish`, “Publish and share my app” |
| Escape with the field focused | Cleared to all 6 tasks and 17 guides |
| Escape after ArrowDown moved focus | **Did nothing — defect** |

The hub now clears the filter, restores the full page and returns focus to the
search field when Escape is pressed anywhere in the hub. The search field keeps
its own handler. Covered by the new test “Escape restores the full hub after
ArrowDown moved focus to a result”.

### 4. No-JavaScript page

The server HTML for live `/docs` contains six task articles, six complete prompt
templates (2,981 / 1,496 / 3,620 / 1,498 / 1,521 / 1,582 characters), 17
reference links, 17 guide links and all task actions. Search and copy buttons
carry `hidden` until JavaScript reveals them. The `<noscript>` note explains the
manual selection path.

One real gap: a former fragment link such as `/docs#standalone-get-ready` was
forwarded only by client JavaScript. With JavaScript off, the fragment does
nothing because a server never receives it, and `/docs` has no such id. A second
`<noscript>` block now lists every former section, generated from
`docsReferenceSections`, linked to `/docs/how-it-works#…`. The test “the
no-JavaScript page keeps every former section reachable” covers it. The
JavaScript forward is unchanged for normal visitors.

### 5. Layout, text reflow, contrast and motion

Measured on production `/docs`:

| Viewport | Document width | Horizontal overflow | Primary CTA visible |
| --- | --- | --- | --- |
| 1440 × 900 | 1440 | no | yes |
| 768 × 1024 | 768 | no | yes |
| 390 × 844 | 390 | no | yes |
| 320 × 700 | 320 | no | yes |

Doubled root text (a reflow proxy, **not native Chrome zoom**) at 1440, 768 and
390 had no element extending past the viewport and no page-level horizontal
scroll. Captures: [1440](docs-1440.png) · [768](docs-768.png) ·
[390](docs-390.png) · [390 at 200% text](docs-390-text200.png).

Colour tokens compute to: muted text 5.92:1 light and 8.44:1 dark; accent
links 4.69:1 light and 5.61:1 dark; success 6.12:1 light and 11.12:1 dark —
all AA for normal text. Reduced motion sets `scroll-behavior: auto` and removes
the shared button transition; `/docs` itself has no animation.

### 6. Fresh copied-prompt consumer run — succeeded with one limit

Input: the exact copied “I already have a project” template
(`renderPrompt('assess', {}, { template: true })`), 3,620 characters,
SHA-256 `643caa9bd91e3c2f3c18f0c95527685b8da1f36911fc9696ea9e033fd423ae69`.
It was given alone, as stdin, to `codex exec --ephemeral --skip-git-repo-check
-s read-only` in an owned fictional Git repository.

- Try 1 — `-m gpt-6.1-sol`: failed before any work with
  `model_not_found` (“not supported when using Codex with a ChatGPT account”).
- Try 2 — `-m gpt-5.6-sol`, Codex CLI 0.145.0: completed read-only.
  It reported `main` at `2687ff5…`, compared all 822 tracked bytes with `HEAD`,
  found no modified/untracked/ignored files, ran the documented `node --test`
  once (exit 0, 1 test/1 pass), separated local source, absent Composer pin and
  absent served build, listed supported/bounded/unverified/planned/unsupported
  capabilities, named what it could not verify, and stopped for explicit owner
  authorisation before any change.

Independent before/after tree hash over every non-`.git` file:
`67eb6c1961dc3a01e66dd2cad468af1f54e22e510af7d87a9d81785abe72910d` — identical.
`git status --porcelain --ignored` was empty. The owned fixture root was removed
after the run.

**Limit:** `--ephemeral` starts a fresh session, but this Codex host exposes a
persistent `MEMORY.md`, and the agent did a brief memory lookup. The task input
was only the copied prompt; the context was not a hermetic no-memory host.
Still missing: a second vendor/CLI and the new-project (pre-idea) copied path.

## Checks

| Command | Result |
| --- | --- |
| `node --test tests/docs-hub.test.mjs` | 16/16 pass, 0 fail |
| `pnpm exec astro check` | exit 0 — 0 errors, 0 warnings, 104 pre-existing hints (751 files) |
| `pnpm build` | **blocked before our code**: Astro resolved EmDash through the symlinked `node_modules` path `/Users/deanlofts/gits/app-composer-release/…` while the worktree root is `/private/var/…`, and failed with “No cached compile metadata found … admin.astro”. The worktree has no local install; `astro check` passed on the same tree. |
| Live internal link audit | 55/55 HTTP 200; all 25 fragment targets present |
| Live keyboard/copy check | skip link, `/`, ArrowDown, copy; Escape defect found and fixed |
| Live no-JS HTML audit | six tasks, six prompts, 17+17 links; legacy-anchor gap found and fixed |

## Remaining gates

- The five-person first-visit test, including two non-developers, remains human
  work; no substitute is claimed.
- A second independent agent/vendor and the new-project copied path remain
  unrun. The successful run above covers the existing-project path only and is
  not a hermetic no-memory host.
- Native browser 200%/400% zoom and a physical screen reader were not available;
  the doubled-root-text reflow proxy is labelled as such.
- `pnpm build` needs a local install in this worktree; the release owner should
  run the ordinary clean-checkout gate before integration.
- No production deployment or Discord announcement was made from this branch.
