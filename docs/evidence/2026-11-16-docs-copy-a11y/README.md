# Documentation copy, accessibility and Media Studio claim corrections

2026/11/16 Australia/Melbourne (AEDT, UTC+11). Branch `codex/batch-docs-1115`,
based on `origin/main` `951b313`. Owner surfaces: #609 (task-first docs),
#495 (first impression), #459/#457 (Media Studio article and tutorial).

This is a local source and browser record. Nothing here was deployed, no issue
was closed and no provider was called. Live comparison used the public
production revision `3540bf9` under the build identity
`composer.loftwah.com/build.json`.

## What was wrong, and what changed

### 1. Copy controls — silent outcomes and duplicate names (#609)

Measured on live `/docs` at revision `3540bf9` before any edit:

| Observation | Before | After |
| --- | --- | --- |
| Copy controls | 6, all exposed with the identical accessible name “Copy prompt template” | 6, each named with its task, e.g. “Copy prompt template: I already have a project” |
| Outcome feedback | One status sentence below the button; no button state, no reset | Per-control status (“Copied…” / “Copy failed — …”) with an explicit `aria-live="polite"` region, `aria-atomic`, a success or failure border state, and the button label changing to “Copied” |
| Clipboard denied or absent | Same catch path, but the message was the only cue and the control never changed | The disclosure opens, the full prompt is selected and focused, and the status names the manual step; focus moves 60 ms after the announcement |
| Clipboard API missing entirely | `navigator.clipboard.writeText` threw inside `try` | Guarded before the call; the same visible manual fallback runs |
| Empty prompt text | Copied an empty string silently | Reported as “the prompt text did not load”; nothing is written |
| Malformed URL fragment (e.g. `#%`) | `decodeURIComponent` threw at module top level, so no search or copy behaviour initialised | Caught; search and every copy control still initialise |
| Reset | Never | Success clears after 6 s, failure after 12 s; the opened, selected prompt stays |

The decision itself is now a small DOM-free module, `src/lib/docs-copy.ts`,
so denial, an absent Clipboard API and empty text are exercised by real unit
tests rather than string matching.

### 2. Copy-control status verified in Chromium

Keyboard only (`focus()` + `Enter`, document focused):

- Resolving clipboard: status “Copied. Paste it into your chosen agent, then
  answer or replace the bracketed details.”, button label “Copied”, 2,981
  characters written, green status at 11.2:1 contrast.
- Rejecting clipboard (`NotAllowedError`, the denied/unfocused path): status
  “Copy failed — the full prompt is open and selected below. Copy it with your
  keyboard shortcut or your device’s copy menu.”, `data-copy-state="failed"`,
  disclosure open, 2,981 characters selected, focus on the labelled prompt
  region, status text at ~15:1 against the light page.
- No `navigator.clipboard` at all: identical manual fallback.
- Captures: [desktop dark, copied](docs-1440-dark-copied.jpg) ·
  [phone light, copy failed with selected text](docs-390-light-copy-failed.jpg).

### 3. Accessibility audit of `/docs`

| Check | Result |
| --- | --- |
| Heading order | H1 first in `main`; no skipped levels (the launcher’s H2 lives in a closed dialog and is not exposed) |
| Landmarks | `header`, `nav[Main navigation]`, `main`, `nav[Six task paths]`, `footer`; six task articles now have `aria-labelledby` |
| Skip link | First Tab reveals “Skip to content” at the top with the shared focus outline; target is `#main` |
| Focus order | skip → brand → Learn → Get Ready → Demos → More → Apps → theme → “Get a prompt for my agent” |
| Prompt region | Each `<pre>` is `tabindex="0"`, `role="region"`, labelled “Prompt template for: …” |
| Muted text contrast | light 5.92:1, dark 8.44:1 (AA for normal text) |
| Status contrast | success 11.2:1 on dark; failure ~15:1 on light |
| 200% / narrow reflow | no horizontal overflow at 320, 390, 720 (200% of 1440), 1440 or 1728 px |
| Reduced motion | `scroll-behavior: auto`; no running animations |
| No JavaScript | search stays hidden; six tasks, prompts, commands and reference are server-rendered; disclosures open natively |

