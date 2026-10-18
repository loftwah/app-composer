# Maintaining the source

Author source for review: normal indentation, readable statements and explicit component boundaries. Build tools handle minification. Keep structural cleanup separate from changes to product behaviour, data contracts or storage.

The [engineering baseline](engineering-baseline.md) records the current checked
content-model and generated-project slice. `lib/content-model/*.mts` and the
recipe's application `.mts` modules own their emitted `.mjs`/`.d.mts` files.
Run `pnpm source:write` after edits; `dev`, `check:types` and `build` reject stale
outputs. Generated sites carry their own source/checker/lockfile and run their
own `source:write`, `check` and `build` commands. Preparation does not update an
existing owner project or establish its deployment.

The Creator domain's maintained authors are `src/lib/app-settings.mts`,
`stacks.mts`, `stack-activation.mts`, `app-configuration.mts`, `miniapp-admin.mts`,
the profile/tag/achievement validator authors and `stacks-admin.mts`.
`scripts/creator-source.mjs` enumerates this closed source set, checks strict
Worker globals and D1 types, and emits the same-path readable `.mjs` and `.d.mts`
in memory. Edit the author, run `pnpm format` and `pnpm source:write`, then check.
Normal development, types and build commands refuse stale runtime/declarations.
The Node operator's `scripts/app-configuration.mjs` retains the validated
specification plan and re-exports the checked configuration transport; its
independent command never requires a Composer server.

External documents, persisted snapshots and remote response JSON must be
validated before typed use. Preserve the stack store's actual SQL, actor/CAS
checks and immutable publication identity. Published app-owned resource metadata
is validated and retained; it is not a draft or a claim to own app records/media.
Compiler and boundary tests exercise invalid source, stale output, inherited-key
selectors, corrupt stored documents and unknown acknowledgments. The root lint
and format commands deliberately cover the maintained source slice recorded in
the [engineering baseline](engineering-baseline.md); remaining legacy Node tools
and Get Ready are not represented as fully converted.

## Native mini-app editor

`src/plugins/miniapps-admin.tsx` registers the EmDash page and assembles the editor. The modules in `src/plugins/miniapps/` have distinct responsibilities:

| Module | Owns |
| --- | --- |
| `use-miniapps.ts` | Drafts across app switches, current snapshots, request generations, mutation exclusion and recovery. |
| `api.ts` | Existing EmDash read/write transport and error handling. |
| `settings.tsx` | App appearance and profile fields. |
| `link-editor.tsx` | Manual link edits, conflicts, preview and card presentation. |
| `photo-preview.tsx` | Private photo decoding and canvas lifecycle. |
| `guestbook-workspace.tsx` | Submission and moderation controls. |
| `showcase-workspace.tsx` | Collection, tags, achievements, retained edits and eligible photos. |
| `types.ts` | The existing editor's shared types. |
| `collection-sources.tsx` / `collection-api.ts` | Explicit saved visitor-book selection, strict collection receipts and retained uncertain-reference checks across app switches. |

State stays above the two workspaces so switching apps retains unsaved work. A single `?app=showcase` selects Linkarooie on entry; absent, unknown or duplicated app parameters select Guestbook. This selects a view only and grants no permission. Keep component identities stable; do not define components inside the page or hook. Mutations and profile-file operations share one exclusion reference. Snapshot generation checks prevent an older refresh from replacing a newer response. The server bridge author `src/lib/miniapp-admin.mts` owns authorization, validation and app service calls; its `.mjs` and declarations are checked distributions. Extracting components grants no additional authority. [Exact runtime coverage](runtime-source-coverage.md) lists the remaining JavaScript exceptions.

The scoped collection bridge is `src/lib/miniapp-collection.ts`, with shared strict schemas in `miniapp-collection-contract.ts`. It is called only after the existing global administrator, origin and method checks in `miniapp-admin.mjs`. See [scoped collection authority and recovery](scoped-collection.md). Source selection does not change a saved draft or publication.

## Public sharing, theme and launcher assets

Composer's `public/brand/` is the maintenance source for the MIT sharing/theme files (`page-share-url.mjs`, `page-share.mjs`, `page-share.css`, `theme-control.css`) and `launcher.css`. The launcher controller is authored as strict TypeScript in `src/browser/launcher.ts`; `node scripts/launcher-assets.mjs --write` type-checks and emits its readable `public/brand/launcher.js` distribution. `--check` type-checks and rejects stale generated output. Compilation emits in memory and creates no temporary project. Each independent app commits and deploys its own copy. There is no cross-origin asset fetch, Composer runtime dependency, package publication or automatic update.

Inspect existing copies with explicit checkout paths:

```sh
pnpm ui:assets --check /absolute/app-checkout /absolute/another-app-checkout
```

After reviewing the source change, copy those six interaction files and the seven reviewed versioned assets into selected checkouts:

```sh
pnpm ui:assets --write /absolute/app-checkout /absolute/another-app-checkout
```

Check is read-only and exits nonzero for different bytes. Write preflights every selected app and changes only different named files. It refuses unknown packages and linked destination files/directories. It preserves unrelated branding, configuration and content. Inspect existing edits and review each resulting Git diff before committing; this explicit write command replaces local edits in the six selected interaction files. A repeated write leaves matching files untouched. Updates still use each app's own review/release process and exact composition pins.

The same explicit operation distributes `space-latin-20261018.woff2`, all five `apps/*-small-20261018.webp` identities and `composer-icon-20261018-96.png`. Their exact reviewed SHA-256 identities are pinned in the maintainer. Missing versioned files may be created; an existing file with different bytes is refused before any selected destination is changed. Every parent directory must already exist and be unlinked. New font/pixel content requires a new filename, source hash and consumer update. The command has no default app paths and never touches owner image settings. Link Check retains its app-owned font location under `public/`; the other apps use `public/brand/`. Active CSS/preload/launcher references remain reviewed app-owned source.

### Launcher markup and maintenance contract

All six shells use the same local launcher assets. The shipped consumers are Guestbook (`public/brand`), Showcase (`public/brand`), Hello (`public/brand`), State (`public/brand`) and Link Check (`public/brand`), plus Composer itself. Guestbook/Showcase use their existing mount prefix for both assets, so the same source serves `/guestbook/` and `/showcase/`; exact composition pins and independent app releases remain required.

The markup consists of `[data-open-apps]` (a button with `aria-haspopup="dialog"`), `dialog#app-navigation` with a labelled heading, a first `[data-close-apps]` button with `autofocus`, a labelled `input[type=search]`, `[role=status]`, and `ul > li[data-destination] > a` destinations. Optional images and `span > small` supply aligned artwork and descriptions. Each shell supplies `data-composer-home` on the dialog: Composer uses `/`, and an independent app selects the Composer instance it links to. The shared controller builds the same local branded header, Composer home link, All apps footer, app ordering, task descriptions and studio shortcuts. The logo is resolved beside that shell’s local launcher script, including mounted prefixes. App destinations remain the authored links; studio links resolve against the selected Composer home. Mark known current-app links with `aria-current="page"`; otherwise exact same-origin paths are detected. Missing images keep their alignment space; text-only tasks use the full row. Destinations, app access boundaries, theme storage, galleries and owner settings remain local.

Touch/click opening focuses Close without opening the keyboard. Cmd/Ctrl+K opens and focuses search, and focuses search if already open. Arrow keys, Home/End and Enter navigate the visible results; typing after arrow selection returns to search. Search matches all case/accent-normalised terms and the reviewed task aliases. IME confirmation does not activate a result. Escape closes even a nonempty search; native dialog focus and modal isolation remain in place. The fixed body lock restores page position and focus; only destination rows scroll. Geometry uses visual viewport size and offsets, safe-area padding, orientation and keyboard resize. Inputs have a computed default floor of 16px, while user zoom/text sizing remains available. This contract does not establish physical-device IME or iOS zoom acceptance.

For each update: edit maintained TS/CSS, emit the controller, explicitly check/write all five checkout paths, review each diff, check/build each independent app, and verify both mounted routes after their exact source-pin promotion. The maintenance check type-checks the controller before comparing all selected copies and refuses stale generated source. A new launcher copy is allowed only through explicit write; existing sharing/theme files and linked paths retain their safety checks.

App-specific navigation/header branding, theme storage keys and bootstrap scripts remain separate. New content-site projects are also independent launcher consumers. Their finite copier captures the checked controller source, emission script/config, local distribution/styles, Space font/OFL, Composer return identity and all five mini-app thumbnails in `composer-project.json`. Their header uses absolute external app destinations and an explicit Composer home. The same controller supplies the task list and keyboard behaviour; no Composer runtime asset fetch is introduced. `pnpm check:types` in each generated project verifies its own checked launcher and output. Existing owner projects are never silently updated.

## Verification

Use focused checks while editing:

```sh
node --test tests/public-ui-assets.test.mjs tests/page-share.test.mjs
node --test tests/miniapp-admin.test.mjs tests/miniapp-*-ui.test.mjs
pnpm check:types
```

For editor changes, exercise app switching, unsaved inputs, refresh/conflict recovery and explicit saves with fictional fixtures. Check the protected live editor after release using an existing authorized administrator session. Source cleanup does not justify mutating owner content. Existing production deployment checks remain the release boundary.

The new-project copier is authored in `lib/content-model/project.mts`; the existing content-source command emits/checks its readable JavaScript and declarations. Narrow declarations describe the existing tested filesystem helpers; they do not convert or widen those helpers. Shared launcher source/script/config copies retain the source repository formatting so their bytes and provenance stay exact; this narrow Prettier exception is listed in the generated project.