`[hidden]` is already forced to `display:none` globally, so the progressively
enhanced controls cannot leak into the no-JavaScript page.

### 4. Technical completeness (#609)

`/docs` gained one section, **“Browsing here, and changing your own project”**:
what works with no account versus what needs the reader’s agent and accounts,
the exact checkout commands (`pnpm install --frozen-lockfile`, `pnpm dev`,
`pnpm check`, `pnpm check:fast -- tests/docs-hub.test.mjs`, `pnpm build`,
`pnpm deploy`), the maintained file paths, and six named failure recoveries.
`pnpm deploy` is described as releasing this site, never the reader’s project.
It is indexed by the local search as “Commands, files and recovery”
(`#operate`). Captures: [desktop light](docs-1440-light-operate.jpg).

### 5. Homepage first impression re-check (#495)

Re-read against the five visitor observations at 390 and 1440 px, light and
dark, using local source identical to production for `ProductHome.astro`:

- Product name: “App Composer” in the header, the eyebrow and the opening
  sentence. Get Ready appears only in the note as “the setup step”.
- Outcome: “Build an app you own.” plus one sentence naming the chosen agent,
  Cloudflare, source and data ownership.
- First action: “Build your first app” → `/learn`, above the fold at both
  widths; two secondary links follow.
- Dominant interaction: the interactive workshop now begins 4,108 px (phone)
  and 2,715 px (desktop) into the page, after the explanation and the real
  Creator Hub example; it is labelled a fictional illustration.
- Category inference: the opening artwork is a real Media Studio output with a
  credit. The credit now reads “Made in Media Studio, built with App Composer”
  so it names the parent product instead of introducing a second unexplained
  name. One copy change, no restructure.
- Captures: [desktop light](home-desktop-first.jpg) ·
  [phone light](home-phone-first.jpg) · [desktop dark](home-desktop-dark-first.jpg).

Independent cold-visitor comprehension is still the open acceptance item in
#495/#425; this record does not substitute for it.

### 6. Media Studio claims against the released product (#459/#457)

- **Retired still model.** Live `/media-studio` offered “SDXL Lightning” as a
  current Workers AI still route in the capability table and the evidence
  table. Studio Draft is now **FLUX.2 Klein 9B**; SDXL Lightning was retired on
  15 November 2026 before Cloudflare’s 20 November cutoff. The capability row
  now lists Studio Print, Studio Film, Studio Draft · FLUX.2 Klein 9B and
  Studio Quick plus the FLUX.2 Klein 4B reference variation. The dated evidence
  row keeps the original build’s SDXL Lightning and marks it retired; saved jobs
  keep that attribution. A dated paragraph records the change.
- **Specification revision.** The article’s sample spec said `"version": 2` and
  “Revision 2 added the sound defaults” as the current state; `spec.mjs` is at
  `mediaStudioRevision = 3`. The sample and text now say revision 3 adds the
  retired-model migration, with revision 2’s sound defaults and revision 1
  compatibility kept as history.
- **Contradictory tutorial caption.** The tutorial caption said the sound fields
  arrived in revision 3 while the body said revision 2. Corrected to one
  statement; the SDXL retirement is named in the same chapter.
- **Unverified render limit.** “The current per-clip limit is 16 seconds”
  contradicted the maintained `docs/media-studio.md` (≤10.5 s per take, ≤60 s
  total). Removed rather than guessed.
- **Reproducible path.** The tutorial now carries an eleven-stage table from
  brief, handoff and build through source assets, edit, Direct, model review,
  render, publish and return, naming the control and the result for each stage.
  It links the model freshness record and states the 403 provider block plus the
  unshipped conversational Producer. Phone layout stacks the table with its two
  column labels: [capture](tutorial-390-light-path.jpg).
- **Unbuilt artefacts stay unbuilt.** Two source TODOs mark where the parallel
  Studio lane’s new film (master, poster, captions, release identity) replaces
  the existing illustrated walkthrough. No film, screenshot or receipt was
  invented.
- **Public Markdown snapshot.** `public/media-studio/media-studio-article-20261114.md`
  keeps its 14 November text and gains a dated correction note about the
  retirement, so the syndication draft is not read as current model advice.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm check:fast -- tests/docs-hub.test.mjs` | PASS — types/generated source, semantic lint, format, 13/13 focused tests |
| `node --test tests/docs-hub.test.mjs` | 13/13 |
| `pnpm check` (full gate on the final tree) | see the delivery record for the exact result of this run |

Focused tests added in `tests/docs-hub.test.mjs`:

1. **Copy outcomes** — resolving write → `copied`; rejecting write, missing
   Clipboard API and `null` writer → `manual`; whitespace-only text → `empty`;
   messages name “Copied”, “Copy failed” and the prompt library.
2. **Per-control labelling and announcement** — the template builds a name from
   each task question, names are unique, the status is an `aria-live` region,
   the prompt is a labelled focusable region, the source always renders the full
   text in a disclosure, failure selects it, and the status clears.
3. **Fresh-agent self-sufficiency contract** — the copied “I already have a
   project” text carries the read-only boundary, the placeholder-resolution
   rule, the recommendation shape, the stop condition, no credential-shaped
   strings and a bounded length.

## Fresh-agent proof — BLOCKED, not claimed

The brief asked for the canonical copied text to run as a literal prompt in two
independent fresh agent contexts. Attempts and exact results:

- `codex exec -s read-only --ephemeral --skip-git-repo-check` (Codex CLI
  0.145.0, signed-in ChatGPT account): `model_not_found` for the configured
  `gpt-6.1-sol`, and for explicit `gpt-5-codex`; `preferred_auth_method=apikey`
  still resolved to the ChatGPT account, so the host `OPENAI_API_KEY` was not
  used.
- No `opencode` CLI binary is installed (`~/.local/bin` has `codex` only; the
  desktop app is not a CLI). Installing `opencode-ai` would not have provider
  credentials.
- Local `ollama` is installed with zero models; downloading one is a new large
  resource outside this task.

So two fresh model contexts were not available. The copied text was improved on
the evidence that *was* available: the project placeholder now tells the
receiving agent to inspect the folder it was given, and every template ends with
a rule to resolve placeholders from the project or ask once rather than invent a
value. The self-sufficiency contract above is a regression, not comprehension
proof.

Next executable action: run the copied “I already have a project” text once in a
supported Codex/OpenCode agent with a scratch repository, then once in a second
agent or model, and record tool, version, input hash, expected outcome, actual
result and independent verification. Until then #609’s fresh-agent acceptance
stays open.

## Launcher destination drift (reported, not edited)

Canonical Composer path: **`/docs/how-it-works#standalone-get-ready`**.

- Composer’s copy: `src/components/AppLauncher.astro` uses that path.
- The anchor exists on live and local `/docs/how-it-works`
  (`id="standalone-get-ready"`).
- The Studio copy, owned by the Studio lane, still uses
  `/docs#standalone-get-ready` (`public/brand/launcher.js:97` and
  `src/browser/launcher.ts:95` in `loftwah/composer-media-studio`). That works
  only because `/docs` forwards the legacy anchor in client-side JavaScript; it
  does not resolve without JavaScript and adds a navigation hop.

Recommendation: point the Studio copy at
`/docs/how-it-works#standalone-get-ready` and regenerate its launcher assets.

## Remaining boundaries

- No deployment, release, issue comment or close. The branch is pushed only.
- No fresh-agent run (above).
- No independent cold-visitor test for #495.
- Provider compose still returns 403; the article and tutorial say so.
- The new Studio film and Director recording remain with the parallel Studio
  lane; the two source TODOs are the handoff points.
